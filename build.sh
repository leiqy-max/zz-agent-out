#!/bin/bash
set -e

echo "[Ops-Agent] Starting build process (NC Structure)..."

# 1. Build UI (Frontend)
echo "[Ops-Agent] Building UI (ops-agent-ui)..."
cd ops-agent-ui
npm install
npm run build
cd ..

# 2. Build Backend (Biz + Core)
echo "[Ops-Agent] Building Backend Service (ops-agent-biz)..."
# 注意：构建上下文必须是项目根目录，因为 Dockerfile 需要 COPY ops-agent-core
docker build -f ops-agent-biz/Dockerfile -t ops-agent-biz:latest .

# 3. Build UI Docker Image
echo "[Ops-Agent] Building UI Docker Image..."
docker build -f ops-agent-ui/Dockerfile -t ops-agent-ui:latest ops-agent-ui

echo "[Ops-Agent] Build successfully completed!"
