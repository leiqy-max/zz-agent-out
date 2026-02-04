from llm.factory import get_embedding_client

def embed_text(text: str) -> list[float]:
    """
    调用统一 Embedding 接口，返回向量 list[float]
    支持 ZhipuAI 和 Ollama (通过 LLM_PROVIDER 环境变量切换)
    """
    client = get_embedding_client()
    return client.embed_text(text)
