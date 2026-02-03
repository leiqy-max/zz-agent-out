#!/bin/bash
set -e

# Configuration
PYTHON_VERSION="3.11.10"
RELEASE_TAG="20241016"
PYTHON_ARCHIVE="cpython-${PYTHON_VERSION}+${RELEASE_TAG}-x86_64-unknown-linux-gnu-install_only.tar.gz"
PYTHON_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}/${PYTHON_ARCHIVE}"

BUILD_DIR="build_env"
PYTHON_DIR="$BUILD_DIR/python"
VENV_DIR="$BUILD_DIR/venv"

echo "Starting build process with Portable Python ${PYTHON_VERSION}..."

# 0. Build Frontend (Ensure we have the latest assets)
echo "Building Frontend..."
if [ -d "frontend" ]; then
    cd frontend
    # Use existing node_modules if present to save time/bandwidth
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    npm run build
    cd ..
else
    echo "Error: frontend directory not found!"
    exit 1
fi

# 0.1 Prepare Backend Static Directory
echo "Preparing backend/static..."
rm -rf backend/static
mkdir -p backend/static
cp -r frontend/dist/* backend/static/
echo "Frontend assets copied to backend/static."

# 1. Prepare Build Directory
mkdir -p "$BUILD_DIR"

# 2. Download Portable Python
if [ ! -d "$PYTHON_DIR" ]; then
    echo "Downloading Portable Python from $PYTHON_URL..."
    if [ -f "$BUILD_DIR/$PYTHON_ARCHIVE" ]; then
        echo "Archive found, checking integrity..."
        if ! tar -tzf "$BUILD_DIR/$PYTHON_ARCHIVE" >/dev/null 2>&1; then
            echo "Archive corrupted. Removing and redownloading..."
            rm "$BUILD_DIR/$PYTHON_ARCHIVE"
            curl -L --retry 5 --retry-delay 5 -o "$BUILD_DIR/$PYTHON_ARCHIVE" "$PYTHON_URL"
        else
             echo "Archive is good."
        fi
    else
        curl -L --retry 5 --retry-delay 5 -o "$BUILD_DIR/$PYTHON_ARCHIVE" "$PYTHON_URL"
    fi

    echo "Extracting Python..."
    tar -xzf "$BUILD_DIR/$PYTHON_ARCHIVE" -C "$BUILD_DIR"
    
    if [ ! -f "$PYTHON_DIR/bin/python3" ]; then
        echo "Error: Python binary not found at $PYTHON_DIR/bin/python3"
        exit 1
    fi
    echo "Portable Python installed."
else
    echo "Portable Python already exists in $PYTHON_DIR."
fi

# 3. Create Virtual Environment
echo "Creating virtual environment..."
rm -rf "$VENV_DIR"
"$PYTHON_DIR/bin/python3" -m venv "$VENV_DIR"

# 4. Install Dependencies
echo "Installing dependencies..."
PIP="$VENV_DIR/bin/pip"
"$PIP" install --upgrade pip
if [ -f "backend/requirements.txt" ]; then
    "$PIP" install -r backend/requirements.txt
else
    "$PIP" install -r requirements.txt
fi
"$PIP" install captcha passlib bcrypt pyyaml requests cffi python-dotenv python-jose jinja2 markupsafe pandas openpyxl python-docx
"$PIP" install "patchelf==0.17.2"
"$PIP" install pyinstaller staticx scons

# 5. Locate Dependencies
PYTHON_BIN="$VENV_DIR/bin/python3"
CAPTCHA_DIR=$("$PYTHON_BIN" -c "import captcha; import os; print(os.path.dirname(captcha.__file__))")
echo "Found captcha at: $CAPTCHA_DIR"

# 5.1 Validate Imports
echo "Validating imports..."
"$PYTHON_BIN" validate_imports.py
if [ $? -ne 0 ]; then
    echo "Validation failed! Stopping build."
    exit 1
fi
echo "Imports validated successfully."

# 6. Generate Spec File
echo "Generating PyInstaller Spec file..."
PYI_MAKESPEC="$VENV_DIR/bin/pyi-makespec"

# Generate basic spec
# Note: We include backend/static as 'static' so it's bundled at the root of the extract dir or _MEIPASS
"$PYI_MAKESPEC" --onefile --name ops-agent --noupx \
    --paths backend \
    --hidden-import requests \
    --hidden-import rag \
    --hidden-import rag.qa \
    --hidden-import rag.retriever \
    --hidden-import rag.loader \
    --hidden-import rag.splitter \
    --hidden-import llm \
    --hidden-import llm.factory \
    --hidden-import llm.mock_client \
    --hidden-import llm.ollama_client \
    --hidden-import llm.zhipu_client \
    --hidden-import llm.openai_client \
    --hidden-import openai \
    --hidden-import db \
    --hidden-import auth \
    --hidden-import uvicorn \
    --hidden-import passlib.handlers.bcrypt \
    --hidden-import _cffi_backend \
    --hidden-import pgvector.sqlalchemy \
    --hidden-import psycopg2 \
    --hidden-import pandas \
    --hidden-import openpyxl \
    --hidden-import docx \
    --hidden-import tiktoken \
    --hidden-import jinja2 \
    --hidden-import markupsafe \
    --add-data "$CAPTCHA_DIR/data:captcha/data" \
    --add-data "backend/static:static" \
    backend/main.py

# 7. Modify Spec File to Exclude Incompatible System Libraries
echo "Modifying Spec file to exclude system libraries..."
"$PYTHON_BIN" <<EOF
import sys

spec_file = 'ops-agent.spec'
with open(spec_file, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    new_lines.append(line)
    if 'a = Analysis(' in line:
        pass
    # Insert filtering logic after Analysis is done, usually before PYZ
    if 'pyz = PYZ(' in line:
        # Insert before this line
        new_lines.pop() # Remove the PYZ line momentarily
        new_lines.append("# Filter out incompatible system libraries (libgcc_s, libstdc++)\n")
        new_lines.append("a.binaries = [x for x in a.binaries if 'libgcc_s' not in x[0] and 'libstdc++' not in x[0]]\n")
        new_lines.append(line) # Put PYZ line back

with open(spec_file, 'w') as f:
    f.writelines(new_lines)
EOF

# 8. Build from Spec
echo "Building from Spec..."
PYINSTALLER="$VENV_DIR/bin/pyinstaller"
"$PYINSTALLER" --clean --noconfirm ops-agent.spec

# 9. Packaging
echo "Packaging..."
RM_DIR="ops-agent-linux-x64"
rm -rf "$RM_DIR"
mkdir -p "$RM_DIR"

cp "dist/ops-agent" "$RM_DIR/ops-agent"
cp config.yaml "$RM_DIR/"
if [ -f "INTRANET_GUIDE.md" ]; then
    cp "INTRANET_GUIDE.md" "$RM_DIR/"
fi

# Create README
cat > "$RM_DIR/README.txt" <<EOF
智能运维问答机器人 (内网单文件版)
================================

环境要求:
- Linux x64 (支持 CentOS 7+, BCLinux 8.2+, Ubuntu 20.04+)
- 数据库: PostgreSQL (需启用 pgvector 插件)
- 大模型: 支持 OpenAI 接口格式的模型 (如 DeepSeek-V3, Qwen 等)

启动步骤:
1. 确保 'config.yaml' 与 'ops-agent' 程序在同一目录下。
2. 赋予执行权限:
   chmod +x ops-agent
3. 启动程序:
   ./ops-agent

配置说明 (config.yaml):
- [database]: 配置 PostgreSQL 数据库连接信息。
- [llm]: 配置大模型接口信息。
- [server]: 配置服务监听地址和端口。

注意:
- 本程序已内置前端静态资源，无需额外的 templates 或 static 文件夹。
EOF

# Create ZIP archive using Python to avoid zip command dependency
echo "Creating ZIP archive..."
"$PYTHON_BIN" <<EOF
import shutil
import os
shutil.make_archive('ops-agent-linux-x64', 'zip', 'ops-agent-linux-x64')
EOF

echo "Build complete! Output: ops-agent-linux-x64.zip"
