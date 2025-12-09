/**
 * Common mock data and helpers for tests
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';

/**
 * Mock API Gateway event
 */
export function createMockEvent(
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api-id',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource-id',
      resourcePath: '/',
    },
    resource: '/',
    ...overrides,
  };
}

/**
 * Mock Lambda context
 */
export function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

/**
 * Mock authorization request parameters
 */
export const mockAuthRequest = {
  response_type: 'code',
  client_id: 'https://example.com/client-metadata.json',
  redirect_uri: 'vscode://example.vscode-extension',
  code_challenge: 'test-code-challenge',
  code_challenge_method: 'S256',
  state: 'test-state',
  scope: 'openid email profile',
};

/**
 * Mock token request parameters
 */
export const mockTokenRequest = {
  grant_type: 'authorization_code',
  code: 'test-auth-code',
  redirect_uri: 'vscode://example.vscode-extension',
  client_id: 'https://example.com/client-metadata.json',
  code_verifier: 'test-code-verifier',
};

/**
 * Mock session data
 */
export const mockSession = {
  sessionId: 'test-session-id',
  clientId: 'https://example.com/client-metadata.json',
  redirectUri: 'vscode://example.vscode-extension',
  codeChallenge: 'test-code-challenge',
  codeChallengeMethod: 'S256',
  state: 'test-state',
  scope: 'openid email profile',
  authCode: 'test-auth-code',
  consentGiven: false,
  createdAt: Date.now(),
  expiresAt: Date.now() + 600000, // 10 minutes
};

/**
 * Mock Client ID Metadata Document
 */
export const mockClientMetadata = {
  client_name: 'Test MCP Client',
  client_uri: 'https://example.com',
  logo_uri: 'https://example.com/logo.png',
  redirect_uris: ['vscode://example.vscode-extension'],
  grant_types: ['authorization_code'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
};

/**
 * Mock JWT token
 */
export const mockJwtToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE1MTYyMzkwMjJ9.test-signature';

/**
 * Mock Cognito tokens
 */
export const mockCognitoTokens = {
  access_token: mockJwtToken,
  id_token: mockJwtToken,
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'Bearer',
};

/**
 * Mock MCP request
 */
export const mockMcpRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'echo',
    arguments: {
      message: 'Hello, World!',
    },
  },
};

/**
 * Mock MCP response
 */
export const mockMcpResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    content: [
      {
        type: 'text',
        text: 'Echo: Hello, World!',
      },
    ],
  },
};
