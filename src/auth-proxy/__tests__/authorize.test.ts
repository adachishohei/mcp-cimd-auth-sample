import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../authorize';
import { createMockEvent } from '../../__tests__/helpers/mocks';
import { assertOAuth2Error } from '../../__tests__/helpers/assertions';

// Mock AWS SDK
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn().mockResolvedValue({}),
    })),
  },
  PutCommand: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('Authorization Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_TABLE_NAME = 'test-sessions';
    process.env.COGNITO_DOMAIN = 'test-domain';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    process.env.COGNITO_REGION = 'us-east-1';
    process.env.API_ID = 'test-api-id';
    process.env.STAGE_NAME = 'prod';
    process.env.AWS_REGION_NAME = 'us-east-1';
  });

  it('should return 400 when response_type is missing', async () => {
    const event = createMockEvent({
      queryStringParameters: {},
    });

    const result = await handler(event);

    assertOAuth2Error(result, 'invalid_request');
  });

  it('should return 400 when client_id is missing', async () => {
    const event = createMockEvent({
      queryStringParameters: {
        response_type: 'code',
      },
    });

    const result = await handler(event);

    assertOAuth2Error(result, 'invalid_request');
    const body = JSON.parse(result.body);
    expect(body.error_description).toContain('client_id');
  });

  it('should return 400 when redirect_uri is missing', async () => {
    const event = createMockEvent({
      queryStringParameters: {
        response_type: 'code',
        client_id: 'https://example.com/client.json',
      },
    });

    const result = await handler(event);

    assertOAuth2Error(result, 'invalid_request');
    const body = JSON.parse(result.body);
    expect(body.error_description).toContain('redirect_uri');
  });

  it('should return 400 when code_challenge is missing (PKCE required)', async () => {
    const event = createMockEvent({
      queryStringParameters: {
        response_type: 'code',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
      },
    });

    const result = await handler(event);

    assertOAuth2Error(result, 'invalid_request');
    const body = JSON.parse(result.body);
    expect(body.error_description).toContain('code_challenge');
  });

  it('should return 400 when code_challenge_method is not S256', async () => {
    const event = createMockEvent({
      queryStringParameters: {
        response_type: 'code',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
        code_challenge: 'test-challenge',
        code_challenge_method: 'plain',
        state: 'test-state',
      },
    });

    const result = await handler(event);

    assertOAuth2Error(result, 'invalid_request');
    const body = JSON.parse(result.body);
    expect(body.error_description).toContain('S256');
  });

  it('should return 400 when state parameter is missing', async () => {
    const event = createMockEvent({
      queryStringParameters: {
        response_type: 'code',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      },
    });

    const result = await handler(event);

    assertOAuth2Error(result, 'invalid_request');
    const body = JSON.parse(result.body);
    expect(body.error_description).toContain('state');
    expect(body.error_description).toContain('CSRF');
  });

  it('should accept valid authorization request with state parameter', async () => {
    // Mock successful client metadata fetch
    const mockClientMetadata = {
      client_id: 'https://example.com/client.json',
      client_name: 'Test Client',
      redirect_uris: ['http://localhost:3000/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockClientMetadata,
    });

    const event = createMockEvent({
      queryStringParameters: {
        response_type: 'code',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
        state: 'test-state-value',
      },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(302);
    expect(result.headers?.Location).toBeDefined();
  });
});
