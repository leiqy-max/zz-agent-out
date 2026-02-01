
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from main import get_dashboard_stats
from db import engine
from sqlalchemy import text

# Mock user class since Pydantic model might need instantiation
class MockUser:
    def __init__(self, username, role):
        self.username = username
        self.role = role

def test_stats():
    print("Testing stats...")
    try:
        admin_user = MockUser(username="admin", role="admin")
        stats = get_dashboard_stats(current_user=admin_user)
        print(f"Stats keys: {stats.keys()}")
        print(f"Stats values: {stats}")
        
        # Verify types
        for k, v in stats.items():
            print(f"{k}: {v} (Type: {type(v)})")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_stats()
