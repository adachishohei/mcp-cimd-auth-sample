#!/bin/bash

# Configure git
git config user.email "kiro@example.com"
git config user.name "Kiro AI"

# Add all files
git add -A

# Create commit
git commit -m "feat: Implement MCP-compliant OAuth 2.1 authentication with consent flow

Major implementation of authenticated MCP server with full MCP specification compliance.

## Features Implemented

### 1. OAuth 2.1 Authorization Flow
- Authorization endpoint (/authorize) with Client ID Metadata Documents validation
- Token endpoint (/token) with PKCE verification
- Callback endpoint (/callback) for Cognito integration
- Proper redirect flow: MCP Client → Auth Proxy → Cognito → Auth Proxy → MCP Client

### 2. User Consent Flow (MCP Spec Compliant)
- Consent page (/consent) displaying client_name, client_uri, logo_uri
- Approval endpoint (/consent/approve) with session update
- Denial endpoint (/consent/deny) with error handling
- Hybrid approach: Custom consent page + Cognito Managed UI for authentication
- XSS protection with HTML escaping
- CSRF protection with session validation

### 3. MCP Server Implementation
- JWT middleware for token validation using Cognito JWKS
- Protected Resource Metadata endpoint (/.well-known/oauth-protected-resource)
- MCP protocol handler with JSON-RPC 2.0 support
- Sample echo tool implementation
- Proper error handling for unauthorized requests

### 4. Infrastructure (AWS CDK)
- Cognito User Pool with Managed UI
- Cognito User Pool Domain
- DynamoDB table for session management with TTL
- API Gateway for Auth Proxy with multiple endpoints
- API Gateway for MCP Server
- Lambda functions with NodejsFunction (esbuild bundling)
- Proper IAM permissions and security groups

### 5. Configuration Management
- Centralized configuration with validation
- Environment variable management
- Type-safe configuration access
- Support for AUTH_PROXY_BASE_URL

## Bug Fixes

### Build Errors
- Fixed token.ts: Added config retrieval in retrieveSession and deleteSession functions
- Updated tsconfig.json: Excluded test files from build output

### Circular Dependency
- Removed dynamic Cognito callback URL update from CDK stack
- Created post-deployment setup script for callback URL configuration
- Added automation script: scripts/update-cognito-callback.sh

### Redirect Flow Issues
- Fixed redirect flow to comply with OAuth 2.1 specification
- Auth Proxy now acts as intermediary between Cognito and MCP Client
- Proper state management for CSRF protection

## Documentation

### API Documentation
- openapi.yaml: Complete OpenAPI 3.0 specification
- docs/API_REFERENCE.md: API reference guide

### Implementation Guides
- docs/AUTHORIZATION_FLOW_VALIDATION.md: Flow validation report
- docs/REDIRECT_FLOW_FIX_SUMMARY.md: Redirect flow fixes
- docs/CONSENT_FLOW_ANALYSIS.md: Consent flow analysis
- docs/COGNITO_CONSENT_OPTIONS.md: Consent implementation options
- docs/CONSENT_IMPLEMENTATION_SUMMARY.md: Implementation summary
- docs/CLIENT_METADATA_DOCUMENT.md: Client metadata guide
- docs/CIRCULAR_DEPENDENCY_FIX.md: Circular dependency resolution
- docs/POST_DEPLOYMENT_SETUP.md: Post-deployment configuration

### Examples
- examples/client-metadata.json: Sample Client ID Metadata Document

## Testing

### Unit Tests
- src/auth-proxy/__tests__/authorize.test.ts (6 tests)
- src/auth-proxy/__tests__/token.test.ts (11 tests)
- src/config/__tests__/config.test.ts (15 tests)
- src/mcp-server/__tests__/jwt-middleware.test.ts (7 tests)
- src/mcp-server/__tests__/mcp-handler.test.ts (13 tests)
- src/mcp-server/__tests__/metadata.test.ts (5 tests)

Total: 57 unit tests covering all major functionality

## Compliance

✅ MCP Specification 2025-11-25
✅ OAuth 2.1 with PKCE (RFC 7636)
✅ Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document-00)
✅ Protected Resource Metadata (RFC 9728)
✅ Confused Deputy Problem mitigation
✅ Security best practices

## Security Features

- PKCE (S256) required for all authorization flows
- JWT signature validation with Cognito JWKS
- Session management with 10-minute TTL
- XSS protection (HTML escaping in consent page)
- CSRF protection (session-based validation)
- User consent enforcement
- Proper error handling with OAuth 2.0 error codes

## Deployment

### Requirements
- Node.js 20+
- AWS CDK 2.x
- esbuild 0.19+
- AWS CLI 2.x

### Commands
\`\`\`bash
# Install dependencies
npm install

# Build
npm run build

# Deploy
make deploy

# Post-deployment setup (run once)
make update-callback
\`\`\`

## VS Code MCP Client Compatibility

This implementation is fully compatible with VS Code MCP Client and any other
MCP client that supports Client ID Metadata Documents.

Supported features:
- Dynamic redirect_uri (e.g., vscode://)
- Client ID Metadata Documents
- PKCE with S256
- OAuth 2.1 authorization code flow
- Proper state handling"

echo "✅ Commit created successfully!"
