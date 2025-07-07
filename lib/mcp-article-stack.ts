import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export interface McpTestStackInterface extends cdk.StackProps {
  dummyBearerToken: string
  sessionTableName: string
}

export class McpTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: McpTestStackInterface) {
    super(scope, id, props);

    const { dummyBearerToken, sessionTableName } = props

    const sessionTable = new dynamodb.Table(this, 'SessionTable', {
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expires_at', 
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: sessionTableName, 
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const addTwoNumbersLambda = new lambda.DockerImageFunction(this, 'AddTwoNumbersMcpServer', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../','lambda/add_two_numbers')),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(60),
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
      },
    });

    const apiWrapperLambda = new lambda.DockerImageFunction(this, 'ApiWrapperMcpServer', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../','lambda/api_wrapper')),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(60),
       environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
      },
    });

    const authLambda = new lambda.Function(this, 'AuthLambda', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'main.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'lambda/auth')),
      architecture: lambda.Architecture.ARM_64,
      environment: {
        DUMMY_BEARER_TOKEN: dummyBearerToken
     }});

    sessionTable.grantReadWriteData(addTwoNumbersLambda);
    sessionTable.grantReadWriteData(apiWrapperLambda);

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'McpServerRestApi',
      description: 'REST API for MCP Lambda',
    });

    const gatewayAuthorizer = new apigateway.RequestAuthorizer(this, 'GatewayAuth', {
      handler: authLambda,
      identitySources: [apigateway.IdentitySource.header('Authorization')],
    });

    const addTwoNumers = api.root.addResource('add_two_numbers').addResource('mcp');
    addTwoNumers.addMethod('POST', new apigateway.LambdaIntegration(addTwoNumbersLambda), {
      authorizer: gatewayAuthorizer,
    });

    const apiWrapper = api.root.addResource('api_wrapper').addResource('mcp')
    apiWrapper.addMethod('POST', new apigateway.LambdaIntegration(apiWrapperLambda), {
      authorizer: gatewayAuthorizer,
    });

    new cdk.CfnOutput(this, 'RestApiInvokeUrl', {
      value: api.url ? api.url + 'mcp' : 'Something went wrong',
      description: 'The endpoint URL for the MCP REST API',
    });

    new cdk.CfnOutput(this, 'SessionTableName', {
      value: sessionTable.tableName,
      description: 'The name of the DynamoDB table for session management',
    });
  }
}
