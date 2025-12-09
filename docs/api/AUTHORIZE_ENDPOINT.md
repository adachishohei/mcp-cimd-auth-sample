# Authorization Endpoint Implementation

## Overview

This document describes the implementation of the OAuth 2.1 authorization endpoint for the MCP server authentication proxy.

## Implementation Details

### Endpoint: `/authorize`

**Method:** GET

**Purpose:** Initiates the OAuth 2.1 authorization code flow with PKCE (Proof Key for Code Exchange)

### Request Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `response_type` | Yes | Must be "code" |
| `client_id` | Yes | HTTPS URL pointing to Client ID Metadata Document |
| `redirect_uri` | Yes | Callback URL for the client |
| `code_challenge` | Yes | PKCE code challenge (SHA256 hash) |
| `code_challenge_method` | Yes | Must be "S256" |
| `state` | No | Opaque value for CSRF protection |
| `scope` | No | Requested scopes |
| `resource` | No | Target resource identifier |

### Processing Flow

1. **Parameter Validation**
   - Validates all required parameters are present
   - Ensures `response_type` is "code"
   - Ensures `code_challenge_method` is "S256" (OAuth 2.1 requirement)

2. **Client ID Metadata Document Retrieval** (要件 1.2)
   - Fetches the JSON document from the `client_id` URL
   - Validates the URL is HTTPS
   - Parses the JSON response

3. **Client ID Verification** (要件 1.3)
   - Compares the `client_id` field in the metadata document with the request URL
   - Returns error if they don't match exactly

4. **Redirect URI Validation** (要件 1.4)
   - Checks if the requested `redirect_uri` is in the `redirect_uris` array
   - Returns error if not found

5. **Session Storage**
   - Generates a unique session ID
   - Stores PKCE parameters and client information in DynamoDB
   - Sets TTL to 10 minutes for automatic cleanup

6. **Cognito Redirect** (要件 1.5)
   - Constructs Cognito Managed UI authorization URL
   - Returns HTTP 302 redirect response

### Response

**Success (302 Found):**
```
Location: https://{cognito-domain}.auth.{region}.amazoncognito.com/oauth2/authorize?...
```

**Error (400 Bad Request):**
```json
{
  "error": "invalid_request",
  "error_description": "Detailed error message"
}
```

### Error Codes

| Error Code | Description |
|------------|-------------|
| `invalid_request` | Missing or invalid required parameters |
| `invalid_client` | Failed to fetch or validate client metadata |
| `server_error` | Unexpected server error |

## Infrastructure Components

### DynamoDB Table: `mcp-auth-sessions`

**Partition Key:** `sessionId` (String)

**Attributes:**
- `code_challenge`: PKCE code challenge
- `code_challenge_method`: Always "S256"
- `client_id`: Client identifier URL
- `redirect_uri`: Callback URL
- `state`: CSRF token
- `created_at`: Timestamp
- `ttl`: Time-to-live for automatic deletion

### Lambda Function: `AuthorizeFunction`

**Runtime:** Node.js 20.x

**Environment Variables:**
- `SESSION_TABLE_NAME`: DynamoDB table name
- `COGNITO_DOMAIN`: Cognito User Pool domain prefix
- `COGNITO_CLIENT_ID`: Cognito User Pool Client ID
- `COGNITO_REGION`: AWS region

**Permissions:**
- DynamoDB: `PutItem` on session table

### API Gateway

**Endpoint:** `GET /authorize`

**Integration:** Lambda Proxy Integration

## Requirements Validation

✅ **要件 1.1:** Authorization endpoint (`/authorize`) is exposed via API Gateway

✅ **要件 1.2:** Client ID Metadata Document is fetched from the `client_id` URL

✅ **要件 1.3:** The `client_id` in the document is verified to match the URL

✅ **要件 1.4:** The `redirect_uri` is validated against the document's `redirect_uris` array

✅ **要件 1.5:** On successful validation, redirects to Cognito Managed UI

## Testing

Unit tests are provided in `src/auth-proxy/__tests__/authorize.test.ts` covering:
- Missing required parameters
- Invalid parameter values
- PKCE validation
- Client metadata validation

## Next Steps

The next task will implement the token endpoint (`/token`) which:
- Receives the authorization code from Cognito
- Validates the PKCE code_verifier
- Exchanges the code for access tokens
