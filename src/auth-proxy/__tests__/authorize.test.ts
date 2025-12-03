import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../authorize';

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
  });

  it('should return 400 when response_type is missing', async () => {
    const event = {
      queryStringParameters: {},
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
  });

  it('should return 400 when client_id is missing', async () => {
    const event = {
      queryStringParameters: {
        response_type: 'code',
      },
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('client_id');
  });

  it('should return 400 when redirect_uri is missing', async () => {
    const event = {
      queryStringParameters: {
        response_type: 'code',
        client_id: 'https://example.com/client.json',
      },
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('redirect_uri');
  });

  it('should return 400 when code_challenge is missing (PKCE required)', async () => {
    const event = {
      queryStringParameters: {
        response_type: 'code',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
      },
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('code_challenge');
  });

  it('should return 400 when code_challenge_method is not S256', async () => {
    const event = {
      queryStringParameters: {
        response_type: 'code',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
        code_challenge: 'test-challenge',
        code_challenge_method: 'plain',
      },
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('S256');
  });
});
