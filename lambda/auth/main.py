import os

def lambda_handler(event, context):
    try:
        token = event['headers'].get('Authorization')
        if not token:
            raise ValueError('Authorization header missing')

        if token == f'Bearer {os.getenv('DUMMY_BEARER_TOKEN')}':
            return {
                "principalId": "test-user",
                "policyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Action": "execute-api:Invoke",
                            "Effect": "Allow",
                            "Resource": event['methodArn'],
                        },
                    ],
                },
            }
        else:
            raise ValueError('Invalid token')

    except Exception as error:
        print(f"Authorization error: {error}")
        return {
            "principalId": "unauthorized",
            "policyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": "execute-api:Invoke",
                        "Effect": "Deny",
                        "Resource": event['methodArn'],
                    },
                ],
            },
        }
