# rag/test_qa.py
from rag.qa import answer_question

if __name__ == "__main__":
    question = "系统A无法登录怎么办？"
    prompt = answer_question(question)
    print(prompt)
