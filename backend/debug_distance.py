import os
import sys
from sqlalchemy import text
from db import engine
from llm.embedding import embed_text

# Mock environment if needed
# os.environ["EMBEDDING_BASE_URL"] = ...

def check_distance(query):
    print(f"Checking query: {query}")
    try:
        query_embedding = embed_text(query)
    except Exception as e:
        print(f"Error embedding text: {e}")
        return

    with engine.connect() as connection:
        sql = """
        SELECT id, substring(content, 1, 50) as snippet, embedding <-> (:query_embedding)::vector AS distance
        FROM documents
        ORDER BY distance ASC
        LIMIT 5;
        """
        result = connection.execute(
            text(sql),
            {"query_embedding": query_embedding}
        ).fetchall()
        
        print(f"{'ID':<5} | {'Distance':<10} | {'Snippet'}")
        print("-" * 50)
        for row in result:
            print(f"{row[0]:<5} | {row[2]:<10.4f} | {row[1]}")

if __name__ == "__main__":
    check_distance("拓扑不存在")
