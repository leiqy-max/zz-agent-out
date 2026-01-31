from typing import List
import os
import requests
from openai import OpenAI
from .base import BaseLLM, BaseEmbedding

class OpenAICompatibleLLM(BaseLLM):
    def __init__(self, model: str, base_url: str, api_key: str):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    def chat(self, messages: List[dict], temperature: float = 0.7) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature
        )
        return response.choices[0].message.content

class OpenAICompatibleEmbedding(BaseEmbedding):
    def __init__(self, model: str, base_url: str, api_key: str):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.base_url = base_url
        self.api_key = api_key

    def embed_text(self, text: str) -> List[float]:
        text = text.replace("\n", " ")
        
        # Use direct HTTP request to bypass strict client validation
        # and handle "str object has no attribute embedding" issues
        url = f"{self.base_url.rstrip('/')}/embeddings"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        # Force input as a single string (not list) for compatibility
        payload = {
            "input": text,
            "model": self.model
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            # Handle various response formats
            if "data" in data:
                embedding_data = data["data"]
                
                # Case 1: Standard OpenAI format (list of embedding objects)
                if isinstance(embedding_data, list) and len(embedding_data) > 0:
                    item = embedding_data[0]
                    if isinstance(item, dict) and "embedding" in item:
                        return item["embedding"]
                
                # Case 2: Non-standard format (single embedding object directly in 'data')
                # As seen in your internal API response
                elif isinstance(embedding_data, dict) and "embedding" in embedding_data:
                    return embedding_data["embedding"]

            raise ValueError(f"Unexpected response format: {data}")
            
        except Exception as e:
            print(f"Embedding error: {e}")
            raise e
