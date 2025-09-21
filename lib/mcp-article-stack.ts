import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigwv2_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

export interface McpTestStackInterface extends cdk.StackProps {
  sessionTableName: string;
}

export class McpTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: McpTestStackInterface) {
    super(scope, id, props);

    const { sessionTableName } = props;

    const sessionTable = new dynamodb.Table(this, 'SessionTable', {
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expires_at',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: sessionTableName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const addTwoNumbersLambda = new lambda.DockerImageFunction(this, 'AddTwoNumbersMcpServer', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../', 'lambda/add_two_numbers')),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(60),
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
      },
    });

    const apiWrapperLambda = new lambda.DockerImageFunction(this, 'ApiWrapperMcpServer', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../', 'lambda/api_wrapper')),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(60),
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
      },
    });

    sessionTable.grantReadWriteData(addTwoNumbersLambda);
    sessionTable.grantReadWriteData(apiWrapperLambda);

    // Cognito User Pool for authentication
    const userPool = new cognito.UserPool(this, 'McpUserPool', {
      selfSignUpEnabled: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolDomain = new cognito.UserPoolDomain(this, 'McpUserPoolDomain', {
      userPool,
      cognitoDomain: {
        domainPrefix: 'serverless-mcp',
      },
    });

    // Cognito Resource Server for custom OAuth scopes
    const resourceServer = new cognito.CfnUserPoolResourceServer(this, 'McpResourceServer', {
      identifier: 'products',
      name: 'Products Resource Server',
      userPoolId: userPool.userPoolId,
      scopes: [
        { scopeName: 'fetch_all', scopeDescription: 'Fetch all products' },
        { scopeName: 'filter_price', scopeDescription: 'Filter products by price range' },
        { scopeName: 'filter_stock', scopeDescription: 'Filter products by stock availability' },
      ],
    });

    // App client with access to all endpoints (all scopes)
    const userPoolClientAll = new cognito.CfnUserPoolClient(this, 'McpUserPoolClientAll', {
      userPoolId: userPool.userPoolId,
      generateSecret: true,
      allowedOAuthFlows: ['client_credentials'],
      allowedOAuthScopes: [
        'products/fetch_all',    // fetch_all_products tool
        'products/filter_price', // filter_by_price_range tool
        'products/filter_stock', // filter_by_stock_availability tool
      ],
      allowedOAuthFlowsUserPoolClient: true,
      accessTokenValidity: 1,
      refreshTokenValidity: 30,
      preventUserExistenceErrors: 'ENABLED',
    });
    userPoolClientAll.addDependency(resourceServer);

    // App client with access to only fetch_all_products (single scope)
    const userPoolClientFetchAll = new cognito.CfnUserPoolClient(this, 'McpUserPoolClientFetchAll', {
      userPoolId: userPool.userPoolId,
      generateSecret: true,
      allowedOAuthFlows: ['client_credentials'],
      allowedOAuthScopes: [
        'products/fetch_all', // Only fetch_all_products tool
      ],
      allowedOAuthFlowsUserPoolClient: true,
      accessTokenValidity: 1,
      refreshTokenValidity: 30,
      preventUserExistenceErrors: 'ENABLED',
    });
    userPoolClientFetchAll.addDependency(resourceServer);

    // ---
    // Summary:
    // userPoolClientAll: can access all tools (fetch_all_products, filter_by_price_range, filter_by_stock_availability)
    // userPoolClientFetchAll: can only access fetch_all_products
    // ---

    // HTTP API (no stage prefix)
    const httpApi = new apigwv2.HttpApi(this, 'McpHttpApi', {
      apiName: 'McpHttpApi',
      description: 'HTTP API for MCP',
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowOrigins: ['*'],
      },
    });

    // Cognito authorizer for HTTP API
    const cognitoJwtAuthorizer = new apigwv2_authorizers.HttpJwtAuthorizer('McpCognitoAuthorizer',
      `https://cognito-idp.eu-central-1.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClientAll.ref, userPoolClientFetchAll.ref],
      }
    );

    // Lambda integrations with Cognito authorizer
    httpApi.addRoutes({
      path: '/add_two_numbers/mcp',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('AddTwoNumbersIntegration', addTwoNumbersLambda),
      authorizer: cognitoJwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api_wrapper/mcp',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('ApiWrapperIntegration', apiWrapperLambda),
      authorizer: cognitoJwtAuthorizer,
    });

    // JWKS redirect (no authorizer)
    httpApi.addRoutes({
      path: '/.well-known/oauth-protected-resource',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpUrlIntegration(
        'JwksRedirect',
        'https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_6T3kuRWA3/.well-known/openid-configuration'
      ),
    });

    httpApi.addRoutes({
      path: '/.well-known/oauth-authorization-server',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpUrlIntegration(
        'JwksRedirect',
        'https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_6T3kuRWA3/.well-known/openid-configuration'
      ),
    });

    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'The endpoint URL for the MCP HTTP API (no stage prefix)',
    });
    new cdk.CfnOutput(this, 'SessionTableName', {
      value: sessionTable.tableName,
      description: 'The name of the DynamoDB table for session management',
    });
    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });
    new cdk.CfnOutput(this, 'CognitoUserPoolClientAllId', {
      value: userPoolClientAll.ref,
      description: 'Cognito User Pool Client ID (all endpoints)',
    });
    new cdk.CfnOutput(this, 'CognitoUserPoolClientAllSecret', {
      value: userPoolClientAll.attrClientSecret,
      description: 'Cognito User Pool Client Secret (all endpoints)',
    });
    new cdk.CfnOutput(this, 'CognitoUserPoolClientFetchAllId', {
      value: userPoolClientFetchAll.ref,
      description: 'Cognito User Pool Client ID (read only)',
    });
    new cdk.CfnOutput(this, 'CognitoUserPoolClientFetchAllSecret', {
      value: userPoolClientFetchAll.attrClientSecret,
      description: 'Cognito User Pool Client Secret (read only)',
    });
    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Hosted Domain for OAuth endpoints',
    });
  }
}
