# Configuration Management

This document describes the centralized configuration management system for the authenticated MCP server.

## Overview

The configuration system provides:
- Centralized environment variable management
- Type-safe configuration access
- Automatic validation of required variables
- Clear error messages for missing or invalid configuration

## Configuration Module

All configuration is managed through the `src/config/index.ts` module, which exports:

### Functions

#### `getAuthProxyConfig(): AuthProxyConfig`

Returns configuration for the authorization proxy Lambda functions (`/authorize` and `/token` endpoints).

**Required Environment Variables:**
- `SESSION_TABLE_NAME`: DynamoDB table name for session storage
- `COGNITO_DOMAIN`: Cognito User Pool domain prefix (without `.auth.region.amazoncognito.com`)
- `COGNITO_CLIENT_ID`: Cognito User Pool Client ID
- `COGNITO_REGION` or `AWS_REGION`: AWS region (defaults to `us-east-1`)

**Returns:**
```typescript
{
  sessionTableName: string;
  cognitoDomain: string;
  cognitoClientId: string;
  cognitoRegion: string;
}
```

**Throws:** `ConfigurationError` if any required variable is missing or invalid

#### `getMcpServerConfig(): McpServerConfig`

Returns configuration for the MCP server Lambda functions (metadata endpoint and MCP protocol handler).

**Required Environment Variables:**
- `MCP_SERVER_URI`: Base URI of the MCP server (must be valid URL)
- `AUTH_PROXY_URI`: Base URI of the auth proxy (must be valid URL)
- `COGNITO_USER_POOL_ID`: Cognito User Pool ID (format: `region_id`, e.g., `us-east-1_ABC123`)
- `COGNITO_CLIENT_ID`: Cognito User Pool Client ID
- `COGNITO_REGION` or `AWS_REGION`: AWS region (defaults to `us-east-1`)

**Optional Environment Variables:**
- `SUPPORTED_SCOPES`: Comma-separated list of OAuth scopes (defaults to `mcp:tools`)

**Returns:**
```typescript
{
  mcpServerUri: string;
  authProxyUri: string;
  supportedScopes: string[];
  cognitoUserPoolId: string;
  cognitoRegion: string;
  cognitoClientId: string;
}
```

**Throws:** `ConfigurationError` if any required variable is missing or invalid

#### `getAwsConfig(): AwsConfig`

Returns general AWS configuration.

**Environment Variables:**
- `AWS_REGION`: AWS region (defaults to `us-east-1`)
- `AWS_ACCOUNT_ID`: AWS account ID (optional)

**Returns:**
```typescript
{
  region: string;
  accountId?: string;
}
```

#### `validateConfiguration(component: 'auth-proxy' | 'mcp-server'): void`

Validates all configuration for the specified component at startup.

**Throws:** `ConfigurationError` if any required configuration is missing or invalid

### Error Handling

The `ConfigurationError` class is thrown when configuration validation fails. It extends the standard `Error` class and includes a descriptive message about what configuration is missing or invalid.

## Usage Examples

### In Lambda Handlers

```typescript
import { getMcpServerConfig, ConfigurationError } from '../config';

export async function handler(event: APIGatewayProxyEvent) {
  try {
    // Get and validate configuration
    const config = getMcpServerConfig();
    
    // Use configuration
    const metadata = {
      resource: config.mcpServerUri,
      authorization_servers: [config.authProxyUri],
      scopes_supported: config.supportedScopes,
    };
    
    return {
      statusCode: 200,
      body: JSON.stringify(metadata),
    };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'Server configuration error',
        }),
      };
    }
    throw error;
  }
}
```

### Validation at Startup

```typescript
import { validateConfiguration } from './config';

// Validate configuration when Lambda cold starts
try {
  validateConfiguration('mcp-server');
} catch (error) {
  console.error('Configuration validation failed:', error);
  throw error;
}
```

## Environment Variable Reference

See `.env.example` for a complete list of environment variables with descriptions and examples.

### Auth Proxy Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_TABLE_NAME` | Yes | - | DynamoDB table name for session storage |
| `COGNITO_DOMAIN` | Yes | - | Cognito User Pool domain prefix |
| `COGNITO_CLIENT_ID` | Yes | - | Cognito User Pool Client ID |
| `COGNITO_REGION` | No | `AWS_REGION` or `us-east-1` | AWS region for Cognito |

### MCP Server Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_SERVER_URI` | Yes | - | Base URI of the MCP server |
| `AUTH_PROXY_URI` | Yes | - | Base URI of the auth proxy |
| `COGNITO_USER_POOL_ID` | Yes | - | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | Yes | - | Cognito User Pool Client ID |
| `COGNITO_REGION` | No | `AWS_REGION` or `us-east-1` | AWS region for Cognito |
| `SUPPORTED_SCOPES` | No | `mcp:tools` | Comma-separated list of OAuth scopes |

## Validation Rules

### URL Validation

URLs must be valid according to the WHATWG URL Standard. Invalid URLs will throw a `ConfigurationError`.

### Cognito User Pool ID Format

The User Pool ID must match the pattern: `region_id` (e.g., `us-east-1_ABC123`)

### Scopes

At least one scope must be specified. Empty or whitespace-only scope lists will use the default value `mcp:tools`.

### Whitespace Handling

All environment variable values are automatically trimmed of leading and trailing whitespace.

## Testing

The configuration module includes comprehensive unit tests in `src/config/__tests__/config.test.ts` that verify:
- Successful configuration retrieval with valid environment variables
- Proper error handling for missing required variables
- URL validation
- User Pool ID format validation
- Scope parsing and validation
- Whitespace trimming
- Default value handling

## CDK Integration

The CDK stack (`lib/authenticated-mcp-stack.ts`) automatically sets most environment variables for Lambda functions during deployment. After deployment, you may need to update some values manually:

1. Copy the Cognito User Pool ID, Client ID, and Domain from CDK outputs
2. Copy the API Gateway URLs for Auth Proxy and MCP Server from CDK outputs
3. Update Lambda function environment variables if needed

## Migration from Direct Environment Access

If you're migrating from direct `process.env` access to the configuration module:

1. Replace `process.env.VARIABLE_NAME` with `config.variableName`
2. Call the appropriate config function at the start of your handler
3. Handle `ConfigurationError` exceptions appropriately
4. Update tests to set environment variables in `beforeEach` hooks

Example migration:

```typescript
// Before
const sessionTableName = process.env.SESSION_TABLE_NAME || 'default';

// After
const config = getAuthProxyConfig();
const sessionTableName = config.sessionTableName;
```
