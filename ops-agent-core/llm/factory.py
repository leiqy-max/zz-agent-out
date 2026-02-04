import os
from .base import BaseLLM, BaseEmbedding

def get_llm_client(model: str = None) -> BaseLLM:
    provider = os.getenv("LLM_PROVIDER", "zhipu").lower()
    if provider == "ollama":
        from .ollama_client import OllamaLLM
        return OllamaLLM(model=model or os.getenv("LLM_MODEL", "qwen:7b"))
    elif provider == "mock":
        from .mock_client import MockLLM
        return MockLLM(model=model or "mock")
    elif provider in ["deepseek-v3", "openai"]:
        from .openai_client import OpenAICompatibleLLM
        return OpenAICompatibleLLM(
            model=model or os.getenv("LLM_MODEL", "DeepSeek-V3"),
            base_url=os.getenv("LLM_BASE_URL"),
            api_key=os.getenv("LLM_API_KEY")
        )
    else:
        from .zhipu_client import ZhipuLLM
        return ZhipuLLM(model=model or os.getenv("LLM_MODEL", "glm-4"))

def get_embedding_client() -> BaseEmbedding:
    provider = os.getenv("LLM_PROVIDER", "zhipu").lower()
    if provider == "ollama":
        from .ollama_client import OllamaEmbedding
        return OllamaEmbedding(model=os.getenv("EMBEDDING_MODEL", "nomic-embed-text"))
    elif provider == "mock":
        from .mock_client import MockEmbedding
        return MockEmbedding(model="mock")
    elif provider in ["deepseek-v3", "openai"]:
        from .openai_client import OpenAICompatibleEmbedding
        return OpenAICompatibleEmbedding(
            model=os.getenv("EMBEDDING_MODEL", "BAAI_bge-m3"),
            base_url=os.getenv("EMBEDDING_BASE_URL") or os.getenv("LLM_BASE_URL"),
            api_key=os.getenv("LLM_API_KEY")
        )
    else:
        from .zhipu_client import ZhipuEmbedding
        return ZhipuEmbedding(model=os.getenv("EMBEDDING_MODEL", "embedding-2"))
