# 运维智能问答助手 - 内网部署避坑指南

本指南汇总了从外网（开发环境）迁移到内网（生产环境）过程中可能遇到的所有坑及解决方案。

---

## 📦 部署包结构说明 (重要)

新版部署包 `ops-agent-linux-x64.zip` 解压后仅包含以下内容 (极简模式)：

```text
ops-agent-linux-x64/
├── ops-agent             # 主程序 (二进制文件，已内置所有前端资源)
├── config.yaml           # 配置文件 (需修改数据库和LLM地址)
├── INTRANET_GUIDE.md     # 本指南
└── README.txt            # 简易说明
```

**✅ 核心改进**: 
- **单文件运行**: 前端静态资源 (React 编译产物) 已被完整打包进 `ops-agent` 二进制文件中。
- **无需额外目录**: 部署时不再需要 `dist_frontend` 或 `templates` 文件夹。

---

## 1. 常见报错与解决方案

### Q1: 启动后界面非常简陋，和外网演示的不一样
**现象**: 浏览器访问后只显示一个简单的输入框，没有侧边栏、没有登录页、没有美观的 UI。
**原因**: 
- 这是旧版行为。新版单文件包启动后应直接显示完整 UI。
- 如果仍显示简陋界面，说明启动的可能是旧版二进制文件，或者构建过程中静态资源打包失败。
**解决方案**:
- 确保运行的是最新编译的 `ops-agent` 文件。
- 清除浏览器缓存 (Ctrl+F5) 重试。

### Q2: 报错 `GLIBC_2.38 not found` (或类似版本错误)
**现象**: `./ops-agent: /lib64/libm.so.6: version 'GLIBC_2.38' not found`
**原因**: 内网服务器 (如 BCLinux 8.2, CentOS 7) 的 GLIBC 版本过低 (通常为 2.28 或 2.17)，而程序编译环境使用了高版本 GLIBC。
**解决方案**:
- 本部署包已集成 **Portable Python** (基于 musl/旧版 glibc 编译)，理论上兼容 GLIBC 2.17+。
- 且构建时已排除高版本系统库 (`libgcc_s`, `libstdc++`)，确保使用系统自带库或兼容库。

### Q3: 报错 `ModuleNotFoundError: jinja2` 或 `AssertionError: jinja2 must be installed`
**现象**: 启动时崩溃，提示缺少 jinja2。
**解决方案**:
- 新版构建已修复此问题 (强制打包 jinja2/markupsafe)。

### Q4: 数据库连接失败 `Connection refused`
**现象**: 启动失败，日志提示无法连接数据库。
**解决方案**:
- 检查 `config.yaml` 中的 `[database]` 配置。
- 确认内网 PostgreSQL 已安装 `pgvector` 插件 (`CREATE EXTENSION vector;`)。
- 检查防火墙是否允许 5432 端口通信。

### Q5: 提问报错 `500 Internal Server Error` (Input should be a valid string)
**现象**: 提问时后端报错 `openai.UnprocessableEntityError: ... 'input': ['...']`。
**原因**: 内网部署的某些大模型接口（如旧版 vLLM 或特定本地推理框架）不支持 OpenAI 协议中的“列表格式输入” (Batch Input)，仅支持单字符串输入。
**解决方案**:
- 新版程序已针对此问题做了兼容性修复（强制使用单字符串格式调用 Embedding 接口）。
- 请确保使用的是最新构建的二进制文件。

### Q6: 访问管理页面报错 `401 Unauthorized`
**现象**: 日志中出现大量 `GET /admin/... 401 Unauthorized`。
**原因**: 这是正常的安全拦截。新版系统开启了完整的 RBAC 权限控制，在未登录状态下，前端尝试获取后台数据会被拒绝。
**解决方案**:
- 请在页面上使用 `admin` / `admin123` 登录，登录后即可正常访问。

### Q7: 知识文档页面点击报错 (白屏/TypeError)
**现象**: 点击左侧“知识文档”菜单后，页面变白或报错。
**原因**: 前端代码中 `File` 图标组件与浏览器全局 `File` 对象命名冲突。
**解决方案**:
- 已在源码中修复该冲突 (重命名组件为 `FileIcon`)。
- 请使用最新编译的二进制文件。

### Q8: 数据库字段缺失报错
**现象**: 日志提示 `column "download_count" of relation "uploaded_files" does not exist`。
**原因**: 新功能依赖数据库新增字段。
**解决方案**:
- 程序启动时会自动尝试执行数据库迁移 (Add Columns)。
- 如果自动迁移失败（因权限不足），请手动执行 SQL:
  ```sql
  ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
  ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;
  ```

---

## 2. 部署步骤 (标准流程)

1.  **上传与解压**:
    ```bash
    # 上传 zip 包到内网服务器
    unzip ops-agent-linux-x64.zip
    cd ops-agent-linux-x64
    chmod +x ops-agent
    ```

2.  **配置数据库**:
    - 确保 PostgreSQL 12+ 运行正常。
    - 执行: `psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"`

3.  **修改配置**:
    - 编辑 `config.yaml`:
      ```yaml
      database:
        host: "192.168.1.100"  # 内网数据库IP
        ...
      llm:
        chat_base_url: "http://192.168.1.200:8000/v1" # 内网大模型地址
      server:
        host: "0.0.0.0"
        port: 9020
      ```

4.  **启动服务**:
    ```bash
    ./ops-agent
    ```
    - 观察日志，出现 `Application startup complete` 即为成功。

5.  **验证功能**:
    - 访问 `http://IP:9020`
    - 使用 `admin` / `admin123` 登录
    - 检查左侧菜单是否有“知识文档”
    - 尝试上传和搜索文档
