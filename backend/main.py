import os
import sys
import yaml

# Support for Intranet Binary: Load config.yaml if exists
if os.path.exists("config.yaml"):
    try:
        with open("config.yaml", "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
            if config:
                # Parse Database Config
                if "database" in config:
                    db = config["database"]
                    if "host" in db: os.environ["DB_HOST"] = str(db["host"])
                    if "port" in db: os.environ["DB_PORT"] = str(db["port"])
                    if "user" in db: os.environ["DB_USER"] = str(db["user"])
                    if "password" in db: os.environ["DB_PASSWORD"] = str(db["password"])
                    if "dbname" in db: os.environ["DB_NAME"] = str(db["dbname"])

                # Parse LLM Config
                if "llm" in config:
                    llm = config["llm"]
                    if "provider" in llm: os.environ["LLM_PROVIDER"] = str(llm["provider"])
                    if "api_key" in llm: os.environ["LLM_API_KEY"] = str(llm["api_key"])
                    if "chat_base_url" in llm: os.environ["LLM_BASE_URL"] = str(llm["chat_base_url"]).strip().strip('`').strip()
                    if "model" in llm: os.environ["LLM_MODEL"] = str(llm["model"])
                    if "embedding_base_url" in llm: os.environ["EMBEDDING_BASE_URL"] = str(llm["embedding_base_url"]).strip().strip('`').strip()
                    if "embedding_model" in llm: os.environ["EMBEDDING_MODEL"] = str(llm["embedding_model"])

                # Parse Server Config
                if "server" in config:
                    srv = config["server"]
                    if "host" in srv: os.environ["HOST"] = str(srv["host"])
                    if "port" in srv: os.environ["PORT"] = str(srv["port"])

                # Parse flat keys (legacy support)
                for key, value in config.items():
                    if isinstance(value, (str, int, float, bool)):
                         os.environ[str(key)] = str(value)
                print("Loaded configuration from config.yaml")
    except Exception as e:
        print(f"Error loading config.yaml: {e}")

from fastapi import FastAPI, Request, UploadFile, File, Depends, HTTPException, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
import uuid
import os
import shutil
import jinja2 # Force import for PyInstaller
import markupsafe # Force import for PyInstaller
from collections import Counter, deque
from llm.factory import get_llm_client
from rag.qa import answer_question
from rag.loader import load_document, load_text_content, delete_document_by_source
from db import engine
from sqlalchemy import text
from typing import List
from datetime import timedelta, datetime
import io
import base64
from captcha.image import ImageCaptcha

import json

# Import Auth
from auth import (
    User, UserInDB, Token, authenticate_user, create_access_token, 
    get_current_active_user, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES
)


# 数据库初始化 (适配 Docker/Mac 首次运行)
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    try:
        with engine.connect() as conn:
            # 启用 pgvector 扩展
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            # 创建 documents 表 (Zhipu embedding-2 维度为 1024)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS documents (
                    id SERIAL PRIMARY KEY,
                    content TEXT,
                    metadata JSONB,
                    embedding vector(1024)
                )
            """))
            # 创建 chat_logs 表 (用于记录完整问答和反馈)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS chat_logs (
                    id SERIAL PRIMARY KEY,
                    question TEXT NOT NULL,
                    answer TEXT,
                    feedback VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            # Add username column if not exists
            try:
                conn.execute(text("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS username VARCHAR(50)"))
                conn.execute(text("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS image_path VARCHAR(512)"))
                conn.execute(text("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'normal'"))
                conn.execute(text("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS sources JSONB"))
            except Exception as e:
                print(f"Migration note: {e}")

            # Create learned_qa table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS learned_qa (
                    id SERIAL PRIMARY KEY,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            try:
                conn.execute(text("ALTER TABLE learned_qa ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'"))
                conn.execute(text("ALTER TABLE learned_qa ADD COLUMN IF NOT EXISTS username VARCHAR(50)"))
            except Exception as e:
                print(f"Migration note (learned_qa): {e}")
            
            # 创建 question_history 表 (保留旧表定义以免报错，后续可迁移)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS question_history (
                    id SERIAL PRIMARY KEY,
                    question TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))

            # Create Users Table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    hashed_password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) NOT NULL
                )
            """))

            # Create Uploaded Files Table (for approval workflow)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS uploaded_files (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(255) NOT NULL,
                    file_path VARCHAR(512) NOT NULL,
                    uploader VARCHAR(50) NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            # Add new columns for Knowledge Docs feature
            try:
                conn.execute(text("ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0"))
                conn.execute(text("ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0"))
            except Exception as e:
                print(f"Migration note (uploaded_files): {e}")
            conn.commit()
            
            # Seed Default Users
            # Check if admin exists
            result = conn.execute(text("SELECT username FROM users WHERE username = 'admin'")).fetchone()
            if not result:
                admin_pwd = get_password_hash("admin123")
                conn.execute(text("INSERT INTO users (username, hashed_password, role) VALUES ('admin', :pwd, 'admin')"), {"pwd": admin_pwd})
                print("Created default admin user")
            
            result = conn.execute(text("SELECT username FROM users WHERE username = 'user'")).fetchone()
            if not result:
                user_pwd = get_password_hash("user123")
                conn.execute(text("INSERT INTO users (username, hashed_password, role) VALUES ('user', :pwd, 'user')"), {"pwd": user_pwd})
                print("Created default normal user")
                
            conn.commit()

        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"⚠️ Database initialization failed: {e}")
    
    yield
    # Shutdown logic (if any)

# 初始化 FastAPI
app = FastAPI(lifespan=lifespan)

# Mount user images directory
if not os.path.exists("user_images"):
    os.makedirs("user_images")
app.mount("/user_images", StaticFiles(directory="user_images"), name="user_images")

# CAPTCHA Store (In-memory for simplicity)
CAPTCHA_STORE = {}

# Local file persistence for questions
QUESTION_HISTORY_FILE = "question_history.json"

def load_question_history():
    if os.path.exists(QUESTION_HISTORY_FILE):
        try:
            with open(QUESTION_HISTORY_FILE, "r", encoding="utf-8") as f:
                return deque(json.load(f), maxlen=500)
        except Exception as e:
            print(f"Error loading question history: {e}")
    return deque(maxlen=500)

def save_question_history(buffer):
    try:
        with open(QUESTION_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(list(buffer), f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving question history: {e}")

question_buffer = load_question_history()

# 允许跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境应限制为前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 使用 Jinja2 模板
templates = Jinja2Templates(directory="templates")

# Frontend Static Files Logic
# If frozen (PyInstaller), sys._MEIPASS/static
# If dev/local, check backend/static or frontend/dist (fallback)

if getattr(sys, 'frozen', False):
    # PyInstaller bundled mode
    BASE_DIR = sys._MEIPASS
    STATIC_DIR = os.path.join(BASE_DIR, "static")
else:
    # Development mode
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    STATIC_DIR = os.path.join(BASE_DIR, "static")
    
    # Fallback for dev if static doesn't exist but dist_frontend does (legacy/dev support)
    if not os.path.exists(STATIC_DIR) and os.path.exists("dist_frontend"):
        STATIC_DIR = "dist_frontend"

if os.path.exists(STATIC_DIR):
    # Mount assets (CSS, JS, Images from Vite build)
    app.mount("/assets", StaticFiles(directory=f"{STATIC_DIR}/assets"), name="assets")

# 创建一个 Pydantic 模型来接收请求的 body
class QuestionRequest(BaseModel):
    question: str
    image: str | None = None

class PolishRequest(BaseModel):
    question: str
    draft_answer: str

class FeedbackRequest(BaseModel):
    question_id: int
    status: str  # 'solved' or 'unsolved'

# 显示前端页面
@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    if os.path.exists(STATIC_DIR):
        return FileResponse(f"{STATIC_DIR}/index.html")
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/captcha")
def get_captcha():
    image = ImageCaptcha(width=280, height=90)
    # Generate 4 char code
    captcha_text = "".join([str(uuid.uuid4().hex[i]) for i in range(4)])
    captcha_id = str(uuid.uuid4())
    
    data = image.generate(captcha_text)
    image_b64 = base64.b64encode(data.read()).decode('utf-8')
    
    CAPTCHA_STORE[captcha_id] = captcha_text
    # Cleanup old captchas? (Skipped for now, but in prod use Redis with TTL)
    
    return {"captcha_id": captcha_id, "image": f"data:image/png;base64,{image_b64}"}

# Login Endpoint
@app.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    captcha_id: str = Form(None),
    captcha_code: str = Form(None)
):
    # Verify Captcha
    if not captcha_id or not captcha_code:
         raise HTTPException(status_code=400, detail="验证码不能为空")
    
    stored_code = CAPTCHA_STORE.get(captcha_id)
    if not stored_code:
        raise HTTPException(status_code=400, detail="验证码已过期")
    
    if stored_code.lower() != captcha_code.lower():
        raise HTTPException(status_code=400, detail="验证码错误")
    
    # Remove used captcha
    del CAPTCHA_STORE[captcha_id]

    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "username": user.username}

class RegisterRequest(BaseModel):
    username: str
    password: str

@app.post("/register", response_model=Token)
async def register(request: RegisterRequest):
    if request.username == "admin":
         raise HTTPException(status_code=400, detail="Cannot register as admin")

    # Check if user exists
    with engine.begin() as conn:
        existing = conn.execute(text("SELECT username FROM users WHERE username = :u"), {"u": request.username}).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        # Create user (force role='user')
        hashed_pwd = get_password_hash(request.password)
        conn.execute(
            text("INSERT INTO users (username, hashed_password, role) VALUES (:u, :p, 'user')"),
            {"u": request.username, "p": hashed_pwd}
        )
    
    # Auto login
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": request.username, "role": "user"}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": "user", "username": request.username}

@app.post("/guest-token", response_model=Token)
async def guest_token():
    # Generate random guest ID
    guest_id = f"guest_{uuid.uuid4().hex[:8]}"
    
    # Add guest user with random password
    with engine.begin() as conn:
        random_pwd = get_password_hash(uuid.uuid4().hex)
        conn.execute(
            text("INSERT INTO users (username, hashed_password, role) VALUES (:u, :p, 'guest')"),
            {"u": guest_id, "p": random_pwd}
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": guest_id, "role": "guest"}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": "guest", "username": guest_id}

# 文档上传接口
@app.post("/upload_doc")
def upload_document(
    files: List[UploadFile] = File(...),
    target_kb: str = Form("admin"), # 'admin' (Ops KB) or 'user' (User KB)
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role == 'guest':
        raise HTTPException(status_code=403, detail="访客用户禁止上传知识库")
        
    results = []
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)

    # Determine status based on role
    # Admin -> Approved (Direct Ingestion)
    # User -> Pending (Needs Approval)
    is_admin = current_user.role == 'admin'
    status_code = "approved" if is_admin else "pending"
    
    # KB Type determination
    # If admin, use target_kb (default 'admin' which is Ops KB)
    # If user, forcing to 'user' eventually, but initially pending
    kb_type = target_kb if is_admin else 'user'
    
    MAX_FILE_SIZE = 100 * 1024 * 1024 # 100MB

    for file in files:
        try:
            # Check file size
            file.file.seek(0, 2)
            size = file.file.tell()
            file.file.seek(0)
            
            if size > MAX_FILE_SIZE:
                 results.append({"filename": file.filename, "status": "error", "message": "文件大小超过100MB限制"})
                 continue

            file_path = os.path.join(upload_dir, file.filename)
            
            # 保存文件
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            # Record in uploaded_files table
            with engine.begin() as conn:
                conn.execute(
                    text("INSERT INTO uploaded_files (filename, file_path, uploader, status, file_size) VALUES (:f, :p, :u, :s, :sz)"),
                    {"f": file.filename, "p": file_path, "u": current_user.username, "s": status_code, "sz": size}
                )

            if is_admin:
                # 入库
                metadata = {
                    "source": file_path,
                    "filename": file.filename,
                    "type": "user_upload",
                    "uploader": current_user.username,
                    "upload_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                
                # 调用 loader 进行入库，传入 kb_type
                load_document(file_path, metadata, kb_type=kb_type)
                results.append({"filename": file.filename, "status": "success", "message": f"上传并入库成功 ({kb_type} 库)"})
            else:
                results.append({"filename": file.filename, "status": "pending", "message": "上传成功，等待管理员审批"})
            
        except Exception as e:
            results.append({"filename": file.filename, "status": "error", "message": str(e)})

    return {"results": results}

@app.get("/pending_docs")
def get_pending_docs(current_user: User = Depends(get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Permission denied")
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, filename, uploader, created_at FROM uploaded_files WHERE status = 'pending' ORDER BY created_at DESC")).fetchall()
        # Convert to list of dicts
        docs = [{"id": row[0], "filename": row[1], "uploader": row[2], "created_at": str(row[3])} for row in result]
    return {"docs": docs}

@app.get("/download_doc/{doc_id}")
def download_doc(doc_id: int, current_user: User = Depends(get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Permission denied")
    
    with engine.connect() as conn:
        row = conn.execute(text("SELECT filename, file_path FROM uploaded_files WHERE id = :id"), {"id": doc_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        
        filename, file_path = row
        
        if not os.path.exists(file_path):
             raise HTTPException(status_code=404, detail="File not found on disk")
             
        return FileResponse(path=file_path, filename=filename, media_type='application/octet-stream')

@app.get("/download_source/{doc_id}")
def download_source(doc_id: int, current_user: User = Depends(get_current_active_user)):
    """
    Download document based on vector DB document ID.
    Used for retrieving sources referenced in RAG answers.
    """
    with engine.connect() as conn:
        # Get source path from documents table metadata
        row = conn.execute(
            text("SELECT metadata->>'source' as source, metadata->>'filename' as filename FROM documents WHERE id = :id"), 
            {"id": doc_id}
        ).fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_path = row[0]
        filename = row[1]
        
        if not file_path or not os.path.exists(file_path):
             raise HTTPException(status_code=404, detail="File not found on disk")
             
        # Security check: Ensure file is within allowed directories (optional but recommended)
        # For now, we assume internal files are safe to read if they are in the DB.
             
        return FileResponse(path=file_path, filename=filename or os.path.basename(file_path), media_type='application/octet-stream')

@app.post("/approve_doc/{doc_id}")
def approve_doc(doc_id: int, current_user: User = Depends(get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Permission denied")
    
    with engine.begin() as conn:
        # Get file info
        row = conn.execute(text("SELECT filename, file_path, uploader, created_at FROM uploaded_files WHERE id = :id AND status = 'pending'"), {"id": doc_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found or not pending")
        
        filename, file_path, uploader, created_at = row
        
        # Ingest
        try:
            metadata = {
                "source": file_path,
                "filename": filename,
                "type": "user_upload",
                "uploader": uploader,
                "upload_time": created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            # Approve -> Ingest into 'user' KB (since uploader was likely 'user')
            load_document(file_path, metadata, kb_type="user")
            
            # Update status
            conn.execute(text("UPDATE uploaded_files SET status = 'approved' WHERE id = :id"), {"id": doc_id})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

    return {"message": "Document approved and ingested"}

@app.post("/reject_doc/{doc_id}")
def reject_doc(doc_id: int, current_user: User = Depends(get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Permission denied")
    
    with engine.begin() as conn:
        result = conn.execute(text("UPDATE uploaded_files SET status = 'rejected' WHERE id = :id AND status = 'pending'"), {"id": doc_id})
        if result.rowcount == 0:
             raise HTTPException(status_code=404, detail="Document not found or not pending")
    
    return {"message": "Document rejected"}

@app.get("/admin/chat_logs")
def get_admin_chat_logs(page: int = 1, limit: int = 20, current_user: User = Depends(get_current_active_user)):
    # Allow admin and regular users to view chat logs
    if current_user.role not in ['admin', 'user']:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    offset = (page - 1) * limit
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM chat_logs")).scalar()
        result = conn.execute(
            text("SELECT id, username, question, answer, image_path, created_at, sources FROM chat_logs ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),
            {"limit": limit, "offset": offset}
        ).fetchall()
        
        logs = []
        for row in result:
            logs.append({
                "id": row[0],
                "username": row[1],
                "question": row[2],
                "answer": row[3],
                "image_path": row[4],
                "created_at": str(row[5]),
                "sources": row[6] if row[6] else []
            })
            
    return {"total": total, "logs": logs, "page": page, "limit": limit}


@app.post("/reprocess_docs")
def reprocess_docs(force: bool = False):
    """
    Trigger ingestion of files in the uploads directory.
    Also handles deletion of files that are no longer on disk (Sync).
    """
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        return {"message": "Uploads directory does not exist", "count": 0}
    
    # 1. Get all files on disk
    disk_files = set()
    for filename in os.listdir(upload_dir):
        file_path = os.path.join(upload_dir, filename)
        if os.path.isfile(file_path):
             disk_files.add(file_path)
             
    # 2. Get all sources in DB
    db_files = set()
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT DISTINCT metadata->>'source' FROM documents")).fetchall()
            # Only consider files that look like they are in 'uploads/' to avoid deleting other things
            for row in result:
                source = row[0]
                if source and source.startswith(upload_dir + os.sep):
                    db_files.add(source)
    except Exception as e:
        print(f"Error fetching existing sources: {e}")
        return {"message": f"Database error: {str(e)}", "processed": 0}

    # 3. Calculate diff
    # Files to add: on disk but not in DB
    files_to_add = disk_files - db_files
    # Files to delete: in DB but not on disk
    files_to_delete = db_files - disk_files
    
    deleted_count = 0
    processed_count = 0
    skipped_count = 0
    errors = []
    
    # 4. Handle Deletions
    if files_to_delete:
        try:
            with engine.begin() as conn:
                for source in files_to_delete:
                    # Delete from documents (vector store)
                    conn.execute(text("DELETE FROM documents WHERE metadata->>'source' = :s"), {"s": source})
                    # Delete from uploaded_files table to sync UI status
                    conn.execute(text("DELETE FROM uploaded_files WHERE file_path = :s"), {"s": source})
                    deleted_count += 1
        except Exception as e:
             errors.append(f"Deletion error: {str(e)}")

    # 5. Handle Additions
    files_to_process = disk_files if force else files_to_add
    
    if not force:
        skipped_count = len(disk_files) - len(files_to_add)

    for file_path in files_to_process:
        try:
             filename = os.path.basename(file_path)
             upload_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
             metadata = {
                 "source": file_path,
                 "filename": filename,
                 "type": "manual_reprocess",
                 "upload_time": upload_time
             }
             # Default to user KB for auto-reprocess
             load_document(file_path, metadata, kb_type="user")
             processed_count += 1
             
             # Add to uploaded_files if not exists (to show in Admin UI)
             with engine.begin() as conn:
                 res = conn.execute(text("SELECT id FROM uploaded_files WHERE file_path = :p"), {"p": file_path}).fetchone()
                 if not res:
                     file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
                     conn.execute(
                        text("INSERT INTO uploaded_files (filename, file_path, uploader, status, file_size) VALUES (:f, :p, :u, :s, :sz)"),
                        {"f": filename, "p": file_path, "u": "system_scan", "s": "approved", "sz": file_size}
                    )
        except Exception as e:
             errors.append(f"{os.path.basename(file_path)}: {str(e)}")
             
    msg = f"已同步：新增 {processed_count} 个，剔除 {deleted_count} 个"
    if skipped_count > 0:
        msg += f"，跳过 {skipped_count} 个现有文件"
    if errors:
        msg += f" (有 {len(errors)} 个错误)"
    
    return {
        "message": msg,
        "processed": processed_count,
        "deleted": deleted_count,
        "skipped": skipped_count,
        "errors": errors
    }

@app.get("/hot_questions")
def get_hot_questions():
    questions = []
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT question, COUNT(*) as count 
                FROM chat_logs 
                GROUP BY question 
                ORDER BY count DESC 
                LIMIT 10
            """)).fetchall()
            questions = [row[0] for row in result]
    except Exception as e:
        print(f"Database error in hot_questions (using buffer fallback): {e}")
        # Fallback to buffer if DB fails
        questions = [q for q, _ in Counter(question_buffer).most_common(10)]
    
    try:
        # Fill with default questions if not enough
        default_questions = [
            "系统无法登录怎么办？",
            "数据库连接超时如何排查？",
            "服务器 CPU 使用率过高",
            "如何查看系统日志？",
            "应用部署失败，报错 502",
            "磁盘空间不足怎么清理？",
            "规划天线经纬度和铁塔经纬度误差在多少米校验",
            "如何新增知识库文档？",
            "Nginx 配置反向代理",
            "内存泄漏排查步骤"
        ]
        for q in default_questions:
            if len(questions) >= 10:
                break
            if q not in questions:
                questions.append(q)
        return {"questions": questions}
    except Exception as e:
        print(f"Error processing hot questions: {e}")
        return {"questions": default_questions}

class LearnRequest(BaseModel):
    question_id: int
    answer: str

class ManualQARequest(BaseModel):
    question: str
    answer: str

@app.get("/admin/unknown_questions")
def get_unknown_questions(page: int = 1, limit: int = 20, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ['admin', 'user']:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    offset = (page - 1) * limit
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM chat_logs WHERE status = 'unknown'")).scalar()
        result = conn.execute(
            text("SELECT id, username, question, answer, image_path, created_at FROM chat_logs WHERE status = 'unknown' ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),
            {"limit": limit, "offset": offset}
        ).fetchall()
        
        logs = []
        for row in result:
            logs.append({
                "id": row[0],
                "username": row[1],
                "question": row[2],
                "answer": row[3],
                "image_path": row[4],
                "created_at": str(row[5])
            })
            
    return {"total": total, "logs": logs, "page": page, "limit": limit}

@app.post("/admin/learn")
def learn_question(req: LearnRequest, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ['admin', 'user']:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    is_admin = (current_user.role == 'admin')
    
    with engine.begin() as conn:
        # Get question text
        row = conn.execute(text("SELECT question FROM chat_logs WHERE id = :id"), {"id": req.question_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Question log not found")
        question = row[0]
        
        if is_admin:
            # 1. Update chat_logs status
            conn.execute(text("UPDATE chat_logs SET status = 'learned' WHERE id = :id"), {"id": req.question_id})
            
            # 2. Insert into learned_qa
            conn.execute(
                text("INSERT INTO learned_qa (question, answer, status, username) VALUES (:q, :a, 'approved', :u)"),
                {"q": question, "a": req.answer, "u": current_user.username}
            )
            
            # 3. Ingest into Vector DB
            metadata = {
                "source": "learned_qa",
                "type": "learned_qa",
                "question": question,
                "added_by": current_user.username,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            # Combine Q and A for better retrieval context
            content = f"问题：{question}\n答案：{req.answer}"
            
            # Call load_text_content inside try/except block AFTER transaction or assume safe
            # We'll set a flag to do it outside
            do_ingest = True
            ingest_content = content
            ingest_metadata = metadata
        else:
            # Regular user: Submit for approval
            # 1. Update chat_logs status to remove from unknown list
            conn.execute(text("UPDATE chat_logs SET status = 'pending_learn' WHERE id = :id"), {"id": req.question_id})
            
            # 2. Insert into learned_qa with pending status
            conn.execute(
                text("INSERT INTO learned_qa (question, answer, status, username) VALUES (:q, :a, 'pending', :u)"),
                {"q": question, "a": req.answer, "u": current_user.username}
            )
            do_ingest = False

    if do_ingest:
        try:
            load_text_content(ingest_content, ingest_metadata)
        except Exception as e:
            print(f"Error ingesting learned QA: {e}")
            return {"status": "partial_success", "message": "Learned but vector ingestion failed"}

    return {"status": "success", "message": "Question learned and ingested" if is_admin else "Question submitted for approval"}

@app.post("/admin/polish_answer")
def polish_answer(req: PolishRequest, current_user: User = Depends(get_current_active_user)):
    try:
        llm = get_llm_client()
        prompt = f"""
你是一个专业的运维助手。请对以下问答对中的答案进行**轻微润色**。
要求：
1. 保持原意，不要过度发散或添加无关信息。
2. 专业术语准确，语言言简意赅。
3. 仅在必要时进行语法或逻辑修正。

问题：{req.question}
草稿答案：{req.draft_answer}

请直接输出优化后的答案内容，不要包含任何解释或开场白。
"""
        # llm.chat expects a list of messages
        messages = [{"role": "user", "content": prompt}]
        polished_answer = llm.chat(messages)
        return {"status": "success", "polished_answer": polished_answer.strip()}
    except Exception as e:
        print(f"Error polishing answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/add_qa")
def add_qa(req: ManualQARequest, current_user: User = Depends(get_current_active_user)):
    # Regular users can now submit, but with pending status
    # if current_user.role != 'admin':
    #     raise HTTPException(status_code=403, detail="Permission denied")
        
    question = req.question.strip()
    answer = req.answer.strip()
    
    if not question or not answer:
        raise HTTPException(status_code=400, detail="Question and Answer cannot be empty")

    status = 'approved' if current_user.role == 'admin' else 'pending'

    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO learned_qa (question, answer, status, username) VALUES (:q, :a, :s, :u)"),
            {"q": question, "a": answer, "s": status, "u": current_user.username}
        )
        
        # Only ingest if approved immediately (Admin)
        if status == 'approved':
             # Ingest logic similar to learn
             content = f"问题：{question}\n答案：{answer}"
             metadata = {
                "source": "manual_qa",
                "type": "manual_qa",
                "question": question,
                "added_by": current_user.username,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
             }
             try:
                 load_text_content(content, metadata)
             except Exception as e:
                 print(f"Error ingesting manual QA: {e}")

    return {"status": "success", "message": "Q&A added" if status == 'approved' else "Q&A submitted for approval"}

@app.get("/admin/learning_records")
def get_learning_records(page: int = 1, limit: int = 10, current_user: User = Depends(get_current_active_user)):
    # Both admin and user can view learning records
    offset = (page - 1) * limit
    
    with engine.connect() as conn:
        # Get total count
        total = conn.execute(text("SELECT COUNT(*) FROM learned_qa")).scalar()
        
        # Get records
        query = text("""
            SELECT id, question, answer, status, username, created_at 
            FROM learned_qa 
            ORDER BY id DESC 
            LIMIT :limit OFFSET :offset
        """)
        
        rows = conn.execute(query, {"limit": limit, "offset": offset}).fetchall()
        
        records = []
        for row in rows:
            records.append({
                "id": row[0],
                "question": row[1],
                "answer": row[2],
                "status": row[3],
                "username": row[4],
                "created_at": row[5].strftime("%Y-%m-%d %H:%M:%S") if row[5] else ""
            })
            
        return {"records": records, "total": total}

@app.get("/admin/pending_qa")
def get_pending_qa(page: int = 1, limit: int = 20, current_user: User = Depends(get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Permission denied")
    
    offset = (page - 1) * limit
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM learned_qa WHERE status = 'pending'")).scalar()
        
        result = conn.execute(
            text("SELECT id, question, answer, username, created_at FROM learned_qa WHERE status = 'pending' ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),
            {"limit": limit, "offset": offset}
        ).fetchall()
        
        items = []
        for row in result:
            items.append({
                "id": row[0],
                "question": row[1],
                "answer": row[2],
                "username": row[3],
                "created_at": str(row[4])
            })
            
    return {"total": total, "items": items, "page": page, "limit": limit}

@app.post("/admin/approve_qa/{qa_id}")
def approve_qa(qa_id: int, current_user: User = Depends(get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Permission denied")
        
    with engine.begin() as conn:
        row = conn.execute(text("SELECT question, answer, username FROM learned_qa WHERE id = :id"), {"id": qa_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="QA not found")
            
        question, answer, username = row
        
        # Update status
        conn.execute(text("UPDATE learned_qa SET status = 'approved' WHERE id = :id"), {"id": qa_id})
        
        # Ingest
        metadata = {
            "source": "learned_qa",
            "type": "learned_qa",
            "question": question,
            "added_by": username or current_user.username,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        content = f"问题：{question}\n答案：{answer}"
        
    try:
        load_text_content(content, metadata)
    except Exception as e:
        print(f"Error ingesting approved QA: {e}")
        return {"status": "partial_success", "message": "Approved but vector ingestion failed"}
        
    return {"status": "success", "message": "QA approved and added to KB"}

@app.post("/admin/reject_qa/{qa_id}")
def reject_qa(qa_id: int, current_user: User = Depends(get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Permission denied")
        
    with engine.begin() as conn:
        # Update status to rejected (or delete?) - Let's keep it as rejected
        result = conn.execute(text("UPDATE learned_qa SET status = 'rejected' WHERE id = :id"), {"id": qa_id})
        if result.rowcount == 0:
             raise HTTPException(status_code=404, detail="QA not found")
             
    return {"status": "success", "message": "QA rejected"}

@app.post("/admin/discard_unknown/{id}")
def discard_unknown_question(id: int, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ['admin', 'user']:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    with engine.begin() as conn:
        result = conn.execute(text("UPDATE chat_logs SET status = 'discarded' WHERE id = :id"), {"id": id})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Question log not found")
            
    return {"status": "success", "message": "Question discarded"}

# 接受用户问题并返回答案
@app.post("/get_answer")
def get_answer(req: QuestionRequest, current_user: User = Depends(get_current_active_user)):
    question = req.question
    image_data = req.image
    
    # Guest Limit Check
    if current_user.role == 'guest':
        with engine.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM chat_logs WHERE username = :u"), {"u": current_user.username}).scalar()
            if count >= 5:
                return {
                    "answer": "您是访客用户，提问次数已达上限 (5次)。请注册或登录以继续使用。",
                    "sources": [],
                    "images": []
                }
    
    # 记录问题历史 (Legacy file)
    question_buffer.appendleft(question)
    save_question_history(question_buffer)
    
    # 记录问题历史 (DB - question_history)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO question_history (question) VALUES (:q)"), {"q": question})

    # Save user image if present
    saved_image_path = None
    if image_data:
        try:
            # image_data is base64 string
            if "," in image_data:
                header, encoded = image_data.split(",", 1)
            else:
                encoded = image_data
            
            data = base64.b64decode(encoded)
            # Simple unique filename
            filename = f"{uuid.uuid4()}.png"
            save_path = os.path.join("user_images", filename)
            with open(save_path, "wb") as f:
                f.write(data)
            saved_image_path = filename
        except Exception as e:
            print(f"Error saving user image: {e}")

    # Step 1: Check learned_qa (Direct Answer)
    # Only do this if no image is present (assuming learned QA is text-based)
    # If image is present, better to rely on RAG/Vision model
    answer = None
    sources = []
    images = []
    is_learned = False
    
    if not image_data:
        with engine.connect() as conn:
            # Try exact match first
            try:
                # Check if learned_qa table exists to avoid errors during initial migration
                learned = conn.execute(text("SELECT answer FROM learned_qa WHERE question = :q ORDER BY created_at DESC LIMIT 1"), {"q": question}).fetchone()
                if learned:
                    answer = learned[0]
                    is_learned = True
            except Exception as e:
                # Table might not exist yet if startup hasn't run fully or connection issue
                print(f"Error checking learned_qa: {e}")
    
    if not answer:
        # Step 2: Call RAG logic
        # Pass user role to answer_question to filter KB
        # Map guest to user KB, admin to all
        kb_type = current_user.role
        if kb_type == 'guest':
            kb_type = 'user'
        elif kb_type == 'admin':
            kb_type = 'all'
            
        rag_result = answer_question(question, image_data, kb_type=kb_type)
        if isinstance(rag_result, dict):
            answer = rag_result.get("answer")
            sources = rag_result.get("sources", [])
        else:
            answer = rag_result
            sources = []

    # Step 3: Determine Status
    # Default status
    status_code = "normal"
    if is_learned:
        status_code = "learned"
    else:
        # Check for unknown keywords
        unknown_keywords = ["未在现有运维知识库中找到", "我不知道", "无法回答"]
        for kw in unknown_keywords:
            if kw in answer:
                status_code = "unknown"
                # If unknown, clear sources to avoid confusion
                sources = []
                break

        # Log chat to DB (with username, image_path, status, sources)
    question_id = None
    with engine.begin() as conn:
        result = conn.execute(
            text("INSERT INTO chat_logs (question, answer, username, image_path, status, sources) VALUES (:q, :a, :u, :i, :s, :src) RETURNING id"),
            {"q": question, "a": answer, "u": current_user.username, "i": saved_image_path, "s": status_code, "src": json.dumps(sources)}
        )
        question_id = result.scalar()

    return {"answer": answer, "sources": sources, "images": images, "question_id": question_id}

@app.post("/feedback")
def submit_feedback(request: FeedbackRequest):
    try:
        with engine.begin() as conn:
            conn.execute(
                text("UPDATE chat_logs SET feedback = :status WHERE id = :id"),
                {"status": request.status, "id": request.question_id}
            )
        return {"message": "Feedback received"}
    except Exception as e:
        print(f"Error saving feedback: {e}")
        return {"error": str(e)}


@app.get("/debug/db_status")
def debug_db_status():
    info = {"buffer_len": len(question_buffer)}
    try:
        with engine.connect() as conn:
            exists = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'question_history'
                )
            """)).scalar()
            info["question_history_exists"] = bool(exists)
            if exists:
                count = conn.execute(text("SELECT COUNT(*) FROM question_history")).scalar()
                info["question_history_count"] = int(count)
            
            # Check users
            users_count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
            info["users_count"] = int(users_count)
            
            return info
    except Exception as e:
        return {"error": str(e)}

# Knowledge Documents APIs

@app.get("/documents/search")
def search_documents(
    q: str = "", 
    page: int = 1, 
    limit: int = 20, 
    current_user: User = Depends(get_current_active_user)
):
    # Allow all users to search approved documents
    offset = (page - 1) * limit
    
    with engine.connect() as conn:
        # Build query
        base_query = "SELECT id, filename, uploader, created_at, file_size, download_count FROM uploaded_files WHERE status = 'approved'"
        params = {"limit": limit, "offset": offset}
        
        if q:
            base_query += " AND filename ILIKE :q"
            params["q"] = f"%{q}%"
            
        # Count total
        count_query = f"SELECT COUNT(*) FROM ({base_query}) as sub"
        total = conn.execute(text(count_query), params).scalar()
        
        # Get data
        data_query = base_query + " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        result = conn.execute(text(data_query), params).fetchall()
        
        docs = []
        for row in result:
            docs.append({
                "id": row[0],
                "filename": row[1],
                "uploader": row[2],
                "created_at": str(row[3]),
                "file_size": row[4] if row[4] is not None else 0,
                "download_count": row[5] if row[5] is not None else 0
            })
            
    return {"total": total, "docs": docs, "page": page, "limit": limit}

@app.get("/documents/hot")
def get_hot_documents(limit: int = 10, current_user: User = Depends(get_current_active_user)):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, filename, download_count FROM uploaded_files WHERE status = 'approved' ORDER BY download_count DESC LIMIT :limit"),
            {"limit": limit}
        ).fetchall()
        
        docs = []
        for row in result:
            docs.append({
                "id": row[0],
                "filename": row[1],
                "download_count": row[2] if row[2] is not None else 0
            })
            
    return {"docs": docs}

@app.get("/documents/{doc_id}")
def download_knowledge_doc(doc_id: int, preview: bool = False, current_user: User = Depends(get_current_active_user)):
    with engine.begin() as conn: # Use begin for update transaction
        row = conn.execute(
            text("SELECT filename, file_path FROM uploaded_files WHERE id = :id AND status = 'approved'"), 
            {"id": doc_id}
        ).fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Document not found or not approved")
        
        filename, file_path = row
        
        if not os.path.exists(file_path):
             raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Increment download count
        conn.execute(text("UPDATE uploaded_files SET download_count = COALESCE(download_count, 0) + 1 WHERE id = :id"), {"id": doc_id})
        
        disposition = "inline" if preview else "attachment"
        
        # Determine media type for preview if possible, else generic
        media_type = 'application/octet-stream'
        if preview:
             ext = os.path.splitext(filename)[1].lower()
             if ext == '.pdf': media_type = 'application/pdf'
             elif ext in ['.jpg', '.jpeg']: media_type = 'image/jpeg'
             elif ext == '.png': media_type = 'image/png'
             elif ext == '.txt': media_type = 'text/plain'
        
        return FileResponse(
            path=file_path, 
            filename=filename, 
            media_type=media_type,
            content_disposition_type=disposition
        )

@app.delete("/documents/{doc_id}")
def delete_document(doc_id: int, current_user: User = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete documents")
        
    # Get file info and delete from DB in a transaction
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT filename, file_path FROM uploaded_files WHERE id = :id"), 
            {"id": doc_id}
        ).fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
            
        filename, file_path = row
        
        # 1. Delete from uploaded_files
        conn.execute(text("DELETE FROM uploaded_files WHERE id = :id"), {"id": doc_id})
        
    # 2. Delete from Vector DB (documents table) using helper
    # This ensures consistency using the 'source' (file_path) metadata
    delete_document_by_source(file_path)
        
    # 3. Delete physical file
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")
            # Continue even if file delete fails
            
    return {"status": "success", "message": f"Document '{filename}' deleted from database and knowledge base."}

# SPA Catch-all route (Must be last)
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    DIST_DIR = "dist_frontend"
    if os.path.exists(DIST_DIR):
        # Return index.html for any unknown path (SPA routing)
        # Verify it's not a static file request that missed the mount
        if "." not in full_path.split("/")[-1]: 
            return FileResponse(f"{DIST_DIR}/index.html")
    
    # Fallback to 404
    raise HTTPException(status_code=404, detail="Not Found")

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
