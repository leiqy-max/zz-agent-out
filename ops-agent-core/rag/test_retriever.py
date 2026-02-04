from rag.retriever import retrieve_similar_documents

query = "系统A无法登录怎么办？"

documents = retrieve_similar_documents(query, top_k=3)

for content, metadata in documents:
    print("====== 文档 ======")
    print(content)
    print("------ metadata ------")
    print(metadata)
