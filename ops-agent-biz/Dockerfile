FROM python:3.11-slim

WORKDIR /app

# 设置 pip 清华源加速
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 1. 复制 Core 层并安装依赖
COPY ops-agent-core/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. 复制 Core 代码 (作为一个包)
COPY ops-agent-core /app/ops_agent_core
# 设置 PYTHONPATH 以便 biz 层可以直接 import ops_agent_core 下的模块
# 这里的 trick 是：我们将 ops-agent-core 文件夹重命名为 ops_agent_core (下划线)，符合 Python 包命名规范
# 并在 PYTHONPATH 中加入 /app，这样 `import ops_agent_core.db` 就能工作
# 但为了保持原有的 import 习惯 (from db import engine)，我们需要把 core 下的内容直接放进 PYTHONPATH
ENV PYTHONPATH=/app/core_layer

# 重新组织目录结构以适配 import
RUN mkdir -p /app/core_layer
COPY ops-agent-core /app/core_layer/

# 3. 复制 Biz 层代码 (启动入口)
COPY ops-agent-biz .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
