import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import * as crypto from 'crypto';

// Create mockSend in hoisted scope
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

// Mock AWS SDK
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: mockSend,
    })),
  },
  GetCommand: vi.fn(),
  DeleteCommand: vi.fn(),
}));

import { handler } from '../token';

// Mock fetch
global.fetch = vi.fn();

describe('Token Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_TABLE_NAME = 'test-sessions';
    process.env.COGNITO_DOMAIN = 'test-domain';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    process.env.COGNITO_REGION = 'us-east-1';
  });

  it('should return 400 when grant_type is missing', async () => {
    const event = {
      body: 'code=test-code',
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('grant_type');
  });

  it('should return 400 when grant_type is not authorization_code', async () => {
    const event = {
      body: 'grant_type=client_credentials&code=test-code',
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('authorization_code');
  });

  it('should return 400 when code is missing', async () => {
    const event = {
      body: 'grant_type=authorization_code',
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('code');
  });

  it('should return 400 when redirect_uri is missing', async () => {
    const event = {
      body: 'grant_type=authorization_code&code=test-code',
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('redirect_uri');
  });

  it('should return 400 when client_id is missing', async () => {
    const event = {
      body: 'grant_type=authorization_code&code=test-code&redirect_uri=http://localhost:3000/callback',
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('client_id');
  });

  it('should return 400 when code_verifier is missing (PKCE required)', async () => {
    const event = {
      body: 'grant_type=authorization_code&code=test-code&redirect_uri=http://localhost:3000/callback&client_id=https://example.com/client.json',
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('code_verifier');
  });

  it('should return 400 when session is not found', async () => {
    mockSend.mockResolvedValueOnce({ Item: null });

    const event = {
      body: 'grant_type=authorization_code&code=test-code&redirect_uri=http://localhost:3000/callback&client_id=https://example.com/client.json&code_verifier=test-verifier&state=test-session',
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_grant');
  });

  it('should return 400 when PKCE verification fails', async () => {
    const codeVerifier = 'test-verifier';
    const wrongChallenge = 'wrong-challenge';

    mockSend.mockResolvedValueOnce({
      Item: {
        sessionId: 'test-session',
        code_challenge: wrongChallenge,
        code_challenge_method: 'S256',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'test-state',
        created_at: Date.now(),
      },
    });

    const event = {
      body: `grant_type=authorization_code&code=test-code&redirect_uri=http://localhost:3000/callback&client_id=https://example.com/client.json&code_verifier=${codeVerifier}&state=test-session`,
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_grant');
    expect(body.error_description).toContain('PKCE');
  });

  it('should return 400 when client_id does not match session', async () => {
    const codeVerifier = 'test-verifier';
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    mockSend.mockResolvedValueOnce({
      Item: {
        sessionId: 'test-session',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'test-state',
        created_at: Date.now(),
      },
    });

    const event = {
      body: `grant_type=authorization_code&code=test-code&redirect_uri=http://localhost:3000/callback&client_id=https://different.com/client.json&code_verifier=${codeVerifier}&state=test-session`,
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_grant');
    expect(body.error_description).toContain('client_id');
  });

  it('should return 400 when redirect_uri does not match session', async () => {
    const codeVerifier = 'test-verifier';
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    mockSend.mockResolvedValueOnce({
      Item: {
        sessionId: 'test-session',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'test-state',
        created_at: Date.now(),
      },
    });

    const event = {
      body: `grant_type=authorization_code&code=test-code&redirect_uri=http://localhost:4000/callback&client_id=https://example.com/client.json&code_verifier=${codeVerifier}&state=test-session`,
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_grant');
    expect(body.error_description).toContain('redirect_uri');
  });

  it('should successfully exchange code for tokens when all validations pass', async () => {
    const codeVerifier = 'test-verifier';
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Mock session retrieval
    mockSend.mockResolvedValueOnce({
      Item: {
        sessionId: 'test-session',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'test-state',
        created_at: Date.now(),
      },
    });

    // Mock session deletion
    mockSend.mockResolvedValueOnce({});

    // Mock Cognito token response
    const mockTokenResponse = {
      access_token: 'test-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'test-refresh-token',
      id_token: 'test-id-token',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    });

    const event = {
      body: `grant_type=authorization_code&code=test-code&redirect_uri=http://localhost:3000/callback&client_id=https://example.com/client.json&code_verifier=${codeVerifier}&state=test-session`,
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.access_token).toBe('test-access-token');
    expect(body.token_type).toBe('Bearer');
    expect(body.expires_in).toBe(3600);
    expect(body.refresh_token).toBe('test-refresh-token');
    expect(body.id_token).toBe('test-id-token');
  });

  it('should return 400 when Cognito token exchange fails', async () => {
    const codeVerifier = 'test-verifier';
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    mockSend.mockResolvedValueOnce({
      Item: {
        sessionId: 'test-session',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        client_id: 'https://example.com/client.json',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'test-state',
        created_at: Date.now(),
      },
    });

    // Mock Cognito error response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Invalid authorization code',
      }),
    });

    const event = {
      body: `grant_type=authorization_code&code=invalid-code&redirect_uri=http://localhost:3000/callback&client_id=https://example.com/client.json&code_verifier=${codeVerifier}&state=test-session`,
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('invalid_grant');
  });
});
