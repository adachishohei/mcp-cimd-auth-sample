import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { AuthSession } from '../types';
import { OAuth2Error } from '../utils/errors';
import { getAuthProxyConfig } from '../config';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Consent page handler
 * Displays MCP client information and requests user consent
 * 
 * This implements the MCP specification requirement to display
 * client_name and other metadata before authentication.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const config = getAuthProxyConfig();
    const sessionId = event.queryStringParameters?.session;
    
    if (!sessionId) {
      throw new OAuth2Error('invalid_request', 'session parameter is required');
    }
    
    // Retrieve session from DynamoDB
    const session = await retrieveSession(config.sessionTableName, sessionId);
    
    if (!session) {
      throw new OAuth2Error('invalid_request', 'Invalid or expired session');
    }
    
    // Check if already consented (prevent replay)
    if (session.consented) {
      throw new OAuth2Error('invalid_request', 'Session already used');
    }
    
    // Render consent page with client metadata
    const html = renderConsentPage({
      clientName: session.clientMetadata.client_name,
      clientUri: session.clientMetadata.client_uri,
      logoUri: session.clientMetadata.logo_uri,
      scopes: parseScopes(session.scope),
      sessionId,
      authProxyBaseUrl: config.authProxyBaseUrl || '',
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
      body: html,
    };
  } catch (error) {
    if (error instanceof OAuth2Error) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: error.error,
          error_description: error.error_description,
        }),
      };
    }
    
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'An unexpected error occurred',
      }),
    };
  }
}

/**
 * Retrieve session from DynamoDB
 */
async function retrieveSession(
  tableName: string,
  sessionId: string
): Promise<AuthSession | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { sessionId },
      })
    );
    
    if (!result.Item) {
      return null;
    }
    
    return result.Item as AuthSession;
  } catch (error) {
    console.error('Failed to retrieve session:', error);
    return null;
  }
}

/**
 * Parse scope string into array
 */
function parseScopes(scope?: string): string[] {
  if (!scope) {
    return ['openid', 'email', 'profile', 'mcp:tools'];
  }
  return scope.split(' ').filter(s => s.length > 0);
}

/**
 * Get human-readable description for scope
 */
function getScopeDescription(scope: string): string {
  const descriptions: Record<string, string> = {
    'openid': 'Access your basic profile',
    'email': 'Access your email address',
    'profile': 'Access your profile information',
    'mcp:tools': 'Access MCP tools and resources',
    'mcp-server/tools': 'Access MCP server tools',
  };
  return descriptions[scope] || scope;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Render consent page HTML
 */
function renderConsentPage(data: {
  clientName: string;
  clientUri?: string;
  logoUri?: string;
  scopes: string[];
  sessionId: string;
  authProxyBaseUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorization Request</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }
    
    .consent-box {
      background: white;
      padding: 2.5rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 450px;
      width: 100%;
      text-align: center;
    }
    
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      border-radius: 12px;
      object-fit: contain;
      background: #f5f5f5;
      padding: 0.5rem;
    }
    
    h1 {
      font-size: 1.75rem;
      margin: 0 0 0.5rem;
      color: #1a1a1a;
      font-weight: 600;
    }
    
    .client-uri {
      color: #666;
      font-size: 0.875rem;
      margin-bottom: 2rem;
      word-break: break-all;
    }
    
    .client-uri a {
      color: #667eea;
      text-decoration: none;
    }
    
    .client-uri a:hover {
      text-decoration: underline;
    }
    
    .permissions {
      text-align: left;
      margin: 2rem 0;
      padding: 1.5rem;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .permissions h2 {
      font-size: 1rem;
      margin: 0 0 1rem;
      color: #1a1a1a;
      font-weight: 600;
    }
    
    .permissions ul {
      margin: 0;
      padding-left: 0;
      list-style: none;
    }
    
    .permissions li {
      margin: 0.75rem 0;
      color: #4b5563;
      padding-left: 1.75rem;
      position: relative;
    }
    
    .permissions li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #10b981;
      font-weight: bold;
    }
    
    .info-text {
      color: #6b7280;
      font-size: 0.875rem;
      margin: 1.5rem 0;
      line-height: 1.5;
    }
    
    .buttons {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }
    
    .buttons form {
      flex: 1;
    }
    
    button {
      width: 100%;
      padding: 0.875rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .approve {
      background: #667eea;
      color: white;
    }
    
    .approve:hover {
      background: #5568d3;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .approve:active {
      transform: translateY(0);
    }
    
    .deny {
      background: #f3f4f6;
      color: #374151;
    }
    
    .deny:hover {
      background: #e5e7eb;
    }
    
    .security-note {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e5e7eb;
      font-size: 0.75rem;
      color: #9ca3af;
      line-height: 1.5;
    }
    
    @media (max-width: 480px) {
      .consent-box {
        padding: 2rem 1.5rem;
      }
      
      h1 {
        font-size: 1.5rem;
      }
      
      .buttons {
        flex-direction: column-reverse;
      }
    }
  </style>
</head>
<body>
  <div class="consent-box">
    ${data.logoUri ? `<img src="${escapeHtml(data.logoUri)}" alt="${escapeHtml(data.clientName)} Logo" class="logo" onerror="this.style.display='none'">` : ''}
    
    <h1>${escapeHtml(data.clientName)}</h1>
    
    ${data.clientUri ? `<div class="client-uri"><a href="${escapeHtml(data.clientUri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.clientUri)}</a></div>` : ''}
    
    <div class="permissions">
      <h2>This application wants to:</h2>
      <ul>
        ${data.scopes.map(scope => `<li>${escapeHtml(getScopeDescription(scope))}</li>`).join('')}
      </ul>
    </div>
    
    <p class="info-text">
      By approving, you will be redirected to sign in with your credentials.
      You can revoke access at any time from your account settings.
    </p>
    
    <div class="buttons">
      <form method="POST" action="${escapeHtml(data.authProxyBaseUrl)}/consent/deny">
        <input type="hidden" name="session" value="${escapeHtml(data.sessionId)}">
        <button type="submit" class="deny">Deny</button>
      </form>
      <form method="POST" action="${escapeHtml(data.authProxyBaseUrl)}/consent/approve">
        <input type="hidden" name="session" value="${escapeHtml(data.sessionId)}">
        <button type="submit" class="approve">Approve</button>
      </form>
    </div>
    
    <div class="security-note">
      🔒 Your credentials are never shared with this application.
      Authentication is handled securely by the authorization server.
    </div>
  </div>
</body>
</html>`;
}
