#!/bin/bash

# 确保脚本在错误时停止
set -e

echo "Starting GitHub update..."

# 添加所有更改
echo "Adding changes..."
git add .

# 检查是否有需要提交的更改
if git diff-index --quiet HEAD --; then
    echo "No changes to commit."
else
    # 获取提交信息，如果没有提供参数，则使用默认信息
    COMMIT_MSG="$1"
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
    fi

    # 提交更改
    echo "Committing with message: $COMMIT_MSG"
    git commit -m "$COMMIT_MSG"
fi

# 推送到远程仓库
echo "Pushing to origin main..."
git push origin main

echo "✅ GitHub update completed successfully!"
