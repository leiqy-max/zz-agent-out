import os
import requests
from typing import List
from .base import BaseLLM, BaseEmbedding

class OllamaLLM(BaseLLM):
    def __init__(self, base_url: str = None, model: str = "qwen:7b"):
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = model

    def chat(self, messages: List[dict], temperature: float = 0.7) -> str:
        # Ollama API: POST /api/chat
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature
            }
        }
        try:
            resp = requests.post(url, json=payload)
            resp.raise_for_status()
            return resp.json().get("message", {}).get("content", "")
        except Exception as e:
            return f"Error calling Ollama: {str(e)}"

class OllamaEmbedding(BaseEmbedding):
    def __init__(self, base_url: str = None, model: str = "nomic-embed-text"):
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = model

    def embed_text(self, text: str) -> List[float]:
        # Ollama API: POST /api/embeddings
        url = f"{self.base_url}/api/embeddings"
        payload = {
            "model": self.model,
            "prompt": text
        }
        try:
            resp = requests.post(url, json=payload)
            resp.raise_for_status()
            return resp.json().get("embedding", [])
        except Exception as e:
            print(f"Error calling Ollama embedding: {e}")
            return []
