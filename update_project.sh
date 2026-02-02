#!/bin/bash

# 遇到错误立即退出
set -e

echo "=========================================="
echo "🚀 开始自动更新项目 (Auto Update Script)"
echo "=========================================="

# 1. 检查并拉取最新代码
echo "[1/4] 📥 正在从 GitHub 拉取最新代码..."
# 检查是否有未提交的本地更改
if ! git diff-index --quiet HEAD --; then
    echo "⚠️ 检测到本地有未提交的更改，正在尝试暂存 (git stash)..."
    git stash
    STASHED=true
fi

git pull origin main

if [ "$STASHED" = true ]; then
    echo "🔄 正在恢复本地更改 (git stash pop)..."
    # 尝试恢复，如果冲突则允许失败
    git stash pop || echo "⚠️ 自动合并产生冲突，请手动解决冲突！"
fi

# 2. 更新后端依赖
echo "[2/4] 🐍 正在更新后端依赖..."
if [ -d "backend/venv" ]; then
    source backend/venv/bin/activate
else
    echo "⚠️ 未找到虚拟环境，正在创建..."
    python3 -m venv backend/venv
    source backend/venv/bin/activate
fi

# 升级 pip 以防万一
pip install --upgrade pip > /dev/null 2>&1
# 安装依赖
pip install -r backend/requirements.txt

# 3. 更新前端依赖并构建
echo "[3/4] ⚛️ 正在更新前端依赖并构建..."
cd frontend
# 仅当 package.json 变化时才建议运行 npm install，但为了保险起见还是运行
npm install
npm run build
cd ..

# 4. 部署前端资源到后端目录
echo "[4/4] 📂 正在部署前端资源..."
rm -rf backend/static
cp -r frontend/dist backend/static

echo "=========================================="
echo "✅ 项目更新成功！(Update Success)"
echo "=========================================="
echo "💡 提示：如果更新了后端代码，建议重启服务。"
echo "👉 运行以下命令重启后端："
echo "   pkill -f 'python backend/main.py'"
echo "   nohup python backend/main.py > backend.log 2>&1 &"
