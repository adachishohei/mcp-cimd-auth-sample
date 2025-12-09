import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handler } from '../metadata';
import { APIGatewayProxyEvent } from 'aws-lambda';

describe('Protected Resource Metadata Handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      MCP_API_ID: 'test-mcp-api-id',
      AUTH_API_ID: 'test-auth-api-id',
      STAGE_NAME: 'prod',
      AWS_REGION_NAME: 'us-east-1',
      COGNITO_USER_POOL_ID: 'us-east-1_test123',
      COGNITO_CLIENT_ID: 'test-client-id',
      COGNITO_REGION: 'us-east-1',
      SUPPORTED_SCOPES: 'openid,email,profile',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return protected resource metadata with all required fields', async () => {
    const event = {} as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    
    const metadata = JSON.parse(result.body);
    
    // 要件 4.3: resourceフィールドを含む
    expect(metadata).toHaveProperty('resource');
    expect(metadata.resource).toBe('https://test-mcp-api-id.execute-api.us-east-1.amazonaws.com/prod');
    
    // 要件 4.2: authorization_serversフィールドを含む
    expect(metadata).toHaveProperty('authorization_servers');
    expect(Array.isArray(metadata.authorization_servers)).toBe(true);
    expect(metadata.authorization_servers).toContain('https://test-auth-api-id.execute-api.us-east-1.amazonaws.com/prod');
    
    // 要件 4.4: scopes_supportedフィールドを含む
    expect(metadata).toHaveProperty('scopes_supported');
    expect(Array.isArray(metadata.scopes_supported)).toBe(true);
    expect(metadata.scopes_supported).toContain('openid');
    expect(metadata.scopes_supported).toContain('email');
    expect(metadata.scopes_supported).toContain('profile');
  });

  it('should return 500 when MCP_API_ID is not set', async () => {
    delete process.env.MCP_API_ID;
    const event = {} as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error', 'server_error');
  });

  it('should return 500 when AUTH_API_ID is not set', async () => {
    delete process.env.AUTH_API_ID;
    const event = {} as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error', 'server_error');
  });

  it('should support multiple scopes', async () => {
    process.env.SUPPORTED_SCOPES = 'mcp:tools,mcp:resources,openid';
    const event = {} as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const metadata = JSON.parse(result.body);
    expect(metadata.scopes_supported).toEqual(['mcp:tools', 'mcp:resources', 'openid']);
  });

  it('should include cache control header', async () => {
    const event = {} as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.headers).toHaveProperty('Cache-Control');
    expect(result.headers?.['Cache-Control']).toContain('max-age');
  });
});
