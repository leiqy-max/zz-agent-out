from langchain.text_splitter import RecursiveCharacterTextSplitter

def split_ops_doc(text: str):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100,
        separators=[
            "\n处理步骤",
            "\n故障现象",
            "\n告警说明",
            "\n注意事项",
            "\n"
        ]
    )
    return splitter.split_text(text)
