import requests

BASE_URL = "http://localhost:8000"

def get_token(username, password):
    res = requests.post(f"{BASE_URL}/token", data={"username": username, "password": password})
    if res.status_code != 200:
        print(f"Login failed for {username}: {res.text}")
        return None
    return res.json()["access_token"]

def test_stats(username, password):
    print(f"Testing stats for {username}...")
    token = get_token(username, password)
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
    
    if res.status_code == 200:
        print(f"Success! Stats for {username}:")
        print(res.json())
    else:
        print(f"Failed to get stats: {res.status_code} {res.text}")

if __name__ == "__main__":
    test_stats("admin", "admin123")
    test_stats("user", "user123")
