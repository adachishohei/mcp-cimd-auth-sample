import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';

export class AuthenticatedMcpStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Cognito User Pool
    // 要件 3.1: Amazon Cognito User Poolはユーザー認証を提供しなければならない
    this.userPool = new cognito.UserPool(this, 'McpUserPool', {
      userPoolName: 'mcp-authenticated-server-pool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
    });

    // Create User Pool Domain for Managed UI
    // 要件 3.2: Cognito Managed UIはログイン画面を表示しなければならない
    this.userPoolDomain = this.userPool.addDomain('McpUserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `mcp-auth-${cdk.Aws.ACCOUNT_ID}`,
      },
    });

    // Create User Pool Client with OAuth 2.1 settings (PKCE required)
    // 要件 3.3, 3.4: OAuth 2.1設定（PKCE必須）とトークン発行
    // Note: Using standard scopes only (openid, email, profile)
    // Custom scopes can be added later if needed
    this.userPoolClient = this.userPool.addClient('McpUserPoolClient', {
      userPoolClientName: 'mcp-server-client',
      generateSecret: false, // Public client (PKCE required)
      authFlows: {
        userPassword: false,
        userSrp: false,
        custom: false,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
          clientCredentials: false,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          // Development/testing URLs (will add Auth Proxy callback after API Gateway creation)
          'http://localhost:3000/callback',
          'https://localhost:3000/callback',
        ],
        logoutUrls: [
          'http://localhost:3000',
          'https://localhost:3000',
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      // OAuth 2.1 requires PKCE for public clients
      preventUserExistenceErrors: true,
    });

    // Output important values
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'McpUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'McpUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito User Pool Domain',
      exportName: 'McpUserPoolDomain',
    });

    new cdk.CfnOutput(this, 'CognitoManagedUIUrl', {
      value: `https://${this.userPoolDomain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com`,
      description: 'Cognito Managed UI URL',
      exportName: 'McpCognitoManagedUIUrl',
    });

    // DynamoDB table for session management
    // Used by authorization proxy to store PKCE session data
    const sessionTable = new dynamodb.Table(this, 'SessionTable', {
      tableName: 'mcp-auth-sessions',
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // Create unified API Gateway for all endpoints
    const authProxyApi = new apigateway.RestApi(this, 'AuthProxyApi', {
      restApiName: 'Authenticated MCP Server',
      description: 'Unified API for OAuth 2.1 Authorization and MCP Protocol',
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Lambda function for authorization endpoint
    // 要件 1.1, 1.2, 1.3, 1.4, 1.5
    const authorizeFunction = new nodejs.NodejsFunction(this, 'AuthorizeFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/auth-proxy/authorize.ts'),
      handler: 'handler',
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
        COGNITO_DOMAIN: this.userPoolDomain.domainName,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        COGNITO_REGION: cdk.Aws.REGION,
        API_ID: authProxyApi.restApiId,
        STAGE_NAME: 'prod',
      },
      timeout: cdk.Duration.seconds(30),
      description: 'OAuth 2.1 Authorization Endpoint Handler',
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant DynamoDB permissions to authorize function
    sessionTable.grantWriteData(authorizeFunction);

    // Lambda function for callback endpoint (receives code from Cognito)
    const callbackFunction = new nodejs.NodejsFunction(this, 'CallbackFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/auth-proxy/callback.ts'),
      handler: 'handler',
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
        COGNITO_DOMAIN: this.userPoolDomain.domainName,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        COGNITO_REGION: cdk.Aws.REGION,
        API_ID: authProxyApi.restApiId,
        STAGE_NAME: 'prod',
      },
      timeout: cdk.Duration.seconds(30),
      description: 'OAuth 2.1 Callback Endpoint Handler (Cognito → MCP Client)',
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant DynamoDB permissions to callback function
    sessionTable.grantReadWriteData(callbackFunction);

    // Lambda function for consent page
    const consentFunction = new nodejs.NodejsFunction(this, 'ConsentFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/auth-proxy/consent.ts'),
      handler: 'handler',
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
        COGNITO_DOMAIN: this.userPoolDomain.domainName,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        COGNITO_REGION: cdk.Aws.REGION,
        API_ID: authProxyApi.restApiId,
        STAGE_NAME: 'prod',
      },
      timeout: cdk.Duration.seconds(10),
      description: 'Consent Page Handler (displays client_name)',
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant DynamoDB permissions to consent function
    sessionTable.grantReadData(consentFunction);

    // Lambda function for consent approval
    const consentApproveFunction = new nodejs.NodejsFunction(this, 'ConsentApproveFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/auth-proxy/consent-action.ts'),
      handler: 'approveHandler',
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
        COGNITO_DOMAIN: this.userPoolDomain.domainName,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        COGNITO_REGION: cdk.Aws.REGION,
        API_ID: authProxyApi.restApiId,
        STAGE_NAME: 'prod',
      },
      timeout: cdk.Duration.seconds(10),
      description: 'Consent Approval Handler',
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant DynamoDB permissions to consent approve function
    sessionTable.grantReadWriteData(consentApproveFunction);

    // Lambda function for consent denial
    const consentDenyFunction = new nodejs.NodejsFunction(this, 'ConsentDenyFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/auth-proxy/consent-action.ts'),
      handler: 'denyHandler',
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
        COGNITO_DOMAIN: this.userPoolDomain.domainName,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        COGNITO_REGION: cdk.Aws.REGION,
        API_ID: authProxyApi.restApiId,
        STAGE_NAME: 'prod',
      },
      timeout: cdk.Duration.seconds(10),
      description: 'Consent Denial Handler',
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant DynamoDB permissions to consent deny function
    sessionTable.grantReadWriteData(consentDenyFunction);

    // Lambda function for token endpoint
    // 要件 2.1, 2.2, 2.3, 2.4, 2.5
    const tokenFunction = new nodejs.NodejsFunction(this, 'TokenFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/auth-proxy/token.ts'),
      handler: 'handler',
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
        COGNITO_DOMAIN: this.userPoolDomain.domainName,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        COGNITO_REGION: cdk.Aws.REGION,
        API_ID: authProxyApi.restApiId,
        STAGE_NAME: 'prod',
      },
      timeout: cdk.Duration.seconds(30),
      description: 'OAuth 2.1 Token Endpoint Handler',
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant DynamoDB permissions to token function
    sessionTable.grantReadWriteData(tokenFunction);

    // Lambda function for Authorization Server Metadata endpoint
    // RFC 8414: OAuth 2.0 Authorization Server Metadata
    const authServerMetadataFunction = new nodejs.NodejsFunction(this, 'AuthServerMetadataFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/auth-proxy/auth-server-metadata.ts'),
      handler: 'handler',
      environment: {
        SESSION_TABLE_NAME: sessionTable.tableName,
        COGNITO_DOMAIN: this.userPoolDomain.domainName,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        COGNITO_REGION: cdk.Aws.REGION,
        API_ID: authProxyApi.restApiId,
        STAGE_NAME: 'prod',
        AWS_REGION_NAME: cdk.Aws.REGION,
      },
      timeout: cdk.Duration.seconds(10),
      description: 'OAuth 2.0 Authorization Server Metadata Endpoint Handler',
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Add /.well-known/oauth-authorization-server endpoint
    const wellKnownAuthResource = authProxyApi.root.addResource('.well-known');
    const authServerMetadataResource = wellKnownAuthResource.addResource('oauth-authorization-server');
    authServerMetadataResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(authServerMetadataFunction)
    );

    // Add /authorize endpoint
    const authorizeResource = authProxyApi.root.addResource('authorize');
    authorizeResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(authorizeFunction)
    );

    // Add /consent endpoint (displays consent page)
    const consentResource = authProxyApi.root.addResource('consent');
    consentResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(consentFunction)
    );

    // Add /consent/approve endpoint
    const consentApproveResource = consentResource.addResource('approve');
    consentApproveResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(consentApproveFunction)
    );

    // Add /consent/deny endpoint
    const consentDenyResource = consentResource.addResource('deny');
    consentDenyResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(consentDenyFunction)
    );

    // Add /callback endpoint (receives authorization code from Cognito)
    const callbackResource = authProxyApi.root.addResource('callback');
    callbackResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(callbackFunction)
    );

    // Add /token endpoint
    const tokenResource = authProxyApi.root.addResource('token');
    tokenResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(tokenFunction)
    );

    // Output unified API Gateway URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: authProxyApi.url,
      description: 'Unified API Gateway URL (Auth + MCP)',
      exportName: 'McpApiUrl',
    });

    new cdk.CfnOutput(this, 'AuthorizeEndpoint', {
      value: `${authProxyApi.url}authorize`,
      description: 'Authorization Endpoint URL',
      exportName: 'McpAuthorizeEndpoint',
    });

    new cdk.CfnOutput(this, 'ConsentEndpoint', {
      value: `${authProxyApi.url}consent`,
      description: 'Consent Page Endpoint URL',
      exportName: 'McpConsentEndpoint',
    });

    new cdk.CfnOutput(this, 'CallbackEndpoint', {
      value: `${authProxyApi.url}callback`,
      description: 'Callback Endpoint URL (add this to Cognito callback URLs)',
      exportName: 'McpCallbackEndpoint',
    });

    new cdk.CfnOutput(this, 'TokenEndpoint', {
      value: `${authProxyApi.url}token`,
      description: 'Token Endpoint URL',
      exportName: 'McpTokenEndpoint',
    });

    new cdk.CfnOutput(this, 'AuthServerMetadataEndpoint', {
      value: `${authProxyApi.url}.well-known/oauth-authorization-server`,
      description: 'Authorization Server Metadata Endpoint URL',
      exportName: 'McpAuthServerMetadataEndpoint',
    });

    new cdk.CfnOutput(this, 'SessionTableName', {
      value: sessionTable.tableName,
      description: 'DynamoDB Session Table Name',
      exportName: 'McpSessionTableName',
    });

    // Lambda function for Protected Resource Metadata endpoint
    // 要件 4.1, 4.2, 4.3, 4.4
    const metadataFunction = new nodejs.NodejsFunction(this, 'MetadataFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/mcp-server/metadata.ts'),
      handler: 'handler',
      environment: {
        MCP_API_ID: authProxyApi.restApiId,
        AUTH_API_ID: authProxyApi.restApiId,
        STAGE_NAME: 'prod',
        AWS_REGION_NAME: cdk.Aws.REGION,
        SUPPORTED_SCOPES: 'openid,email,profile',
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        COGNITO_REGION: cdk.Aws.REGION,
      },
      timeout: cdk.Duration.seconds(10),
      description: 'Protected Resource Metadata Endpoint Handler',
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Add /.well-known/oauth-protected-resource endpoint to Auth Proxy API
    const protectedResourceMetadataResource = wellKnownAuthResource.addResource('oauth-protected-resource');
    protectedResourceMetadataResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(metadataFunction)
    );

    new cdk.CfnOutput(this, 'ProtectedResourceMetadataEndpoint', {
      value: `${authProxyApi.url}.well-known/oauth-protected-resource`,
      description: 'Protected Resource Metadata Endpoint URL',
      exportName: 'McpProtectedResourceMetadataEndpoint',
    });

    // Lambda function for MCP protocol handler
    // 要件 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3
    const mcpHandlerFunction = new nodejs.NodejsFunction(this, 'McpHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/mcp-server/mcp-handler.ts'),
      handler: 'handler',
      environment: {
        MCP_API_ID: authProxyApi.restApiId,
        AUTH_API_ID: authProxyApi.restApiId,
        STAGE_NAME: 'prod',
        AWS_REGION_NAME: cdk.Aws.REGION,
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
        COGNITO_REGION: cdk.Aws.REGION,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        SUPPORTED_SCOPES: 'openid,email,profile',
      },
      timeout: cdk.Duration.seconds(30),
      description: 'MCP Protocol Handler with JWT Authentication',
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Add /mcp endpoint for MCP protocol requests to Auth Proxy API
    const mcpResource = authProxyApi.root.addResource('mcp');
    mcpResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(mcpHandlerFunction)
    );

    new cdk.CfnOutput(this, 'McpEndpoint', {
      value: `${authProxyApi.url}mcp`,
      description: 'MCP Protocol Endpoint URL',
      exportName: 'McpEndpoint',
    });
  }
}
