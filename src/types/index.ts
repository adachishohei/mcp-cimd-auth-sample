/**
 * Shared type definitions for the authenticated MCP server
 */

/**
 * Client ID Metadata Document
 * As defined in MCP specification
 */
export interface ClientMetadata {
  client_id: string;
  client_name: string;
  client_uri?: string;
  logo_uri?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
}

/**
 * Protected Resource Metadata
 * OAuth 2.1 protected resource metadata
 */
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
}

/**
 * Session data stored in DynamoDB
 */
export interface AuthSession {
  sessionId: string;
  code_challenge: string;
  code_challenge_method: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  scope?: string;
  clientMetadata: ClientMetadata;
  consented: boolean;
  consentedAt?: number;
  created_at: number;
  ttl: number;
  authorization_code?: string;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP JSON-RPC request
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: number | string;
}

/**
 * MCP JSON-RPC response
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}
