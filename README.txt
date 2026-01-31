Ops Agent (内网版)
============================

环境要求:
- Linux x64 (在 BCLinux 8.2 上测试通过)
- 数据库 (PostgreSQL 启用 pgvector 插件)

安装步骤:
1. 解压压缩包。
2. 编辑 `config.yaml` 配置文件，根据您的实际环境修改数据库和 LLM 设置。
   - 默认配置已适配内网 DeepSeek-V3 模型和 PostgreSQL 数据库。
   - 请务必修改 `database.password` 为实际的数据库密码。
3. 运行 `./ops-agent` 启动服务。

配置说明:
- `database`: 数据库连接信息。
- `llm`: 大模型服务配置。
  - `provider`: 设置为 "deepseek-v3" 或 "openai"。
  - `chat_base_url`: 对话模型 API 地址。
  - `embedding_base_url`: 向量模型 API 地址。
- `server`: 服务监听地址和端口 (默认 9020)。

常见问题:
- 如果遇到权限错误，请运行: `chmod +x ops-agent`
- 如果无法运行，请查看终端输出的日志信息。
