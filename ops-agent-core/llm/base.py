from abc import ABC, abstractmethod
from typing import List, Optional

class BaseLLM(ABC):
    @abstractmethod
    def chat(self, messages: List[dict], temperature: float = 0.7) -> str:
        """
        Chat with the LLM.
        messages: list of dict, e.g. [{"role": "user", "content": "hello"}]
        """
        pass

class BaseEmbedding(ABC):
    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """
        Get embedding for a single text string.
        """
        pass
