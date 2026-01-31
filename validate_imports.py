
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print("Testing imports for ops-agent...")

def check_import(module_name):
    try:
        print(f"Importing {module_name}...")
        __import__(module_name)
        print("   -> Success")
    except Exception as e:
        print(f"   -> FAILED: {e}")
        # import traceback
        # traceback.print_exc()

check_import("pydantic")
check_import("langchain")
check_import("langchain_community")
check_import("db")
check_import("auth")
check_import("llm.factory")
check_import("rag.qa")
check_import("jinja2")
check_import("main")
