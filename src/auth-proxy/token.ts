import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { AuthSession } from '../types';
import { OAuth2Error } from '../utils/errors';
import { getAuthProxyConfig, ConfigurationError } from '../config';
import * as crypto from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Token endpoint handler
 * Validates PKCE and exchanges authorization code for tokens
 * 
 * 要件 2.1, 2.2, 2.3, 2.4, 2.5
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Get and validate configuration
    const config = getAuthProxyConfig();
    
    // Parse form-encoded body
    const body = parseFormBody(event.body || '');

    const grantType = body.grant_type;
    const code = body.code;
    const redirectUri = body.redirect_uri;
    const clientId = body.client_id;
    const codeVerifier = body.code_verifier;
    const state = body.state;

    // Validate required parameters
    if (!grantType || grantType !== 'authorization_code') {
      throw new OAuth2Error('invalid_request', 'grant_type must be "authorization_code"');
    }

    if (!code) {
      throw new OAuth2Error('invalid_request', 'code is required');
    }

    if (!redirectUri) {
      throw new OAuth2Error('invalid_request', 'redirect_uri is required');
    }

    if (!clientId) {
      throw new OAuth2Error('invalid_request', 'client_id is required');
    }

    if (!codeVerifier) {
      throw new OAuth2Error('invalid_request', 'code_verifier is required (PKCE)');
    }

    // Retrieve session from DynamoDB using the state parameter (sessionId)
    // The state parameter is used to maintain session state between authorization and token requests
    const session = state 
      ? await retrieveSession(state)
      : await findSessionByCode(config.sessionTableName, code);

    if (!session) {
      throw new OAuth2Error('invalid_grant', 'Invalid or expired authorization code');
    }

    // 要件 2.2: PKCE検証 - code_verifierを使用してPKCEを検証
    const isValid = await validatePKCE(codeVerifier, session.code_challenge);
    
    // 要件 2.5: PKCE検証が失敗したらエラーレスポンスを返す
    if (!isValid) {
      throw new OAuth2Error('invalid_grant', 'PKCE verification failed');
    }

    // Validate that client_id matches the session
    if (session.client_id !== clientId) {
      throw new OAuth2Error('invalid_grant', 'Invalid or expired authorization code: client_id does not match');
    }

    // Validate that redirect_uri matches the session
    if (session.redirect_uri !== redirectUri) {
      throw new OAuth2Error('invalid_grant', 'Invalid or expired authorization code: redirect_uri does not match');
    }

    // 要件 2.3: PKCE検証が成功したらCognitoのトークンエンドポイントを呼び出す
    // Use the callback URL as redirect_uri (must match the one used in authorization request)
    const cognitoRedirectUri = `${config.authProxyBaseUrl}/callback`;
    const tokens = await exchangeCodeForTokens(config, {
      code,
      redirectUri: cognitoRedirectUri,
    });

    // Delete the session after successful token exchange (one-time use)
    await deleteSession(config.sessionTableName, session.sessionId);

    // 要件 2.4: Cognitoから取得したトークンをMCPクライアントに返す
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
      body: JSON.stringify(tokens),
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
async function retrieveSession(sessionId: string): Promise<AuthSession | null> {
  try {
    const config = getAuthProxyConfig();
    const result = await docClient.send(
      new GetCommand({
        TableName: config.sessionTableName,
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
 * Find session by authorization code
 */
async function findSessionByCode(tableName: string, code: string): Promise<AuthSession | null> {
  try {
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'authorization_code = :code',
        ExpressionAttributeValues: {
          ':code': code,
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0] as AuthSession;
  } catch (error) {
    console.error('Failed to find session by code:', error);
    return null;
  }
}

/**
 * Delete session from DynamoDB
 */
async function deleteSession(tableName: string, sessionId: string): Promise<void> {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { sessionId },
      })
    );
  } catch (error) {
    console.error('Failed to delete session:', error);
    // Non-fatal error - continue
  }
}

/**
 * Validate PKCE code_verifier against code_challenge
 * 要件 2.2
 */
async function validatePKCE(
  codeVerifier: string,
  codeChallenge: string
): Promise<boolean> {
  try {
    // Calculate SHA256 hash of code_verifier
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    
    // Base64URL encode the hash
    const calculatedChallenge = hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Compare with stored code_challenge
    return calculatedChallenge === codeChallenge;
  } catch (error) {
    console.error('PKCE validation error:', error);
    return false;
  }
}

/**
 * Exchange authorization code for tokens with Cognito
 * 要件 2.3, 2.4
 */
async function exchangeCodeForTokens(
  config: { cognitoDomain: string; cognitoRegion: string; cognitoClientId: string },
  params: {
    code: string;
    redirectUri: string;
  }
): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}> {
  const tokenEndpoint = `https://${config.cognitoDomain}.auth.${config.cognitoRegion}.amazoncognito.com/oauth2/token`;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.cognitoClientId,
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as any;
    throw new OAuth2Error(
      'invalid_grant',
      `Failed to exchange code for tokens: ${errorData.error_description || response.statusText}`
    );
  }

  const tokenResponse = await response.json() as {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    id_token?: string;
  };

  return tokenResponse;
}
