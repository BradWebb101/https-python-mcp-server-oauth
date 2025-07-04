from awslabs.mcp_lambda_handler import MCPLambdaHandler
from awslabs.mcp_lambda_handler.session import DynamoDBSessionStore
import requests
import os
import functools

table_name = os.environ.get('SESSION_TABLE_NAME')

mcp = MCPLambdaHandler(
    name="mcp-lambda-server",
    version="1.0.0",
    session_store=DynamoDBSessionStore(table_name=table_name)
)

def session_logger(func):
    """Decorator to handle session logging and argument/result logging."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        session = mcp.get_session()
        if session:
            session.set('function', func.__name__)
            session.set('arguments', {'args': args, 'kwargs': kwargs})
            result = func(*args, **kwargs)
            session.set('result', str(result) if not isinstance(result, str) else result)
            mcp.set_session(session.raw())
        else:
            result = func(*args, **kwargs)
        return result
    return wrapper

@mcp.tool()
@session_logger
def fetch_all_products() -> dict:
    """Fetch all products from the API."""
    response = requests.get("https://dummyjson.com/products")
    response.raise_for_status()
    return response.json()

@mcp.tool()
@session_logger
def filter_by_price_range(min_price: float, max_price: float) -> list:
    """Filter products by price range."""
    products = fetch_all_products()["products"]
    return [product for product in products if min_price <= product["price"] <= max_price]

@mcp.tool()
@session_logger
def filter_by_stock_availability(min_stock: int) -> list:
    """Filter products by minimum stock availability."""
    products = fetch_all_products()["products"]
    return [product for product in products if product["stock"] >= min_stock]

def lambda_handler(event, context):
    """AWS Lambda handler function."""
    return mcp.handle_request(event, context)