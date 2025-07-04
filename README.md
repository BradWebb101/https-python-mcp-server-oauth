# MCP Article Project 🚀

This project is built using the AWS CDK and TypeScript. It provides a set of Lambda functions for various operations, including adding two numbers and interacting with external APIs.

## Environment Variables 🔒

The following environment variables are required for the project:

- `DUMMY_BEARER_TOKEN`: A dummy token for authentication (masked for security).

**Example `.env` file**:
```env
DUMMY_BEARER_TOKEN=your-dummy-token
```

## Useful Commands 🛠️

- `npm run build`: Compile TypeScript to JavaScript.
- `npm run watch`: Watch for changes and compile.
- `npm run test`: Perform the Jest unit tests.
- `npx cdk deploy`: Deploy this stack to your default AWS account/region.
- `npx cdk diff`: Compare deployed stack with the current state.
- `npx cdk synth`: Emit the synthesized CloudFormation template.

## MCP Details 🌐

The MCP (Model Context Protocol) is implemented in this project to handle session management and API interactions. The following endpoints are available:

### Add Two Numbers ➕
This endpoint adds two numbers together.

- **Lambda Function**: `add_two_numbers`
- **Handler**: `lambda/add_two_numbers/main.py`
- **Environment Variable**: `SESSION_TABLE_NAME`
- **Example Usage**:
  ```json
  {
    "a": 5,
    "b": 10
  }
  ```
  **Response**:
  ```json
  {
    "result": 15
  }
  ```

### API Wrapper 🛒
This endpoint interacts with an external API to fetch data.

- **Lambda Function**: `api_wrapper`
- **Handler**: `lambda/api_wrapper/main.py`
- **Environment Variable**: `SESSION_TABLE_NAME`
- **Example Usage**:
  Fetches all products from a dummy API:
  ```json
  {
    "action": "fetch_all_products"
  }
  ```
  **Response**:
  ```json
  {
    "products": [
      {
        "id": 1,
        "name": "Product 1",
        ...
      }
    ]
  }
  ```

## Links 🔗

The REST API endpoint URL for MCP is dynamically generated during deployment. After deploying the CDK stack, you can find the URL in the CloudFormation Outputs section under the key `RestApiInvokeUrl`. It will look something like:

```
https://<api-id>.execute-api.<region>.amazonaws.com/<function-name>/mcp
```