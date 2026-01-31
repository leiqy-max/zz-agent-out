import paramiko
import os
import tarfile
import sys
import time

# 配置信息
NAS_HOST = "192.168.31.232"
NAS_PORT = 22
NAS_USER = "leiqy"
NAS_PASS = "L942038441."
REMOTE_DIR = "/vol1/1000/docker/zz-agent-out"

def create_tarball(output_filename):
    print(f"[1/5] Creating local tarball: {output_filename}...")
    with tarfile.open(output_filename, "w:gz") as tar:
        # 添加当前目录下的文件，排除一些目录
        for root, dirs, files in os.walk("."):
            # 修改 dirs 列表以排除不需要的目录
            if "node_modules" in dirs: dirs.remove("node_modules")
            if "venv" in dirs: dirs.remove("venv")
            if ".git" in dirs: dirs.remove(".git")
            if "data" in dirs: dirs.remove("data")
            if "__pycache__" in dirs: dirs.remove("__pycache__")
            
            for file in files:
                if file == output_filename: continue
                if file == "images.tar": continue
                if file.endswith(".log"): continue
                
                full_path = os.path.join(root, file)
                # 相对路径，用于压缩包内
                rel_path = os.path.relpath(full_path, ".")
                tar.add(full_path, arcname=rel_path)

def deploy():
    tarball_name = "deploy_package.tar.gz"
    create_tarball(tarball_name)

    try:
        print(f"[2/5] Connecting to {NAS_HOST}...")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(NAS_HOST, port=NAS_PORT, username=NAS_USER, password=NAS_PASS)

        print(f"[3/5] Uploading package to {REMOTE_DIR}...")
        sftp = ssh.open_sftp()
        
        # 确保远程目录存在
        try:
            stdin, stdout, stderr = ssh.exec_command(f"mkdir -p {REMOTE_DIR}")
            stdout.channel.recv_exit_status()
        except Exception as e:
            print(f"Warning creating directory: {e}")

        sftp.put(tarball_name, os.path.join(REMOTE_DIR, tarball_name))
        
        should_skip_mirror = True # Skip image operations for quick update
        # if os.path.exists("images.tar"):
        #     print("[3.2/5] Uploading pre-downloaded images (images.tar)... This may take a while...")
        #     sftp.put("images.tar", os.path.join(REMOTE_DIR, "images.tar"))
        #     
        #     print("[3.3/5] Loading images on NAS...")
        #     load_cmd = f"echo '{NAS_PASS}' | sudo -S docker load -i {os.path.join(REMOTE_DIR, 'images.tar')}"
        #     stdin, stdout, stderr = ssh.exec_command(load_cmd)
        #     # Wait for finish and print output
        #     exit_status = stdout.channel.recv_exit_status()
        #     if exit_status == 0:
        #          print("  Successfully loaded images from tarball.")
        #          should_skip_mirror = True
        #     else:
        #          print(f"  Failed to load images: {stderr.read().decode()}")

        sftp.close()

        # 增加镜像预拉取逻辑，解决国内网络问题
        if not should_skip_mirror:
            print("[3.5/5] Pre-pulling images using mirror (to bypass network blocks)...")
            images = [
                ("python:3.11-slim", "docker.1panel.live/library/python:3.11-slim"),
                ("node:18-alpine", "docker.1panel.live/library/node:18-alpine"),
                ("nginx:alpine", "docker.1panel.live/library/nginx:alpine"),
                ("pgvector/pgvector:pg16", "docker.1panel.live/pgvector/pgvector:pg16")
            ]
            
            for local_tag, mirror_tag in images:
                print(f"  Pulling {local_tag} from {mirror_tag}...")
                pull_cmd = f"echo '{NAS_PASS}' | sudo -S docker pull {mirror_tag} && echo '{NAS_PASS}' | sudo -S docker tag {mirror_tag} {local_tag}"
                stdin, stdout, stderr = ssh.exec_command(pull_cmd)
                exit_status = stdout.channel.recv_exit_status()
                if exit_status != 0:
                    print(f"  Failed to pull {local_tag} from mirror. Will try direct pull in build step.")
                    # print(stderr.read().decode()) # Optional debug
                else:
                    print(f"  Successfully pulled {local_tag}")
        else:
            print("[3.5/5] Skipping mirror pull as images were loaded from tarball.")

        print("[4/5] Extracting and configuring...")
        # 组合命令：解压，配置 .env
        setup_cmd = f"cd {REMOTE_DIR} && tar -xzf {tarball_name} && rm {tarball_name} && if [ ! -f .env ]; then cp .env.fnos .env; fi"
        stdin, stdout, stderr = ssh.exec_command(setup_cmd)
        exit_status = stdout.channel.recv_exit_status()
        if exit_status != 0:
            print(f"Error during setup: {stderr.read().decode()}")
            return

        print("[5/5] Building and starting services (with sudo)...")
        # 使用 sudo -S 从 stdin 读取密码
        # 检测 docker compose 还是 docker-compose
        # 注意：这里我们直接用 sudo 尝试两种命令
        
        deploy_script = f"""
        cd {REMOTE_DIR}
        
        # 修复数据文件权限和类型问题
        # 如果 question_history.json 是目录（Docker 自动创建的），则删除它
        if [ -d "data/question_history.json" ]; then
            echo "Removing directory data/question_history.json..."
            echo "{NAS_PASS}" | sudo -S rm -rf data/question_history.json
        fi
        
        # 确保目录存在
        mkdir -p data/uploads
        mkdir -p data/db
        
        # 确保文件存在且是文件
        if [ ! -f "data/question_history.json" ]; then
            echo "Creating data/question_history.json..."
            echo "[]" > data/question_history.json
            chmod 666 data/question_history.json
        fi
        
        if docker compose version >/dev/null 2>&1; then
            CMD="docker compose"
        else
            CMD="docker-compose"
        fi
        echo "Using command: $CMD"
        echo "{NAS_PASS}" | sudo -S $CMD down
        echo "{NAS_PASS}" | sudo -S $CMD up -d --build
        
        echo "Waiting for tunnel to establish..."
        sleep 10
        echo "{NAS_PASS}" | sudo -S docker logs ops-agent-tunnel 2>&1 | head -n 20
        """
        
        stdin, stdout, stderr = ssh.exec_command(deploy_script)
        
        # 实时打印输出
        while not stdout.channel.exit_status_ready():
            if stdout.channel.recv_ready():
                line = stdout.channel.recv(1024).decode()
                print(line, end="")
            if stderr.channel.recv_ready():
                line = stderr.channel.recv(1024).decode()
                print(line, end="")
                
        # 打印剩余输出
        print(stdout.read().decode(), end="")
        print(stderr.read().decode(), end="")

        # 获取 NAS 的公网 IP
        print("\n[+] Retrieving NAS Public IP for Localtunnel Password...")
        ip_cmd = "curl -s https://loca.lt/mytunnelpassword"
        stdin, stdout, stderr = ssh.exec_command(ip_cmd)
        public_ip = stdout.read().decode().strip()
        
        ssh.close()
        print("\n==========================================")
        print("✅ Deployment completed successfully!")
        print(f"Access your agent at: http://{NAS_HOST}:5173")
        print(f"Public Tunnel URL: https://ops-agent-leiqy.loca.lt")
        print(f"Tunnel Password (NAS Public IP): {public_ip}")
        print("==========================================")

    except Exception as e:
        print(f"Deployment failed: {e}")
    finally:
        if os.path.exists(tarball_name):
            os.remove(tarball_name)

if __name__ == "__main__":
    deploy()
