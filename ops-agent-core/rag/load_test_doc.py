import os
from rag.loader import load_document

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "..", "..", "data", "test_ops.txt")

    load_document(
        file_path=file_path,
        metadata={
            "system": "系统A",
            "type": "运维手册",
            "version": "v1.0"
        }
    )
    print("文档入库完成")
