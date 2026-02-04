import os
from typing import List
from zhipuai import ZhipuAI
from .base import BaseLLM, BaseEmbedding

class ZhipuLLM(BaseLLM):
    def __init__(self, api_key: str = None, model: str = "glm-4"):
        self.api_key = api_key or os.getenv("ZHIPUAI_API_KEY")
        if not self.api_key:
            raise ValueError("ZHIPUAI_API_KEY not found")
        self.client = ZhipuAI(api_key=self.api_key)
        self.model = model

    def chat(self, messages: List[dict], temperature: float = 0.7) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error calling ZhipuAI: {str(e)}"

class ZhipuEmbedding(BaseEmbedding):
    def __init__(self, api_key: str = None, model: str = "embedding-2"):
        self.api_key = api_key or os.getenv("ZHIPUAI_API_KEY")
        if not self.api_key:
            raise ValueError("ZHIPUAI_API_KEY not found")
        self.client = ZhipuAI(api_key=self.api_key)
        self.model = model

    def embed_text(self, text: str) -> List[float]:
        resp = self.client.embeddings.create(
            model=self.model,
            input=text
        )
        return resp.data[0].embedding
