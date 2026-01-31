#!/bin/bash

# 配置信息
NAS_USER="leiqy"
NAS_IP="192.168.31.232"
# 飞牛 NAS 的 Docker 目录通常在 /vol1/1000/docker/ 下，请确认此路径存在
# 如果不存在，请修改为您 NAS 上实际的存储路径
REMOTE_DIR="/vol1/1000/docker/zz-agent-out"

echo "=========================================="
echo "正在部署 ZZ Agent Out 到飞牛 NAS ($NAS_IP)..."
echo "=========================================="

# 1. 打包代码 (排除不必要的文件)
echo "[1/5] 正在打包本地代码..."
rm -f deploy_package.tar.gz
tar --exclude='node_modules' \
    --exclude='venv' \
    --exclude='.git' \
    --exclude='data' \
    --exclude='deploy_package.tar.gz' \
    --exclude='*.log' \
    -czf deploy_package.tar.gz .

# 2. 创建远程目录
echo "[2/5] 创建远程目录 (可能需要输入密码)..."
ssh "$NAS_USER@$NAS_IP" "mkdir -p $REMOTE_DIR"

# 3. 上传压缩包
echo "[3/5] 上传代码包 (可能需要输入密码)..."
scp deploy_package.tar.gz "$NAS_USER@$NAS_IP:$REMOTE_DIR/"

# 4. 解压并配置
echo "[4/5] 解压并配置环境..."
ssh "$NAS_USER@$NAS_IP" "cd $REMOTE_DIR && \
tar -xzf deploy_package.tar.gz && \
rm deploy_package.tar.gz && \
if [ ! -f .env ]; then cp .env.fnos .env; fi"

# 5. 启动服务
echo "[5/5] 构建并启动 Docker 容器..."
echo "注意：首次构建可能需要几分钟，请耐心等待..."
ssh "$NAS_USER@$NAS_IP" "cd $REMOTE_DIR && \
if docker compose version >/dev/null 2>&1; then \
    CMD='docker compose'; \
else \
    CMD='docker-compose'; \
fi; \
echo \"Using command: \$CMD\"; \
\$CMD down && \$CMD up -d --build"

# 清理本地压缩包
rm -f deploy_package.tar.gz

echo "=========================================="
echo "✅ 部署完成！"
echo "请访问: http://$NAS_IP:5173"
echo "=========================================="
