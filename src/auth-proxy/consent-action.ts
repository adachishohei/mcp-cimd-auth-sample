import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { AuthSession } from '../types';
import { OAuth2Error } from '../utils/errors';
import { getAuthProxyConfig } from '../config';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Approve consent handler
 * Updates session with consent flag and redirects to Cognito
 */
export async function approveHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const config = getAuthProxyConfig();
    const body = parseFormBody(event.body || '');
    const sessionId = body.session;
    
    if (!sessionId) {
      throw new OAuth2Error('invalid_request', 'session parameter is required');
    }
    
    // Retrieve session
    const session = await retrieveSession(config.sessionTableName, sessionId);
    
    if (!session) {
      throw new OAuth2Error('invalid_request', 'Invalid or expired session');
    }
    
    // Check if already consented
    if (session.consented) {
      throw new OAuth2Error('invalid_request', 'Session already used');
    }
    
    // Update session with consent
    await updateSession(config.sessionTableName, sessionId, {
      consented: true,
      consentedAt: Date.now(),
    });
    
    // Build Cognito authorization URL
    const cognitoAuthUrl = buildCognitoAuthUrl(config, {
      sessionId,
      scope: session.scope,
    });
    
    return {
      statusCode: 302,
      headers: {
        Location: cognitoAuthUrl,
        'Cache-Control': 'no-store',
      },
      body: '',
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
 * Deny consent handler
 * Deletes session and redirects to MCP client with error
 */
export async function denyHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const config = getAuthProxyConfig();
    const body = parseFormBody(event.body || '');
    const sessionId = body.session;
    
    if (!sessionId) {
      throw new OAuth2Error('invalid_request', 'session parameter is required');
    }
    
    // Retrieve session
    const session = await retrieveSession(config.sessionTableName, sessionId);
    
    if (!session) {
      throw new OAuth2Error('invalid_request', 'Invalid or expired session');
    }
    
    // Delete session
    await deleteSession(config.sessionTableName, sessionId);
    
    // Redirect to MCP client with error
    const redirectUrl = buildRedirectUrl(session.redirect_uri, {
      error: 'access_denied',
      error_description: 'User denied access',
      state: session.state,
    });
    
    return {
      statusCode: 302,
      headers: {
        Location: redirectUrl,
        'Cache-Control': 'no-store',
      },
      body: '',
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
 * Parse form-encoded body
 */
function parseFormBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  
  return result;
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
 * Update session in DynamoDB
 */
async function updateSession(
  tableName: string,
  sessionId: string,
  updates: Partial<AuthSession>
): Promise<void> {
  try {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    
    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });
    
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { sessionId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  } catch (error) {
    console.error('Failed to update session:', error);
    throw error;
  }
}

/**
 * Delete session from DynamoDB
 */
async function deleteSession(
  tableName: string,
  sessionId: string
): Promise<void> {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { sessionId },
      })
    );
  } catch (error) {
    console.error('Failed to delete session:', error);
    // Non-fatal error
  }
}

/**
 * Build Cognito authorization URL
 */
function buildCognitoAuthUrl(
  config: { cognitoDomain: string; cognitoRegion: string; cognitoClientId: string; authProxyBaseUrl: string },
  params: {
    sessionId: string;
    scope?: string;
  }
): string {
  const cognitoBaseUrl = `https://${config.cognitoDomain}.auth.${config.cognitoRegion}.amazoncognito.com/oauth2/authorize`;
  
  // Use Auth Proxy's callback endpoint as redirect_uri for Cognito
  const authProxyCallbackUrl = `${config.authProxyBaseUrl}/callback`;
  
  const queryParams = new URLSearchParams({
    response_type: 'code',
    client_id: config.cognitoClientId,
    redirect_uri: authProxyCallbackUrl,
    scope: params.scope || 'openid email profile',
    state: params.sessionId,
  });
  
  return `${cognitoBaseUrl}?${queryParams.toString()}`;
}

/**
 * Build redirect URL with query parameters
 */
function buildRedirectUrl(
  baseUrl: string,
  params: Record<string, string | undefined>
): string {
  const url = new URL(baseUrl);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value);
    }
  });
  
  return url.toString();
}
