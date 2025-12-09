import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../mcp-handler';

// Mock the JWT middleware
vi.mock('../jwt-middleware', () => ({
  verifyJWTMiddleware: vi.fn(),
}));

import { verifyJWTMiddleware } from '../jwt-middleware';

describe('MCP Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MCP_API_ID = 'test-mcp-api';
    process.env.AUTH_API_ID = 'test-auth-api';
    process.env.STAGE_NAME = 'prod';
    process.env.AWS_REGION_NAME = 'us-east-1';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_test123';
    process.env.COGNITO_REGION = 'us-east-1';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    process.env.SUPPORTED_SCOPES = 'openid,email,profile';
  });

  it('should return 401 when JWT verification fails', async () => {
    const mockUnauthorizedResponse = {
      statusCode: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="/.well-known/oauth-protected-resource"',
      },
      body: JSON.stringify({
        error: 'unauthorized',
        error_description: 'Authentication required',
      }),
    };

    vi.mocked(verifyJWTMiddleware).mockResolvedValue({
      authorized: false,
      response: mockUnauthorizedResponse,
    });

    const event = {
      headers: {},
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      }),
    } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    expect(result.headers?.['WWW-Authenticate']).toContain('Bearer realm=');
  });

  it('should process request when JWT verification succeeds', async () => {
    vi.mocked(verifyJWTMiddleware).mockResolvedValue({
      authorized: true,
      payload: {
        sub: 'user-123',
        iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
        aud: 'test-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    const event = {
      headers: {
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      }),
    } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(verifyJWTMiddleware).toHaveBeenCalledWith(
      event,
      'https://test-mcp-api.execute-api.us-east-1.amazonaws.com/prod/.well-known/oauth-protected-resource'
    );
  });

  describe('JSON-RPC 2.0 Parser', () => {
    beforeEach(() => {
      vi.mocked(verifyJWTMiddleware).mockResolvedValue({
        authorized: true,
        payload: {
          sub: 'user-123',
          iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
          aud: 'test-client-id',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
    });

    it('should return parse error for invalid JSON', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: 'invalid json',
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe(-32700);
      expect(body.error.message).toContain('Parse error');
    });

    it('should return parse error for missing jsonrpc field', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          method: 'tools/list',
          id: 1,
        }),
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe(-32700);
    });

    it('should return parse error for missing method field', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
        }),
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe(-32700);
    });
  });

  describe('tools/list handler', () => {
    beforeEach(() => {
      vi.mocked(verifyJWTMiddleware).mockResolvedValue({
        authorized: true,
        payload: {
          sub: 'user-123',
          iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
          aud: 'test-client-id',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
    });

    it('should return list of available tools', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        }),
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe(1);
      expect(body.result.tools).toBeInstanceOf(Array);
      expect(body.result.tools.length).toBeGreaterThan(0);
      expect(body.result.tools[0]).toHaveProperty('name');
      expect(body.result.tools[0]).toHaveProperty('description');
      expect(body.result.tools[0]).toHaveProperty('inputSchema');
    });

    it('should include echo tool in the list', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        }),
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      const body = JSON.parse(result.body);
      const echoTool = body.result.tools.find((t: any) => t.name === 'echo');
      expect(echoTool).toBeDefined();
      expect(echoTool.description).toBeTruthy();
      expect(echoTool.inputSchema.type).toBe('object');
    });
  });

  describe('tools/call handler', () => {
    beforeEach(() => {
      vi.mocked(verifyJWTMiddleware).mockResolvedValue({
        authorized: true,
        payload: {
          sub: 'user-123',
          iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
          aud: 'test-client-id',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
    });

    it('should execute echo tool and return result', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: {
              message: 'Hello, World!',
            },
          },
          id: 2,
        }),
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe(2);
      expect(body.result.content).toBeInstanceOf(Array);
      expect(body.result.content[0].type).toBe('text');
      expect(body.result.content[0].text).toBe('Hello, World!');
    });

    it('should return error for missing tool name', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {},
          id: 3,
        }),
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32602);
      expect(body.error.message).toContain('tool name is required');
    });

    it('should return error for non-existent tool', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'nonexistent',
            arguments: {},
          },
          id: 4,
        }),
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32601);
      expect(body.error.message).toContain('Tool not found');
    });

    it('should return error for missing required arguments', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: {},
          },
          id: 5,
        }),
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32602);
      expect(body.error.message).toContain('message is required');
    });
  });

  describe('Unknown methods', () => {
    beforeEach(() => {
      vi.mocked(verifyJWTMiddleware).mockResolvedValue({
        authorized: true,
        payload: {
          sub: 'user-123',
          iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
          aud: 'test-client-id',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
    });

    it('should return method not found error for unknown methods', async () => {
      const event = {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'unknown/method',
          id: 6,
        }),
      } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32601);
      expect(body.error.message).toContain('Method not found');
    });
  });
});
