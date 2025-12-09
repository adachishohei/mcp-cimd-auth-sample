# Authorization Flow Example

This document provides a complete example of the OAuth 2.1 authorization flow with Client ID Metadata Documents.

## Prerequisites

1. Deployed MCP server with authorization proxy
2. Client ID Metadata Document hosted at an HTTPS URL
3. Cognito User Pool configured

## Step 1: Client ID Metadata Document

The MCP client hosts a JSON document at an HTTPS URL (e.g., `https://example.com/client.json`):

```json
{
  "client_id": "https://example.com/client.json",
  "client_name": "My MCP Client",
  "client_uri": "https://example.com",
  "logo_uri": "https://example.com/logo.png",
  "redirect_uris": [
    "http://localhost:3000/callback",
    "https://example.com/callback"
  ],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

## Step 2: Generate PKCE Parameters

The client generates PKCE parameters:

```javascript
// Generate code_verifier (random string)
const codeVerifier = generateRandomString(128);

// Generate code_challenge (SHA256 hash of verifier, base64url encoded)
const codeChallenge = base64url(sha256(codeVerifier));
```

## Step 3: Authorization Request

The client redirects the user to the authorization endpoint:

```
GET https://auth-proxy.example.com/authorize?
  response_type=code&
  client_id=https://example.com/client.json&
  redirect_uri=http://localhost:3000/callback&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256&
  state=xyz123&
  scope=mcp:tools&
  resource=https://mcp-server.example.com
```

## Step 4: Authorization Proxy Processing

The authorization proxy:

1. Fetches `https://example.com/client.json`
2. Verifies `client_id` matches the URL
3. Verifies `redirect_uri` is in the `redirect_uris` array
4. Stores session data in DynamoDB:
   ```json
   {
     "sessionId": "abc123...",
     "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
     "code_challenge_method": "S256",
     "client_id": "https://example.com/client.json",
     "redirect_uri": "http://localhost:3000/callback",
     "state": "xyz123",
     "created_at": 1234567890,
     "ttl": 1234568490
   }
   ```
5. Redirects to Cognito Managed UI

## Step 5: Cognito Managed UI

The user is redirected to:

```
https://mcp-auth-{account-id}.auth.us-east-1.amazoncognito.com/oauth2/authorize?
  response_type=code&
  client_id={cognito-client-id}&
  redirect_uri=http://localhost:3000/callback&
  scope=openid+email+profile+mcp-server/tools&
  state=xyz123
```

The user logs in via the Cognito Managed UI.

## Step 6: Authorization Code Callback

After successful authentication, Cognito redirects back to the client:

```
http://localhost:3000/callback?
  code=AUTH_CODE_HERE&
  state=xyz123
```

## Step 7: Token Exchange (Next Task)

The client will exchange the authorization code for tokens by calling the `/token` endpoint (to be implemented in task 4):

```
POST https://auth-proxy.example.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTH_CODE_HERE&
redirect_uri=http://localhost:3000/callback&
client_id=https://example.com/client.json&
code_verifier={original_code_verifier}
```

## Security Considerations

1. **HTTPS Required**: Client ID Metadata Documents must be served over HTTPS
2. **PKCE Mandatory**: OAuth 2.1 requires PKCE for all authorization code flows
3. **Redirect URI Validation**: Strict validation prevents authorization code interception
4. **Session TTL**: Sessions expire after 10 minutes to limit exposure
5. **State Parameter**: Recommended for CSRF protection

## Error Scenarios

### Invalid Client ID URL

```
GET /authorize?client_id=http://example.com/client.json&...
```

Response:
```json
{
  "error": "invalid_client",
  "error_description": "client_id must be an HTTPS URL"
}
```

### Client ID Mismatch

Client metadata contains different `client_id`:
```json
{
  "client_id": "https://different.com/client.json",
  ...
}
```

Response:
```json
{
  "error": "invalid_client",
  "error_description": "client_id mismatch: expected https://example.com/client.json, got https://different.com/client.json"
}
```

### Invalid Redirect URI

```
GET /authorize?redirect_uri=http://evil.com/callback&...
```

Response:
```json
{
  "error": "invalid_request",
  "error_description": "redirect_uri http://evil.com/callback not found in client metadata"
}
```

### Missing PKCE

```
GET /authorize?response_type=code&client_id=...&redirect_uri=...
```

Response:
```json
{
  "error": "invalid_request",
  "error_description": "code_challenge is required (PKCE)"
}
```
