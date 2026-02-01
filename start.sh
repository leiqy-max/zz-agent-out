#!/bin/bash

# =============================================================================
# Ops Agent 一键启动脚本
# 功能: 自动检测环境并启动后端 (FastAPI) 和前端 (Vite)
# 适用: 可以在任何目录下执行此脚本 (例如: ./start.sh 或 /path/to/start.sh)
# =============================================================================

# 1. 确定项目根目录 (无论从哪里运行脚本，都能找到项目位置)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"

# 定义颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}       Ops Agent 智能运维问答机器人       ${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "项目路径: ${PROJECT_ROOT}"

# 2. 环境检测与准备
VENV_PYTHON="$PROJECT_ROOT/venv/bin/python"
SYSTEM_PYTHON="python3"

# 优先使用项目根目录下的 venv
if [ -f "$VENV_PYTHON" ]; then
    PYTHON_CMD="$VENV_PYTHON"
    echo -e "${GREEN}[环境]${NC} 检测到虚拟环境，使用: $PYTHON_CMD"
else
    PYTHON_CMD="$SYSTEM_PYTHON"
    echo -e "${YELLOW}[环境]${NC} 未检测到 venv，尝试使用系统 Python: $PYTHON_CMD"
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[错误]${NC} 未找到 npm 命令，请先安装 Node.js"
    exit 1
fi

# 3. 启动后端
echo -e "\n${BLUE}[1/2] 正在启动后端服务...${NC}"

# 检查 8000 端口占用
PID_8000=$(lsof -t -i:8000 -sTCP:LISTEN 2>/dev/null)
if [ ! -z "$PID_8000" ]; then
    echo -e "${YELLOW}[警告]${NC} 端口 8000 被占用 (PID: $PID_8000)，尝试关闭..."
    kill -9 $PID_8000
    sleep 1
fi

cd "$PROJECT_ROOT/backend"
# 启动后端并重定向日志
# 注意: main.py 内部调用了 uvicorn.run
nohup $PYTHON_CMD main.py > "$PROJECT_ROOT/backend.log" 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}[成功]${NC} 后端已启动 (PID: $BACKEND_PID)"
echo -e "       日志文件: $PROJECT_ROOT/backend.log"

# 等待后端稍微初始化
sleep 2

# 4. 启动前端
echo -e "\n${BLUE}[2/2] 正在启动前端服务...${NC}"

# 检查 5173 端口占用
PID_5173=$(lsof -t -i:5173 -sTCP:LISTEN 2>/dev/null)
if [ ! -z "$PID_5173" ]; then
    echo -e "${YELLOW}[警告]${NC} 端口 5173 被占用 (PID: $PID_5173)，尝试关闭..."
    kill -9 $PID_5173
    sleep 1
fi

cd "$PROJECT_ROOT/frontend"
# 启动前端
nohup npm run dev -- --host > "$PROJECT_ROOT/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}[成功]${NC} 前端已启动 (PID: $FRONTEND_PID)"
echo -e "       日志文件: $PROJECT_ROOT/frontend.log"

# 5. 完成与守候
echo -e "\n${BLUE}========================================${NC}"
echo -e "服务运行中! 请访问:"
echo -e "前端页面: ${GREEN}http://localhost:5173${NC} (或内网IP)"
echo -e "后端 API: ${GREEN}http://localhost:8000${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}提示: 按 Ctrl+C 停止所有服务${NC}"

# 捕获退出信号，清理子进程
cleanup() {
    echo -e "\n${RED}[停止]${NC} 正在停止所有服务..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    wait $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}[完成]${NC} 服务已全部停止"
    exit
}

trap cleanup SIGINT SIGTERM

# 保持脚本运行，直到收到信号
wait
