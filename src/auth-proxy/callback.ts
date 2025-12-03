import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { AuthSession } from '../types';
import { OAuth2Error } from '../utils/errors';
import { getAuthProxyConfig } from '../config';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Cognito callback handler
 * Receives authorization code from Cognito and redirects to MCP client
 * 
 * This endpoint acts as a bridge between Cognito and the MCP client:
 * 1. Receives authorization code from Cognito
 * 2. Retrieves the original session data
 * 3. Redirects to the MCP client's redirect_uri with the code
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const config = getAuthProxyConfig();
    const params = event.queryStringParameters || {};
    
    const code = params.code;
    const state = params.state; // This is the sessionId
    const error = params.error;
    const errorDescription = params.error_description;

    // Handle Cognito errors
    if (error) {
      console.error('Cognito error:', error, errorDescription);
      
      // Try to retrieve session to get the original redirect_uri
      if (state) {
        const session = await retrieveSession(config.sessionTableName, state);
        if (session) {
          return redirectToClient(session.redirect_uri, {
            error,
            error_description: errorDescription,
            state: session.state,
          });
        }
      }
      
      // If we can't retrieve the session, return a generic error
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error,
          error_description: errorDescription || 'Authorization failed',
        }),
      };
    }

    // Validate required parameters
    if (!code) {
      throw new OAuth2Error('invalid_request', 'code is required');
    }

    if (!state) {
      throw new OAuth2Error('invalid_request', 'state is required');
    }

    // Retrieve session from DynamoDB
    const session = await retrieveSession(config.sessionTableName, state);
    
    if (!session) {
      throw new OAuth2Error('invalid_request', 'Invalid or expired session');
    }
    
    // Verify that user has consented
    // This prevents bypassing the consent screen
    if (!session.consented) {
      console.error('Consent not granted for session:', state);
      throw new OAuth2Error('access_denied', 'User consent required');
    }

    // Redirect to MCP client with authorization code
    return redirectToClient(session.redirect_uri, {
      code,
      state: session.state, // Return the original state from MCP client
    });
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

/**
 * Create redirect response to MCP client
 */
function redirectToClient(
  redirectUri: string,
  params: Record<string, string | undefined>
): APIGatewayProxyResult {
  const location = buildRedirectUrl(redirectUri, params);
  
  return {
    statusCode: 302,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    },
    body: '',
  };
}
