import os
import sys
import json
from sqlalchemy import text
from db import engine
from rag.retriever import retrieve_similar_documents

def inspect_document(doc_id):
    print(f"\nInspecting Document ID: {doc_id}")
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT id, content, metadata FROM documents WHERE id = :id"),
            {"id": doc_id}
        ).fetchone()
        
        if result:
            print(f"ID: {result[0]}")
            print(f"Content Preview: {result[1][:100]}")
            print(f"Metadata: {json.dumps(result[2], ensure_ascii=False, indent=2)}")
        else:
            print("Document not found.")

def check_retrieval(query):
    print(f"\nChecking retrieval for: '{query}' (kb_type='all')")
    try:
        # Test with kb_type='all' first to rule out permission issues
        docs = retrieve_similar_documents(query, kb_type="all", top_k=5)
        
        print(f"{'ID':<5} | {'Distance':<10} | {'Snippet'}")
        print("-" * 50)
        for doc in docs:
            distance = doc[3] if len(doc) > 3 else 0.0
            content = doc[1][:50].replace('\n', ' ')
            print(f"{doc[0]:<5} | {distance:<10.4f} | {content}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # 1. Inspect the specific document mentioned by user (ID 4 based on screenshot)
    inspect_document(4)
    
    # 2. Test retrieval
    check_retrieval("云图平台")
