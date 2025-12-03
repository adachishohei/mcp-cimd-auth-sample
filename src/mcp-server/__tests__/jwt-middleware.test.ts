import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import {
  extractBearerToken,
  createUnauthorizedResponse,
  verifyJWT,
  verifyJWTMiddleware,
} from '../jwt-middleware';

describe('JWT Middleware', () => {
  describe('extractBearerToken', () => {
    it('should extract token from Authorization header', () => {
      const event = {
        headers: {
          Authorization: 'Bearer test-token-123',
        },
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const token = extractBearerToken(event);
      expect(token).toBe('test-token-123');
    });

    it('should extract token from lowercase authorization header', () => {
      const event = {
        headers: {
          authorization: 'Bearer test-token-456',
        },
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const token = extractBearerToken(event);
      expect(token).toBe('test-token-456');
    });

    it('should return null when Authorization header is missing', () => {
      const event = {
        headers: {},
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const token = extractBearerToken(event);
      expect(token).toBeNull();
    });

    it('should return null when Authorization header does not start with Bearer', () => {
      const event = {
        headers: {
          Authorization: 'Basic dXNlcjpwYXNz',
        },
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const token = extractBearerToken(event);
      expect(token).toBeNull();
    });

    it('should return null when Authorization header format is invalid', () => {
      const event = {
        headers: {
          Authorization: 'Bearer',
        },
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const token = extractBearerToken(event);
      expect(token).toBeNull();
    });
  });

  describe('createUnauthorizedResponse', () => {
    it('should create 401 response with WWW-Authenticate header containing realm', () => {
      const response = createUnauthorizedResponse('/.well-known/oauth-protected-resource');

      expect(response.statusCode).toBe(401);
      expect(response.headers?.['WWW-Authenticate']).toBe(
        'Bearer realm="/.well-known/oauth-protected-resource"'
      );
    });

    it('should include error in WWW-Authenticate header when provided', () => {
      const response = createUnauthorizedResponse(
        '/.well-known/oauth-protected-resource',
        'invalid_token'
      );

      expect(response.statusCode).toBe(401);
      expect(response.headers?.['WWW-Authenticate']).toBe(
        'Bearer realm="/.well-known/oauth-protected-resource", error="invalid_token"'
      );
    });

    it('should include error_description in WWW-Authenticate header when provided', () => {
      const response = createUnauthorizedResponse(
        '/.well-known/oauth-protected-resource',
        'invalid_token',
        'Token has expired'
      );

      expect(response.statusCode).toBe(401);
      expect(response.headers?.['WWW-Authenticate']).toBe(
        'Bearer realm="/.well-known/oauth-protected-resource", error="invalid_token", error_description="Token has expired"'
      );
    });

    it('should include error details in response body', () => {
      const response = createUnauthorizedResponse(
        '/.well-known/oauth-protected-resource',
        'invalid_token',
        'Token has expired'
      );

      const body = JSON.parse(response.body);
      expect(body.error).toBe('invalid_token');
      expect(body.error_description).toBe('Token has expired');
    });
  });

  describe('verifyJWTMiddleware', () => {
    beforeEach(() => {
      // Set up environment variables
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_test123';
      process.env.COGNITO_REGION = 'us-east-1';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';
    });

    it('should return unauthorized when Authorization header is missing', async () => {
      const event = {
        headers: {},
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await verifyJWTMiddleware(
        event,
        '/.well-known/oauth-protected-resource'
      );

      expect(result.authorized).toBe(false);
      expect(result.response?.statusCode).toBe(401);
      expect(result.response?.headers?.['WWW-Authenticate']).toContain('Bearer realm=');
    });

    it('should return server error when environment variables are missing', async () => {
      delete process.env.COGNITO_USER_POOL_ID;

      const event = {
        headers: {
          Authorization: 'Bearer test-token',
        },
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await verifyJWTMiddleware(
        event,
        '/.well-known/oauth-protected-resource'
      );

      expect(result.authorized).toBe(false);
      expect(result.response?.statusCode).toBe(500);
    });
  });
});
