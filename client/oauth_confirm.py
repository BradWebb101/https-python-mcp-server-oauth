import requests
from requests.auth import HTTPBasicAuth
import base64
import json
import os
from dotenv import load_dotenv

load_dotenv()

COGNITO_DOMAIN = "https://serverless-mcp.auth.eu-central-1.amazoncognito.com"
CLIENT_ID = os.getenv("CLIENT_ALL_ID")
CLIENT_SECRET = os.getenv("CLIENT_ALL_SECRET")
SCOPE = os.getenv("ALL_SCOPES")
API_URL = "https://tc080s2ig2.execute-api.eu-central-1.amazonaws.com/api_wrapper/mcp"  

def get_bearer_token():
    token_url = f"{COGNITO_DOMAIN}/oauth2/token"
    print(token_url)
    data = {
        "grant_type": "client_credentials",
        "scope": SCOPE
    }
    auth = HTTPBasicAuth(CLIENT_ID, CLIENT_SECRET)
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    response = requests.post(token_url, data=data, auth=auth, headers=headers)
    response.raise_for_status()
    return response.json()["access_token"]

def decode_jwt(token):
    parts = token.split('.')
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")
    payload = parts[1]
    padding = '=' * (-len(payload) % 4)
    decoded = base64.urlsafe_b64decode(payload + padding)
    return json.loads(decoded)

def call_mcp_api(token):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
    "action": "list_tools"
    }
    response = requests.post(API_URL, headers=headers, json=payload)
    print("MCP API status code:", response.status_code)
    print("MCP API response:", response.text)

if __name__ == "__main__":
    token = get_bearer_token()
    print("Bearer ", token)
    decoded = decode_jwt(token)
    print("Decoded JWT payload:", json.dumps(decoded, indent=2))
    print("Scopes in token:", decoded.get("scope"))
    call_mcp_api(token)