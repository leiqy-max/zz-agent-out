# ZZ Agent Out - Mac 部署指南

本项目已适配 Docker 容器化部署，可在 Mac (M1/M2/Intel) 上一键运行。

## 1. 准备工作

1.  **安装 Docker Desktop**:
    *   请访问 [Docker 官网](https://www.docker.com/products/docker-desktop/) 下载并安装 Docker Desktop for Mac。
    *   启动 Docker Desktop。

2.  **获取代码**:
    *   将整个 `zz-agent-out` 文件夹复制到您的 Mac 上。
    *   **注意**: 请勿复制 `node_modules`、`venv` 或 `__pycache__` 文件夹（如果存在），这些是系统相关的，Docker 会自动重新安装。

## 2. 配置环境

在项目根目录 (`zz-agent-out/`) 下创建一个名为 `.env` 的文件，并填入您的智谱 AI API Key：

```env
# .env 文件内容
ZHIPUAI_API_KEY=your_actual_api_key_here
```

> **注意**: 请将 `your_actual_api_key_here` 替换为您真实的 Key。

## 3. 一键启动

打开终端 (Terminal)，进入项目目录，运行以下命令：

```bash
# 进入目录 (示例)
cd ~/Downloads/ops-agent

# 启动服务 (首次运行需要下载镜像，可能需要几分钟)
docker-compose up --build
```

**启动成功标志**:
*   终端显示 `backend  | ✅ Database initialized successfully`
*   终端不再疯狂滚动日志，处于稳定运行状态。

## 4. 使用系统

*   **访问地址**: 打开浏览器访问 [http://localhost:5173](http://localhost:5173)
*   **功能验证**:
    1.  点击右上角“上传附件”，上传一个测试文档（如 .docx 或 .txt）。
    2.  等待几秒提示“入库成功”。
    3.  在输入框提问与文档相关的问题。

## 5. 常见问题

*   **端口冲突**: 如果提示 `Bind for 0.0.0.0:5432 failed`，说明本地已安装 PostgreSQL。请修改 `docker-compose.yml` 中的端口映射，例如改 `5432:5432` 为 `5433:5432`。
*   **API Key 错误**: 如果回答提示“API 认证失败”，请检查 `.env` 文件中的 Key 是否正确，并重启容器 (`Ctrl+C` 然后重新运行 `docker-compose up`).
*   **停止服务**: 在终端按 `Ctrl+C` 即可停止。后台运行请使用 `docker-compose up -d`。
