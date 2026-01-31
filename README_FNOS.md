# ZZ Agent Out - 飞牛 NAS (FnOS) 部署指南

本指南将帮助您在飞牛 NAS 上通过 Docker 部署 ZZ Agent Out。

## 准备工作

1.  **下载代码包**：将本项目代码下载到您的电脑。
2.  **配置 API Key**：
    *   在代码根目录下，找到 `.env.fnos` 文件。
    *   将其重命名为 `.env`。
    *   编辑该文件，填入您的智谱 AI API Key：`ZHIPUAI_API_KEY=您的key`。

## 部署步骤 (全自动脚本)

我们提供了一个全自动的 Python 部署脚本，支持**自动处理镜像下载**（解决网络慢的问题）。

1.  **修改配置**：
    打开 `deploy_to_nas.py`，确认您的 NAS IP、用户名、密码和部署路径：
    ```python
    NAS_HOST = "192.168.31.232"
    NAS_USER = "leiqy"
    NAS_PASS = "L942038441."
    ```

2.  **安装 Docker (可选但推荐)**：
    如果在本地（当前电脑）安装了 Docker，脚本会自动：
    *   本地下载所需镜像。
    *   打包镜像并上传到 NAS。
    *   在 NAS 上直接加载，**无需 NAS 联网下载镜像**。
    
    *如果本地没有 Docker，脚本会尝试让 NAS 使用国内镜像源下载。*

3.  **运行脚本**：
    在本地终端运行：
    ```bash
    python3 deploy_to_nas.py
    ```

脚本会自动：
*   打包代码并上传。
*   **上传本地镜像包**（如果有）或 **在 NAS 上拉取镜像**。
*   使用 `sudo` 权限启动服务。

## 手动部署 (如果不使用脚本)

如果您希望手动操作，请通过 SSH 连接到 NAS：

1.  连接 NAS：
    ```bash
    ssh leiqy@192.168.31.232
    ```
2.  创建目录并上传文件：
    将代码包上传到 `/vol1/1000/docker/ops-agent`。
    
3.  **解决镜像下载慢的问题**：
    
    **方案 A：手动预拉取 (在 NAS 上)**
    ```bash
    # 使用国内镜像源拉取并重命名
    sudo docker pull docker.1panel.live/library/python:3.11-slim
    sudo docker tag docker.1panel.live/library/python:3.11-slim python:3.11-slim
    
    sudo docker pull docker.1panel.live/library/node:18-alpine
    sudo docker tag docker.1panel.live/library/node:18-alpine node:18-alpine
    
    sudo docker pull docker.1panel.live/library/nginx:alpine
    sudo docker tag docker.1panel.live/library/nginx:alpine nginx:alpine
    
    sudo docker pull docker.1panel.live/pgvector/pgvector:pg16
    sudo docker tag docker.1panel.live/pgvector/pgvector:pg16 pgvector/pgvector:pg16
    ```

    **方案 B：离线导入 (推荐)**
    在有网络的电脑上导出镜像：
    ```bash
    docker pull python:3.11-slim node:18-alpine nginx:alpine pgvector/pgvector:pg16
    docker save -o images.tar python:3.11-slim node:18-alpine nginx:alpine pgvector/pgvector:pg16
    ```
    上传 `images.tar` 到 NAS 目录，然后执行：
    ```bash
    sudo docker load -i images.tar
    ```

4.  启动服务：
    ```bash
    sudo docker compose up -d --build
    ```

## 访问服务

部署完成后，您可以通过浏览器访问：
`http://192.168.31.232:5173`

## 数据持久化

系统会自动在当前目录下创建 `data` 文件夹，用于保存：
*   数据库数据 (`data/db`)
*   上传的文件 (`data/uploads`)
*   问答历史 (`data/question_history.json`)
