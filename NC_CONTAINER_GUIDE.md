# NC 框架适配与容器化部署指南

本文档指导如何在 NC 框架（或任意 Docker/Kubernetes 环境）中通过容器方式部署 Ops Agent 智能问答系统。

## 1. 架构说明

适配 NC 框架的核心是将“单体应用”拆分为“微服务容器”：
*   **前端容器 (Frontend)**: Nginx + React 静态资源。
*   **后端容器 (Backend)**: Python FastAPI 服务。
*   **数据库容器 (DB)**: PostgreSQL + pgvector（可选，也可复用内网已有数据库）。

## 2. 准备工作：构建镜像 (在外网环境)

由于内网无法拉取镜像，我们需要先在有网的环境构建并导出镜像。

### 2.1 构建镜像
在项目根目录下执行：
```bash
# 构建前端和后端镜像
docker-compose build
```

### 2.2 拉取依赖镜像
```bash
# 拉取向量数据库镜像
docker pull pgvector/pgvector:pg16
```

### 2.3 导出镜像 (docker save)
执行以下命令将镜像打包为 `.tar` 文件，方便拷贝到内网：
```bash
# 创建导出目录
mkdir -p dist/images

# 导出三个核心镜像
docker save -o dist/images/ops-agent-backend.tar ops-agent-backend:latest
docker save -o dist/images/ops-agent-frontend.tar ops-agent-frontend:latest
docker save -o dist/images/pgvector.tar pgvector/pgvector:pg16

echo "镜像导出完成，请将 dist/images 目录拷贝至内网服务器。"
```

## 3. 内网部署步骤

### 方式一：Docker Compose 部署 (单机容器)
适用于 NC 框架提供的虚拟机或裸机环境。

1.  **导入镜像**：
    ```bash
    cd images
    docker load -i ops-agent-backend.tar
    docker load -i ops-agent-frontend.tar
    docker load -i pgvector.tar
    ```

2.  **启动服务**：
    将项目根目录下的 `docker-compose.yml` 拷贝到服务器，执行：
    ```bash
    # 后台启动
    docker-compose up -d
    ```

3.  **验证**：
    访问 `http://服务器IP:8080` 即可看到界面。

### 方式二：Kubernetes / NC 平台部署 (集群)
适用于标准的 NC 云原生环境。

1.  **上传镜像**：
    将导出的镜像推送到内网的镜像仓库（Harbor 等）。
    ```bash
    docker tag ops-agent-backend:latest <内网仓库地址>/ops-agent-backend:latest
    docker push <内网仓库地址>/ops-agent-backend:latest
    # 前端同理
    ```

2.  **修改配置**：
    打开 `k8s_deployment.yaml` 文件，修改 `image` 字段为您的内网仓库地址。

3.  **应用配置**：
    ```bash
    kubectl apply -f k8s_deployment.yaml
    ```

## 4. 环境变量配置
在 NC 平台的配置中心或 `docker-compose.yml` 中，可配置以下核心变量：

| 变量名 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `DB_HOST` | 数据库地址 | db |
| `DB_PORT` | 数据库端口 | 5432 |
| `DB_USER` | 数据库用户名 | ops_user |
| `DB_PASSWORD` | 数据库密码 | OpsPassword123! |
| `ZHIPUAI_API_KEY` | 大模型 API Key | (空) |

## 5. 常见问题
*   **数据库连接失败**：请检查 `backend` 容器是否能 ping 通 `db` 容器（或内网数据库 IP）。
*   **API Key 无效**：请确认容器环境变量是否生效，可进入容器执行 `env` 查看。
