import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handler } from '../auth-server-metadata';
import { APIGatewayProxyEvent } from 'aws-lambda';

describe('Authorization Server Metadata Handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SESSION_TABLE_NAME: 'test-sessions',
      COGNITO_DOMAIN: 'test-domain',
      COGNITO_CLIENT_ID: 'test-client-id',
      COGNITO_REGION: 'us-east-1',
      API_ID: 'test-api-id',
      STAGE_NAME: 'prod',
      AWS_REGION_NAME: 'us-east-1',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return authorization server metadata with all required fields', async () => {
    const event = {} as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Content-Type', 'application/json');

    const metadata = JSON.parse(result.body);

    // RFC 8414 required fields
    expect(metadata).toHaveProperty('issuer');
    expect(metadata.issuer).toBe('https://test-api-id.execute-api.us-east-1.amazonaws.com/prod');

    expect(metadata).toHaveProperty('authorization_endpoint');
    expect(metadata.authorization_endpoint).toBe('https://test-api-id.execute-api.us-east-1.amazonaws.com/prod/authorize');

    expect(metadata).toHaveProperty('token_endpoint');
    expect(metadata.token_endpoint).toBe('https://test-api-id.execute-api.us-east-1.amazonaws.com/prod/token');

    expect(metadata).toHaveProperty('response_types_supported');
    expect(Array.isArray(metadata.response_types_supported)).toBe(true);
    expect(metadata.response_types_supported).toContain('code');

    expect(metadata).toHaveProperty('grant_types_supported');
    expect(Array.isArray(metadata.grant_types_supported)).toBe(true);
    expect(metadata.grant_types_supported).toContain('authorization_code');
    expect(metadata.grant_types_supported).toContain('refresh_token');

    expect(metadata).toHaveProperty('code_challenge_methods_supported');
    expect(Array.isArray(metadata.code_challenge_methods_supported)).toBe(true);
    expect(metadata.code_challenge_methods_supported).toContain('S256');

    expect(metadata).toHaveProperty('token_endpoint_auth_methods_supported');
    expect(Array.isArray(metadata.token_endpoint_auth_methods_supported)).toBe(true);
    expect(metadata.token_endpoint_auth_methods_supported).toContain('none');

    expect(metadata).toHaveProperty('scopes_supported');
    expect(Array.isArray(metadata.scopes_supported)).toBe(true);
    expect(metadata.scopes_supported).toContain('openid');
    expect(metadata.scopes_supported).toContain('email');
    expect(metadata.scopes_supported).toContain('profile');
  });

  it('should return 500 when API_ID is not set', async () => {
    delete process.env.API_ID;
    const event = {} as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error', 'server_error');
  });

  it('should include cache control header', async () => {
    const event = {} as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.headers).toHaveProperty('Cache-Control');
    expect(result.headers?.['Cache-Control']).toContain('max-age');
  });

  it('should include CORS headers', async () => {
    const event = {} as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
  });
});
