from typing import List
import random
from .base import BaseLLM, BaseEmbedding

class MockLLM(BaseLLM):
    def __init__(self, model: str = "mock"):
        self.model = model

    def chat(self, messages: List[dict], temperature: float = 0.7) -> str:
        return "This is a mock response from the Intranet Ops Agent. The LLM is running in fallback mode."

class MockEmbedding(BaseEmbedding):
    def __init__(self, model: str = "mock"):
        self.model = model

    def embed_text(self, text: str) -> List[float]:
        # Return a random vector of dimension 768 (common size) or 1024
        return [random.random() for _ in range(768)]
