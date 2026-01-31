
import sys
import os
from llm.factory import get_llm_client

def test_polish():
    try:
        print("Testing ZhipuLLM polish functionality...")
        llm = get_llm_client()
        
        # Check if it is indeed ZhipuLLM or compatible
        print(f"LLM Client Type: {type(llm)}")
        
        question = "系统很卡怎么办"
        draft = "重启一下试试，或者看看有没有什么进程占用了cpu"
        
        prompt = f"""
你是一个专业的运维助手。请对以下问答对中的答案进行**轻微润色**。
要求：
1. 保持原意，不要过度发散或添加无关信息。
2. 专业术语准确，语言言简意赅。
3. 仅在必要时进行语法或逻辑修正。

问题：{question}
草稿答案：{draft}

请直接输出优化后的答案内容，不要包含任何解释或开场白。
"""
        messages = [{"role": "user", "content": prompt}]
        
        print("Sending request to LLM...")
        # This calls the chat method we just verified exists in ZhipuLLM
        response = llm.chat(messages)
        
        print("-" * 50)
        print("Polished Answer:")
        print(response)
        print("-" * 50)
        print("Test Passed!")
        
    except Exception as e:
        print(f"Test Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure we are in the backend directory context for imports
    sys.path.append(os.getcwd())
    test_polish()
