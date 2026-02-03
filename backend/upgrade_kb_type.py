
import os
from sqlalchemy import text
from db import engine

def upgrade():
    with engine.begin() as conn:
        print("--- Adding kb_type column to uploaded_files ---")
        try:
            conn.execute(text("ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS kb_type VARCHAR(20) DEFAULT 'user'"))
        except Exception as e:
            print(f"Error adding column (might exist): {e}")

        print("--- Backfilling kb_type from documents ---")
        # 1. Get all uploaded files
        files = conn.execute(text("SELECT id, file_path FROM uploaded_files")).fetchall()
        
        count = 0
        for f in files:
            fid, path = f[0], f[1]
            # Match on source
            # Note: path in uploaded_files might be relative "uploads/file.ext"
            # In documents metadata->>'source', it is also that path (usually).
            
            doc = conn.execute(text("SELECT metadata->>'kb_type' FROM documents WHERE metadata->>'source' = :s LIMIT 1"), {"s": path}).fetchone()
            
            kb_type = 'user'
            if doc and doc[0]:
                kb_type = doc[0]
            
            # Update
            conn.execute(text("UPDATE uploaded_files SET kb_type = :k WHERE id = :id"), {"k": kb_type, "id": fid})
            count += 1
            
        print(f"Updated {count} records.")

if __name__ == "__main__":
    upgrade()
