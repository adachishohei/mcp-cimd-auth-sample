/**
 * Centralized configuration management for the authenticated MCP server
 * 
 * This module provides:
 * - Environment variable definitions
 * - Configuration validation
 * - Type-safe configuration access
 * 
 * 要件: すべて - 環境変数と設定管理
 */

export interface AuthProxyConfig {
  sessionTableName: string;
  cognitoDomain: string;
  cognitoClientId: string;
  cognitoRegion: string;
  authProxyBaseUrl?: string;
}

export interface McpServerConfig {
  mcpServerUri: string;
  authProxyUri: string;
  supportedScopes: string[];
  cognitoUserPoolId: string;
  cognitoRegion: string;
  cognitoClientId: string;
}

export interface AwsConfig {
  region: string;
  accountId?: string;
}

/**
 * Configuration validation error
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Validates that a required environment variable is set
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new ConfigurationError(`Required environment variable ${name} is not set`);
  }
  return value.trim();
}

/**
 * Gets an optional environment variable with a default value
 */
function getEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

/**
 * Validates URL format
 */
function validateUrl(url: string, name: string): void {
  try {
    new URL(url);
  } catch (error) {
    throw new ConfigurationError(`Invalid URL format for ${name}: ${url}`);
  }
}

/**
 * Gets and validates Auth Proxy configuration
 * 
 * Required environment variables:
 * - SESSION_TABLE_NAME: DynamoDB table name for session storage
 * - COGNITO_DOMAIN: Cognito User Pool domain prefix
 * - COGNITO_CLIENT_ID: Cognito User Pool Client ID
 * - COGNITO_REGION or AWS_REGION: AWS region
 * 
 * Optional environment variables:
 * - AUTH_PROXY_BASE_URL: Base URL of the auth proxy (for callback URL construction)
 */
export function getAuthProxyConfig(): AuthProxyConfig {
  const sessionTableName = requireEnv('SESSION_TABLE_NAME');
  const cognitoDomain = requireEnv('COGNITO_DOMAIN');
  const cognitoClientId = requireEnv('COGNITO_CLIENT_ID');
  const cognitoRegion = getEnv('COGNITO_REGION', process.env.AWS_REGION || 'us-east-1');
  const authProxyBaseUrl = process.env.AUTH_PROXY_BASE_URL;

  // Validate configuration
  if (sessionTableName.length === 0) {
    throw new ConfigurationError('SESSION_TABLE_NAME cannot be empty');
  }

  if (cognitoDomain.length === 0) {
    throw new ConfigurationError('COGNITO_DOMAIN cannot be empty');
  }

  if (cognitoClientId.length === 0) {
    throw new ConfigurationError('COGNITO_CLIENT_ID cannot be empty');
  }

  // Validate authProxyBaseUrl if provided
  if (authProxyBaseUrl && authProxyBaseUrl.trim() !== '') {
    validateUrl(authProxyBaseUrl, 'AUTH_PROXY_BASE_URL');
  }

  return {
    sessionTableName,
    cognitoDomain,
    cognitoClientId,
    cognitoRegion,
    authProxyBaseUrl,
  };
}

/**
 * Gets and validates MCP Server configuration
 * 
 * Required environment variables:
 * - MCP_SERVER_URI: Base URI of the MCP server
 * - AUTH_PROXY_URI: Base URI of the auth proxy
 * - COGNITO_USER_POOL_ID: Cognito User Pool ID
 * - COGNITO_CLIENT_ID: Cognito User Pool Client ID
 * - COGNITO_REGION or AWS_REGION: AWS region
 * 
 * Optional environment variables:
 * - SUPPORTED_SCOPES: Comma-separated list of supported OAuth scopes (default: mcp:tools)
 */
export function getMcpServerConfig(): McpServerConfig {
  const mcpServerUri = requireEnv('MCP_SERVER_URI');
  const authProxyUri = requireEnv('AUTH_PROXY_URI');
  const cognitoUserPoolId = requireEnv('COGNITO_USER_POOL_ID');
  const cognitoClientId = requireEnv('COGNITO_CLIENT_ID');
  const cognitoRegion = getEnv('COGNITO_REGION', process.env.AWS_REGION || 'us-east-1');
  const supportedScopesStr = getEnv('SUPPORTED_SCOPES', 'mcp:tools');

  // Validate URLs
  validateUrl(mcpServerUri, 'MCP_SERVER_URI');
  validateUrl(authProxyUri, 'AUTH_PROXY_URI');

  // Parse and validate scopes
  const supportedScopes = supportedScopesStr
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (supportedScopes.length === 0) {
    throw new ConfigurationError('SUPPORTED_SCOPES must contain at least one scope');
  }

  // Validate Cognito User Pool ID format (should be like us-east-1_XXXXXXXXX)
  const userPoolIdPattern = /^[a-z]+-[a-z]+-\d+_[a-zA-Z0-9]+$/;
  if (!userPoolIdPattern.test(cognitoUserPoolId)) {
    throw new ConfigurationError(
      `Invalid COGNITO_USER_POOL_ID format: ${cognitoUserPoolId}. Expected format: region_id (e.g., us-east-1_ABC123)`
    );
  }

  return {
    mcpServerUri,
    authProxyUri,
    supportedScopes,
    cognitoUserPoolId,
    cognitoRegion,
    cognitoClientId,
  };
}

/**
 * Gets AWS configuration
 */
export function getAwsConfig(): AwsConfig {
  const region = getEnv('AWS_REGION', 'us-east-1');
  const accountId = process.env.AWS_ACCOUNT_ID;

  return {
    region,
    accountId,
  };
}

/**
 * Validates all configuration at startup
 * Throws ConfigurationError if any required configuration is missing or invalid
 */
export function validateConfiguration(component: 'auth-proxy' | 'mcp-server'): void {
  try {
    if (component === 'auth-proxy') {
      getAuthProxyConfig();
    } else if (component === 'mcp-server') {
      getMcpServerConfig();
    }
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(`Configuration validation failed: ${error}`);
  }
}
