import asyncio
import requests
import os
import argparse
from requests.auth import HTTPBasicAuth
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from dotenv import load_dotenv

load_dotenv()

# The well-known endpoint for OAuth metadata
WELL_KNOWN_URL = "https://tc080s2ig2.execute-api.eu-central-1.amazonaws.com/.well-known/oauth-authorization-server"

def get_oauth_metadata():
    resp = requests.get(WELL_KNOWN_URL)
    resp.raise_for_status()
    return resp.json()

def get_bearer_token(metadata, client_id, client_secret, scope):
    token_url = 'https://serverless-mcp.auth.eu-central-1.amazoncognito.com/oauth2/token'
    data = {
        "grant_type": "client_credentials",
        "scope": scope
    }
    auth = HTTPBasicAuth(client_id, client_secret)
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    response = requests.post(token_url, data=data, auth=auth, headers=headers)
    response.raise_for_status()
    return response.json()["access_token"]

async def main():
    parser = argparse.ArgumentParser(description="MCP Client with OAuth support")
    parser.add_argument("--client", type=str, choices=["all", "fetch_all"], required=True, help="Which client credentials to use (all or fetch_all)")
    parser.add_argument("--mcp-url", default="https://tc080s2ig2.execute-api.eu-central-1.amazonaws.com/api_wrapper/mcp", help="MCP server URL")
    args = parser.parse_args()

    # Get credentials from environment variables
    client_all_id = os.environ.get("CLIENT_ALL_ID")
    client_all_secret = os.environ.get("CLIENT_ALL_SECRET")
    all_scopes = os.environ.get("ALL_SCOPES")
    client_fetch_all_id = os.environ.get("CLIENT_FETCH_ALL_ID")
    client_fetch_all_secret = os.environ.get("CLIENT_FETCH_ALL_SECRET")
    fetch_all_scopes = os.environ.get("FETCH_ALL_SCOPES")

    if args.client == 'all':
        client_id = client_all_id
        client_secret = client_all_secret
        scope = all_scopes
    else:
        client_id = client_fetch_all_id
        client_secret = client_fetch_all_secret
        scope = fetch_all_scopes
        
    if not client_id or not client_secret:
        raise ValueError("Client ID and secret must be set in environment variables.")

    # Step 1: Fetch OAuth metadata
    metadata = get_oauth_metadata()
    # Step 2: Get a bearer token
    token = get_bearer_token(metadata, client_id, client_secret, scope)
    # Step 3: Connect to MCP server with Authorization header
    headers = {"Authorization": f"Bearer {token}"}
    async with streamablehttp_client(args.mcp_url, headers=headers) as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tools = await session.list_tools()
            print(f"Available tools: {[tool.name for tool in tools.tools]}")

if __name__ == "__main__":
    asyncio.run(main())