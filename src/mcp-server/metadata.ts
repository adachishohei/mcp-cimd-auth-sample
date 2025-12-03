import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ProtectedResourceMetadata } from '../types';
import { getMcpServerConfig, ConfigurationError } from '../config';

/**
 * Protected Resource Metadata endpoint handler
 * Returns OAuth 2.1 protected resource metadata
 * 
 * 要件 4.1: MCPサーバーは/.well-known/oauth-protected-resourceエンドポイントで
 *          Protected Resource Metadataを公開しなければならない
 * 要件 4.2: authorization_serversフィールドを含み、認可プロキシのIssuer URLを指定
 * 要件 4.3: resourceフィールドを含み、MCPサーバーの正規URIを指定
 * 要件 4.4: scopes_supportedフィールドを含み、サポートするスコープを列挙
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Get and validate configuration
    const config = getMcpServerConfig();

    // Build Protected Resource Metadata
    // 要件 4.2, 4.3, 4.4
    const metadata: ProtectedResourceMetadata = {
      resource: config.mcpServerUri,
      authorization_servers: [config.authProxyUri],
      scopes_supported: config.supportedScopes,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: JSON.stringify(metadata),
    };
  } catch (error) {
    console.error('Error generating protected resource metadata:', error);
    
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
