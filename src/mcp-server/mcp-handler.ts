import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { verifyJWTMiddleware } from './jwt-middleware';
import { MCPRequest, MCPResponse, MCPTool } from '../types';
import { getMcpServerConfig } from '../config';

/**
 * Sample echo tool implementation
 * 要件 6.1: サンプルツールの提供
 */
const echoTool: MCPTool = {
  name: 'echo',
  description: 'Echo back the input message',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to echo back',
      },
    },
    required: ['message'],
  },
};

/**
 * Available MCP tools
 */
const availableTools: MCPTool[] = [echoTool];

/**
 * Parse JSON-RPC 2.0 request
 * 要件 6.1: JSON-RPC 2.0パーサー
 */
function parseJSONRPCRequest(body: string | null): MCPRequest | null {
  if (!body) {
    return null;
  }

  try {
    const parsed = JSON.parse(body);
    
    // Validate JSON-RPC 2.0 structure
    if (parsed.jsonrpc !== '2.0' || !parsed.method || parsed.id === undefined) {
      return null;
    }

    return parsed as MCPRequest;
  } catch (error) {
    return null;
  }
}

/**
 * Create JSON-RPC 2.0 error response
 */
function createErrorResponse(
  id: number | string | null,
  code: number,
  message: string,
  data?: any
): MCPResponse {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      data,
    },
    id: id ?? null as any,
  };
}

/**
 * Create JSON-RPC 2.0 success response
 */
function createSuccessResponse(id: number | string, result: any): MCPResponse {
  return {
    jsonrpc: '2.0',
    result,
    id,
  };
}

/**
 * Handle tools/list request
 * 要件 6.2: tools/listハンドラー
 */
function handleToolsList(request: MCPRequest): MCPResponse {
  return createSuccessResponse(request.id, {
    tools: availableTools,
  });
}

/**
 * Handle tools/call request
 * 要件 6.3: tools/callハンドラー
 */
function handleToolsCall(request: MCPRequest): MCPResponse {
  const { params } = request;

  if (!params || !params.name) {
    return createErrorResponse(
      request.id,
      -32602,
      'Invalid params: tool name is required'
    );
  }

  const tool = availableTools.find((t) => t.name === params.name);

  if (!tool) {
    return createErrorResponse(
      request.id,
      -32601,
      `Tool not found: ${params.name}`
    );
  }

  // Execute the tool based on its name
  if (tool.name === 'echo') {
    const { arguments: args } = params;

    if (!args || !args.message) {
      return createErrorResponse(
        request.id,
        -32602,
        'Invalid params: message is required for echo tool'
      );
    }

    return createSuccessResponse(request.id, {
      content: [
        {
          type: 'text',
          text: args.message,
        },
      ],
    });
  }

  return createErrorResponse(
    request.id,
    -32603,
    'Internal error: tool execution not implemented'
  );
}

/**
 * Process MCP request
 * 要件 6.1, 6.2, 6.3: MCPプロトコル処理
 */
function processMCPRequest(request: MCPRequest): MCPResponse {
  switch (request.method) {
    case 'tools/list':
      return handleToolsList(request);
    case 'tools/call':
      return handleToolsCall(request);
    default:
      return createErrorResponse(
        request.id,
        -32601,
        `Method not found: ${request.method}`
      );
  }
}

/**
 * MCP protocol handler
 * Validates JWT tokens and processes MCP requests
 * 要件 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Get configuration
  let config;
  try {
    config = getMcpServerConfig();
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Server configuration error',
      }),
    };
  }
  
  const protectedResourceMetadataUrl = `${config.mcpServerUri}/.well-known/oauth-protected-resource`;

  // Verify JWT token using middleware
  // 要件 5.1, 5.2, 5.3, 5.4, 5.5
  const authResult = await verifyJWTMiddleware(event, protectedResourceMetadataUrl);

  // 要件 5.1, 5.5: 未認証または無効なトークンの拒否
  if (!authResult.authorized) {
    return authResult.response!;
  }

  // Token is valid, proceed with MCP request processing
  // 要件 5.4: 有効なトークンの処理
  
  // Parse JSON-RPC 2.0 request
  const mcpRequest = parseJSONRPCRequest(event.body);

  if (!mcpRequest) {
    const errorResponse = createErrorResponse(
      null,
      -32700,
      'Parse error: Invalid JSON-RPC 2.0 request'
    );
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorResponse),
    };
  }

  // Process MCP request
  const mcpResponse = processMCPRequest(mcpRequest);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mcpResponse),
  };
}
