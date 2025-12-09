/**
 * Common validation utilities for OAuth 2.1 parameters
 */

import { OAuth2Error } from './errors';

/**
 * Validate authorization request parameters
 */
export function validateAuthorizationRequest(params: {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
}): void {
  // Required parameters
  if (!params.response_type) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: response_type'
    );
  }

  if (params.response_type !== 'code') {
    throw new OAuth2Error(
      'unsupported_response_type',
      'Only response_type=code is supported'
    );
  }

  if (!params.client_id) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: client_id'
    );
  }

  if (!params.redirect_uri) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: redirect_uri'
    );
  }

  // PKCE validation (required in OAuth 2.1)
  if (!params.code_challenge) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: code_challenge (PKCE is required)'
    );
  }

  if (!params.code_challenge_method) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: code_challenge_method'
    );
  }

  if (params.code_challenge_method !== 'S256') {
    throw new OAuth2Error(
      'invalid_request',
      'Only code_challenge_method=S256 is supported'
    );
  }

  // State is recommended but not required
  if (!params.state) {
    console.warn('Authorization request without state parameter (CSRF protection recommended)');
  }
}

/**
 * Validate token request parameters
 */
export function validateTokenRequest(params: {
  grant_type?: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  code_verifier?: string;
}): void {
  if (!params.grant_type) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: grant_type'
    );
  }

  if (params.grant_type !== 'authorization_code') {
    throw new OAuth2Error(
      'unsupported_grant_type',
      'Only grant_type=authorization_code is supported'
    );
  }

  if (!params.code) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: code'
    );
  }

  if (!params.redirect_uri) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: redirect_uri'
    );
  }

  if (!params.client_id) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: client_id'
    );
  }

  // PKCE validation (required in OAuth 2.1)
  if (!params.code_verifier) {
    throw new OAuth2Error(
      'invalid_request',
      'Missing required parameter: code_verifier (PKCE is required)'
    );
  }
}

/**
 * Validate redirect URI format
 */
export function validateRedirectUri(uri: string): void {
  try {
    const url = new URL(uri);
    
    // Allow custom schemes (e.g., vscode://) and standard schemes
    if (!url.protocol) {
      throw new OAuth2Error(
        'invalid_request',
        'Invalid redirect_uri: missing protocol'
      );
    }
  } catch (error) {
    throw new OAuth2Error(
      'invalid_request',
      'Invalid redirect_uri format'
    );
  }
}

/**
 * Validate scope parameter
 */
export function validateScope(scope?: string): void {
  if (!scope) {
    return; // Scope is optional
  }

  const scopes = scope.split(' ');
  const validScopes = ['openid', 'email', 'profile'];

  for (const s of scopes) {
    if (!validScopes.includes(s)) {
      throw new OAuth2Error(
        'invalid_scope',
        `Invalid scope: ${s}. Valid scopes are: ${validScopes.join(', ')}`
      );
    }
  }
}

/**
 * Validate client_id format
 */
export function validateClientId(clientId: string): void {
  if (!clientId || clientId.trim().length === 0) {
    throw new OAuth2Error(
      'invalid_request',
      'client_id cannot be empty'
    );
  }

  // Client ID should be a valid URL for Client ID Metadata Documents
  try {
    new URL(clientId);
  } catch (error) {
    throw new OAuth2Error(
      'invalid_request',
      'client_id must be a valid URL for Client ID Metadata Documents'
    );
  }
}
