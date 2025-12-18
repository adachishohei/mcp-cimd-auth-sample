import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ClientMetadata, AuthSession } from '../types';
import { OAuth2Error } from '../utils/errors';
import { getAuthProxyConfig, ConfigurationError } from '../config';
import * as crypto from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Authorization endpoint handler
 * Implements OAuth 2.1 authorization code flow with PKCE
 * Validates Client ID Metadata Documents
 * 
 * 要件 1.1, 1.2, 1.3, 1.4, 1.5
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Get and validate configuration
    const config = getAuthProxyConfig();
    // Extract query parameters
    const params = event.queryStringParameters || {};
    
    const responseType = params.response_type;
    const clientId = params.client_id;
    const redirectUri = params.redirect_uri;
    const codeChallenge = params.code_challenge;
    const codeChallengeMethod = params.code_challenge_method;
    const state = params.state;
    const scope = params.scope;
    const resource = params.resource;

    // Validate required parameters
    if (!responseType || responseType !== 'code') {
      throw new OAuth2Error('invalid_request', 'response_type must be "code"');
    }

    if (!clientId) {
      throw new OAuth2Error('invalid_request', 'client_id is required');
    }

    if (!redirectUri) {
      throw new OAuth2Error('invalid_request', 'redirect_uri is required');
    }

    if (!codeChallenge) {
      throw new OAuth2Error('invalid_request', 'code_challenge is required (PKCE)');
    }

    if (!codeChallengeMethod || codeChallengeMethod !== 'S256') {
      throw new OAuth2Error('invalid_request', 'code_challenge_method must be S256');
    }

    // State parameter is required for CSRF protection (OAuth 2.1)
    if (!state) {
      throw new OAuth2Error('invalid_request', 'state is required (CSRF protection)');
    }

    // 要件 1.2: client_id（URL形式）からClient ID Metadata Documentを取得
    const clientMetadata = await fetchClientMetadata(clientId);

    // 要件 1.3: ドキュメント内のclient_idがURLと完全に一致することを検証
    if (clientMetadata.client_id !== clientId) {
      throw new OAuth2Error(
        'invalid_client',
        `client_id mismatch: expected ${clientId}, got ${clientMetadata.client_id}`
      );
    }

    // 要件 1.4: redirect_uriがClient ID Metadata Document内のredirect_urisに含まれることを検証
    if (!clientMetadata.redirect_uris.includes(redirectUri)) {
      throw new OAuth2Error(
        'invalid_request',
        `redirect_uri ${redirectUri} not found in client metadata`
      );
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Store session data in DynamoDB with client metadata
    const session: AuthSession = {
      sessionId,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state, // State is now required
      scope,
      clientMetadata, // Store metadata for consent page
      consented: false, // User hasn't consented yet
      created_at: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 600, // 10 minutes TTL
    };

    await docClient.send(
      new PutCommand({
        TableName: config.sessionTableName,
        Item: session,
      })
    );

    // Redirect to consent page (not directly to Cognito)
    // This allows us to display client_name and other metadata
    const consentUrl = `${config.authProxyBaseUrl}/consent?session=${sessionId}`;

    return {
      statusCode: 302,
      headers: {
        Location: consentUrl,
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
 * Fetch Client ID Metadata Document from the client_id URL
 * 要件 1.2
 */
async function fetchClientMetadata(clientId: string): Promise<ClientMetadata> {
  try {
    // Validate that client_id is a valid HTTPS URL
    const url = new URL(clientId);
    if (url.protocol !== 'https:') {
      throw new OAuth2Error(
        'invalid_client',
        'client_id must be an HTTPS URL'
      );
    }

    const response = await fetch(clientId, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new OAuth2Error(
        'invalid_client',
        `Failed to fetch client metadata: HTTP ${response.status}`
      );
    }

    const metadata = await response.json() as ClientMetadata;

    // Validate required fields
    if (!metadata.client_id || !metadata.redirect_uris || !Array.isArray(metadata.redirect_uris)) {
      throw new OAuth2Error(
        'invalid_client',
        'Invalid client metadata: missing required fields'
      );
    }

    return metadata;
  } catch (error) {
    if (error instanceof OAuth2Error) {
      throw error;
    }

    throw new OAuth2Error(
      'invalid_client',
      `Failed to fetch client metadata: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
}


