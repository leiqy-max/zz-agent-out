# rag/qa.py
from typing import List, Dict, Optional
import os
from rag.retriever import retrieve_similar_documents

from llm.factory import get_llm_client

def call_llm(prompt: str, image: Optional[str] = None) -> str:
    """
    调用统一 LLM 接口生成回答
    支持 ZhipuAI 和 Ollama (通过 LLM_PROVIDER 环境变量切换)
    """
    try:
        provider = os.getenv("LLM_PROVIDER", "zhipu").lower()
        
        # 如果有图片，强制使用支持视觉的模型
        model = None
        if image:
            if provider == "zhipu":
                model = "glm-4v"
            elif provider == "ollama":
                model = "llava" # 假设 ollama 使用 llava
        
        client = get_llm_client(model=model)
        
        # 构造对话历史
        messages = []
        if image:
            if provider == "zhipu":
                messages = [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image}}
                    ]
                }]
            else:
                # Ollama vision format might vary, simple fallback or standard
                # 假设 Ollama 客户端能处理 content list 或者我们需要在这里适配
                # 这里暂时假设 OllamaClient 需要适配，或者简单处理
                # 目前主要支持 Zhipu GLM-4V
                messages = [{"role": "user", "content": prompt, "images": [image]}] # Ollama often uses 'images' field
        else:
            messages = [{"role": "user", "content": prompt}]
            
        return client.chat(messages)
    except Exception as e:
        return f"调用 LLM 失败: {str(e)}"


SYSTEM_PROMPT = """你是一名资深运维工程师助手。

你的任务是根据用户问题和提供的【参考文档】进行回答。

处理规则如下：

1. **针对闲聊或通用问题**（如问候、夸奖、询问天气、常识等）：
   - 请忽略参考文档，直接用自然、流畅、友好的语气回答用户。
   - **不要**在回答中提及“未在知识库找到”或引用文档。
   - 直接输出回复内容，不要输出“属于闲聊”等分类标签。

2. **针对专业运维或业务咨询**（涉及具体设备、流程、故障、指标等）：
   - 必须严格依据【参考文档】回答。
   - **关键校验**：检索系统可能会返回不相关的文档。请务必先判断【参考文档】的内容是否真的与用户问题（或图片展示的报错）对口。
     - 例如：用户问的是“数据库连接失败”，但文档是“服务器登录指南”，这属于**无关文档**。
   - 如果【参考文档】与用户问题**无关**，或者无法解决该问题，请直接忽略文档，并明确输出：“未在现有运维知识库中找到标准处置方案，请联系后台支撑。”
   - 禁止强行关联不相关的文档，禁止编造文档中不存在的内容。
   - 引用格式（仅在文档相关时使用）：根据《[文档名称]》[章节]（上传时间：YYYY-MM-DD），标准处理流程如下：...

请直接根据上述规则输出回答。
"""

CHAT_PROMPT = """你是一名资深运维工程师助手。

请判断用户的意图：
1. 如果是**闲聊**（如打招呼、问名字、天气、夸奖等）：请自然、友好地回应。
2. 如果是**专业技术问题**或**业务咨询**：由于未检索到相关文档，请明确告知用户“未在现有运维知识库中找到标准处置方案，请联系后台支撑。”。
"""

CLASSIFY_PROMPT = """你是一个意图识别助手。
请判断用户的输入是“闲聊”还是“专业问题”。
- 闲聊：打招呼、问候、夸奖、询问天气、个人情感等非技术类内容。
- 专业问题：涉及运维、技术、业务流程、故障排查、系统操作等内容。

用户输入：{question}

请仅输出类别名称（“闲聊”或“专业问题”），不要包含其他文字。"""


def classify_intent(question: str) -> str:
    """
    判断用户意图
    """
    try:
        prompt = CLASSIFY_PROMPT.format(question=question)
        response = call_llm(prompt)
        if "闲聊" in response:
            return "chitchat"
        return "technical"
    except Exception:
        # Fallback to technical if classification fails
        return "technical"


def build_context(docs):
    context_parts = []
    for i, doc in enumerate(docs, 1):
        # doc structure: (id, content, metadata, distance)
        content = doc[1]
        metadata = doc[2]
        
        context_parts.append(
            f"""【文档 {i}】
内容：
{content}

元数据：
{metadata}
"""
        )
    return "\n".join(context_parts)


def build_prompt(question: str, context: str) -> str:
    return f"""
【参考文档】
{context}

【用户问题】
{question}
"""

def answer_question(question: str, image: Optional[str] = None, kb_type: str = "user") -> Dict:
    # 0. Intent Classification
    # Skip classification if image is present (usually technical) or if explicitly technical
    if not image:
        intent = classify_intent(question)
        if intent == "chitchat":
            # Direct chat without retrieval
            chat_prompt = f"用户输入：{question}\n\n请自然、友好地回应用户。不要提及知识库或文档。"
            answer = call_llm(chat_prompt, image=image)
            return {
                "answer": answer,
                "sources": []
            }

    # 1. 检索 (传入 kb_type)
    # Define threshold for similarity distance (lower is better for cosine distance in pgvector)
    # Typically 0.5-0.7 is a reasonable threshold for semantic similarity
    SIMILARITY_THRESHOLD = 0.8
    
    docs = retrieve_similar_documents(question, kb_type=kb_type)

    sources = []
    seen_filenames = set()
    if docs:
        for doc in docs:
            # doc structure: (id, content, metadata, distance)
            distance = doc[3] if len(doc) > 3 else 1.0
            
            # Filter by distance threshold
            if distance > SIMILARITY_THRESHOLD:
                continue
                
            meta = doc[2]
            if meta and "filename" in meta:
                filename = meta.get("filename")
                if filename not in seen_filenames:
                    sources.append({
                        "id": doc[0],
                        "filename": filename,
                        "source": meta.get("source"),
                        "score": distance
                    })
                    seen_filenames.add(filename)
    
    # Re-check docs after filtering
    valid_docs = [d for d in docs if (d[3] if len(d) > 3 else 1.0) <= SIMILARITY_THRESHOLD]

    # 2. 构建 Prompt
    context = build_context(valid_docs) if valid_docs else "（未检索到相关文档）"
    
    # 组合 System Prompt 和 User Prompt
    full_prompt = f"{SYSTEM_PROMPT}\n\n{build_prompt(question, context)}"

    # 3. 调用 LLM
    answer = call_llm(full_prompt, image=image)
    
    return {
        "answer": answer,
        "sources": sources
    }
