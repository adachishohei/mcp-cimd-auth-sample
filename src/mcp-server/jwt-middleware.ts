import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { getMcpServerConfig } from '../config';

/**
 * JWT verification middleware for MCP server
 * 要件 5.1, 5.2, 5.3, 5.4, 5.5
 */

interface JWTVerificationResult {
  isValid: boolean;
  payload?: JWTPayload;
  error?: string;
  errorDescription?: string;
}

/**
 * Extract Bearer token from Authorization header
 * 要件 5.1: Authorizationヘッダーの抽出
 */
export function extractBearerToken(event: APIGatewayProxyEvent): string | null {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Create 401 Unauthorized response with WWW-Authenticate header
 * 要件 5.1, 5.2: WWW-Authenticateヘッダーを含む401レスポンス
 */
export function createUnauthorizedResponse(
  realm: string,
  error?: string,
  errorDescription?: string
): APIGatewayProxyResult {
  let wwwAuthenticate = `Bearer realm="${realm}"`;
  
  if (error) {
    wwwAuthenticate += `, error="${error}"`;
  }
  
  if (errorDescription) {
    wwwAuthenticate += `, error_description="${errorDescription}"`;
  }

  return {
    statusCode: 401,
    headers: {
      'WWW-Authenticate': wwwAuthenticate,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      error: error || 'unauthorized',
      error_description: errorDescription || 'Authentication required',
    }),
  };
}

/**
 * Verify JWT token using Cognito JWKS
 * 要件 5.3: CognitoのJWKSを使用したJWT検証
 */
export async function verifyJWT(
  token: string,
  userPoolId: string,
  region: string,
  clientId: string
): Promise<JWTVerificationResult> {
  try {
    // Construct Cognito JWKS URL
    const jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    
    // Create JWKS client
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));

    // Verify JWT signature and claims
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      audience: clientId,
    });

    // Additional expiration check (jwtVerify already checks exp, but we verify it explicitly)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        isValid: false,
        error: 'invalid_token',
        errorDescription: 'Token has expired',
      };
    }

    return {
      isValid: true,
      payload,
    };
  } catch (error: any) {
    // Handle different JWT verification errors
    if (error.code === 'ERR_JWT_EXPIRED') {
      return {
        isValid: false,
        error: 'invalid_token',
        errorDescription: 'Token has expired',
      };
    }

    if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      return {
        isValid: false,
        error: 'invalid_token',
        errorDescription: 'Invalid token signature',
      };
    }

    if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      return {
        isValid: false,
        error: 'invalid_token',
        errorDescription: `Token claim validation failed: ${error.message}`,
      };
    }

    // Generic error
    return {
      isValid: false,
      error: 'invalid_token',
      errorDescription: 'Token validation failed',
    };
  }
}

/**
 * JWT verification middleware
 * Validates JWT tokens and returns appropriate responses
 * 要件 5.1, 5.2, 5.3, 5.4, 5.5
 */
export async function verifyJWTMiddleware(
  event: APIGatewayProxyEvent,
  protectedResourceMetadataUrl: string
): Promise<{ authorized: boolean; response?: APIGatewayProxyResult; payload?: JWTPayload }> {
  // Extract token from Authorization header
  const token = extractBearerToken(event);

  // 要件 5.1: Authorizationヘッダーなしのリクエストを拒否
  if (!token) {
    return {
      authorized: false,
      response: createUnauthorizedResponse(protectedResourceMetadataUrl),
    };
  }

  // Get and validate configuration
  let config;
  try {
    config = getMcpServerConfig();
  } catch (error) {
    return {
      authorized: false,
      response: {
        statusCode: 500,
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'Server configuration error',
        }),
      },
    };
  }

  // Verify JWT token
  const verificationResult = await verifyJWT(
    token,
    config.cognitoUserPoolId,
    config.cognitoRegion,
    config.cognitoClientId
  );

  // 要件 5.4: 有効なトークンの処理
  if (verificationResult.isValid) {
    return {
      authorized: true,
      payload: verificationResult.payload,
    };
  }

  // 要件 5.5: 無効なトークンの拒否
  return {
    authorized: false,
    response: createUnauthorizedResponse(
      protectedResourceMetadataUrl,
      verificationResult.error,
      verificationResult.errorDescription
    ),
  };
}
