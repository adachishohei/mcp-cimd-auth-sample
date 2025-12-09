import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthProxyConfig, ConfigurationError } from '../config';

/**
 * Authorization Server Metadata
 * RFC 8414: OAuth 2.0 Authorization Server Metadata
 */
interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  scopes_supported: string[];
}

/**
 * Authorization Server Metadata endpoint handler
 * Returns OAuth 2.0 Authorization Server metadata
 * 
 * RFC 8414: OAuth 2.0 Authorization Server Metadata
 * https://datatracker.ietf.org/doc/html/rfc8414
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Get and validate configuration
    const config = getAuthProxyConfig();

    // Build Authorization Server Metadata
    const metadata: AuthorizationServerMetadata = {
      issuer: config.authProxyBaseUrl,
      authorization_endpoint: `${config.authProxyBaseUrl}/authorize`,
      token_endpoint: `${config.authProxyBaseUrl}/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['openid', 'email', 'profile'],
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(metadata),
    };
  } catch (error) {
    console.error('Error generating authorization server metadata:', error);

    // Handle configuration errors specifically
    if (error instanceof ConfigurationError) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'Server configuration error',
        }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error',
      }),
    };
  }
}
