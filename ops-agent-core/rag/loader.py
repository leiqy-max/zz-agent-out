import json
import os
from sqlalchemy import text
from db import engine
from llm.embedding import embed_text
from rag.splitter import split_ops_doc

try:
    from docx import Document
except ImportError:
    Document = None

try:
    import pandas as pd
except ImportError:
    pd = None

def read_file_content(file_path: str) -> str:
    """
    Read content from file based on extension.
    """
    if file_path.endswith(".docx"):
        if not Document:
            raise ImportError("python-docx is not installed, cannot read .docx files")
        doc = Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])
    
    elif file_path.endswith(".xlsx") or file_path.endswith(".xls"):
        if not pd:
            raise ImportError("pandas/openpyxl is not installed, cannot read Excel files")
        # Read all sheets
        xls = pd.ExcelFile(file_path)
        text_content = []
        for sheet_name in xls.sheet_names:
            df = pd.read_excel(xls, sheet_name=sheet_name)
            text_content.append(f"Sheet: {sheet_name}")
            text_content.append(df.to_string(index=False))
        return "\n\n".join(text_content)

    elif file_path.endswith(".csv"):
        if not pd:
            raise ImportError("pandas is not installed, cannot read CSV files")
        df = pd.read_csv(file_path)
        return df.to_string(index=False)
        
    else:
        # Default to text/md
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

def delete_document_by_source(source: str):
    """
    Delete existing documents with the same source to avoid duplication.
    """
    try:
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM documents WHERE metadata->>'source' = :source"),
                {"source": source}
            )
            print(f"Deleted existing documents for source: {source}")
    except Exception as e:
        print(f"Error deleting existing documents: {e}")

def load_document(file_path: str, metadata: dict, kb_type: str = "user"):
    try:
        content = read_file_content(file_path)
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return

    if not content.strip():
        print(f"Warning: Empty content in {file_path}")
        return

    # Add kb_type to metadata
    metadata["kb_type"] = kb_type

    # Deduplicate before inserting
    if "source" in metadata:
        delete_document_by_source(metadata["source"])

    load_text_content(content, metadata)

def load_text_content(content: str, metadata: dict):
    chunks = split_ops_doc(content)

    with engine.begin() as conn:

        for chunk in chunks:
            vector = embed_text(chunk)
            conn.execute(
                text("""
                    INSERT INTO documents (content, metadata, embedding)
                    VALUES (:content, :metadata, :embedding)
                """),
                {
                    "content": chunk,
                    "metadata": json.dumps(metadata),
                    "embedding": vector
                }
            )
