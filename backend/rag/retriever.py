from sqlalchemy import text
from db import engine
from llm.embedding import embed_text

def retrieve_similar_documents(query: str, kb_type: str = "user", top_k: int = 3):
    query_embedding = embed_text(query)

    with engine.connect() as connection:
        # Construct SQL based on kb_type
        if kb_type == "all":
             sql = """
            SELECT id, content, metadata, embedding <-> (:query_embedding)::vector AS distance
            FROM documents
            ORDER BY distance ASC
            LIMIT :top_k;
            """
             params = {
                "query_embedding": query_embedding,
                "top_k": top_k
            }
        else:
             sql = """
            SELECT id, content, metadata, embedding <-> (:query_embedding)::vector AS distance
            FROM documents
            WHERE metadata->>'kb_type' = :kb_type OR metadata->>'kb_type' IS NULL
            ORDER BY distance ASC
            LIMIT :top_k;
            """
             params = {
                "query_embedding": query_embedding,
                "top_k": top_k,
                "kb_type": kb_type
            }

        # Use JSONB operator ->> to extract text value from metadata
        result = connection.execute(
            text(sql),
            params
        )
        
        vector_docs = result.fetchall()

    # 2. Keyword Search (Fallback/Supplement)
    # Using simple ILIKE for robustness on exact phrases
    keyword_docs = []
    try:
        with engine.connect() as connection:
            if kb_type == "all":
                sql_kw = """
                SELECT id, content, metadata, 0.0::float AS distance
                FROM documents
                WHERE content ILIKE :query
                LIMIT :top_k;
                """
                params_kw = {"query": f"%{query}%", "top_k": top_k}
            else:
                sql_kw = """
                SELECT id, content, metadata, 0.0::float AS distance
                FROM documents
                WHERE content ILIKE :query 
                AND (metadata->>'kb_type' = :kb_type OR metadata->>'kb_type' IS NULL)
                LIMIT :top_k;
                """
                params_kw = {"query": f"%{query}%", "top_k": top_k, "kb_type": kb_type}
            
            res_kw = connection.execute(text(sql_kw), params_kw).fetchall()
            keyword_docs = res_kw
    except Exception as e:
        print(f"Keyword search failed: {e}")

    # 3. Merge and Deduplicate
    # Priority: Keyword match (distance=0) > Vector match
    seen_ids = set()
    final_docs = []
    
    # Add keyword docs first (they are "exact matches")
    for doc in keyword_docs:
        if doc[0] not in seen_ids:
            final_docs.append(doc)
            seen_ids.add(doc[0])
            
    # Add vector docs
    for doc in vector_docs:
        if doc[0] not in seen_ids:
            final_docs.append(doc)
            seen_ids.add(doc[0])
            
    return final_docs[:top_k * 2] # Return slightly more to allow filtering
