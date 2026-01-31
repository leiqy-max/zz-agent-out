# 部署指南 (Deployment Guide)

本文档将指导您如何在新的机器上部署本项目，包括运行环境配置、数据库初始化、Cloudflare 配置等。

## 1. 环境准备 (Prerequisites)

在开始之前，请确保您的服务器或本地机器安装了以下软件：

*   **操作系统**: Linux (推荐 Ubuntu/Debian/CentOS) 或 macOS
*   **Python**: 3.10 或更高版本
*   **Node.js**: 18.0 或更高版本 (用于前端构建)
*   **PostgreSQL**: 14.0 或更高版本 (必须支持并安装 `vector` 插件)

## 2. 数据库初始化 (Database Initialization)

本项目后端启动时会自动检查并创建所需的数据库表结构和默认数据。您只需要创建一个空的数据库并安装 `vector` 插件。

1.  **安装 PostgreSQL 和 pgvector**:
    *   **Ubuntu/Debian**:
        ```bash
        sudo apt install postgresql postgresql-contrib
        # 此时可能需要根据具体版本安装 pgvector，例如 postgresql-16-pgvector
        # 或者从源码编译安装 pgvector (https://github.com/pgvector/pgvector)
        ```

2.  **创建数据库**:
    登录到 PostgreSQL 并创建数据库（例如 `ops_agent`）：
    ```sql
    CREATE DATABASE ops_agent;
    \c ops_agent
    CREATE EXTENSION vector;
    ```

3.  **配置数据库连接**:
    修改 `backend/.env` 文件（如果没有则复制 `.env.example`），填入正确的数据库连接信息：
    ```ini
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=your_username
    DB_PASSWORD=your_password
    DB_NAME=ops_agent
    ```

## 3. 后端部署 (Backend Setup)

1.  进入后端目录：
    ```bash
    cd backend
    ```

2.  创建并激活虚拟环境（推荐）：
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  安装依赖：
    ```bash
    pip install -r requirements.txt
    ```

4.  启动后端服务：
    ```bash
    python main.py
    ```
    *   服务默认运行在 `http://0.0.0.0:8000`
    *   **首次启动**时，系统会自动初始化数据库表，并创建默认管理员账号：
        *   用户名: `admin`
        *   密码: `admin123`

## 4. 前端部署 (Frontend Setup)

1.  进入前端目录：
    ```bash
    cd frontend
    ```

2.  安装依赖：
    ```bash
    npm install
    ```

3.  **开发模式运行** (用于调试)：
    ```bash
    npm run dev
    ```
    访问: `http://localhost:5173`

4.  **生产环境构建**:
    ```bash
    npm run build
    ```
    构建完成后，`dist` 目录即为静态资源文件。您可以使用 Nginx 或其他 Web 服务器进行托管。

    **Nginx 配置示例**:
    ```nginx
    server {
        listen 80;
        server_name your_domain.com;

        location / {
            root /path/to/ops-agent/frontend/dist;
            try_files $uri $uri/ /index.html;
        }

        # 代理后端 API
        location /api/ {
            proxy_pass http://localhost:8000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # 代理文档相关 API (如果前端直接请求 /documents)
        location /documents/ {
            proxy_pass http://localhost:8000/documents/;
        }
    }
    ```

## 5. Cloudflare Tunnel 初始化 (Cloudflare Initialization)

如果您希望将服务暴露到公网，推荐使用 Cloudflare Tunnel，无需配置防火墙端口转发。

1.  **安装 Cloudflared**:
    请参考 Cloudflare 官方文档下载对应系统的 `cloudflared` 二进制文件或安装包。
    ```bash
    # Ubuntu 示例
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    ```

2.  **登录 Cloudflare**:
    ```bash
    cloudflared tunnel login
    ```
    这将打开浏览器进行授权，选择您的域名。

3.  **创建 Tunnel**:
    ```bash
    cloudflared tunnel create ops-agent
    ```
    记下生成的 Tunnel ID。

4.  **配置 DNS (CNAME)**:
    将您的域名指向该 Tunnel：
    ```bash
    cloudflared tunnel route dns ops-agent ops-agent.yourdomain.com
    ```

5.  **编写配置文件 (`config.yml`)**:
    创建一个 `config.yml` 文件：
    ```yaml
    tunnel: <Tunnel-UUID>
    credentials-file: /root/.cloudflared/<Tunnel-UUID>.json

    ingress:
      - hostname: ops-agent.yourdomain.com
        service: http://localhost:80  # 如果使用 Nginx 托管前端
        # 或者直接指向前端开发服务 (不推荐用于生产)
        # service: http://localhost:5173 
      - service: http_status:404
    ```

6.  **启动 Tunnel**:
    ```bash
    cloudflared tunnel run ops-agent
    ```
    或者安装为系统服务：
    ```bash
    sudo cloudflared service install
    sudo systemctl start cloudflared
    ```

---
**注意**: 
*   请确保后端服务正常运行且端口 (8000) 可被访问。
*   如果前端和后端分离部署，请确保 Nginx 或 Cloudflare 配置了正确的 API 反向代理，避免跨域问题。
