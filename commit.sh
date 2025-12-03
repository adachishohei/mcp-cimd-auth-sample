#!/bin/bash

# Git configuration
git config user.email "kiro@example.com" 2>/dev/null || true
git config user.name "Kiro AI" 2>/dev/null || true

# Add all files
git add .

# Commit with detailed message
git commit -m "feat: Implement MCP-compliant OAuth 2.1 authentication with consent flow

This commit implements a complete OAuth 2.1 authentication system for MCP servers
with Client ID Metadata Documents support and user consent flow.

## Major Features

### 1. OAuth 2.1 Authorization Flow
- Authorization endpoint (/authorize) with PKCE validation
- Token endpoint (/token) with code exchange
- Callback endpoint (/callback) for Cognito integration
- Client ID Metadata Documents support

### 2. User Consent Flow (MCP Spec Compliant)
- Consent page (/consent) displaying client_name, client_uri, logo_uri
- Approval endpoint (/consent/approve)
- Denial endpoint (/consent/deny)
- Hybrid approach: Custom consent + Cognito Managed UI

### 3. MCP Server Implementation
- JWT middleware for token validation
- Protected Resource Metadata endpoint
- MCP protocol handler (JSON-RPC 2.0)
- Sample echo tool

### 4. Infrastructure (AWS CDK)
- Cognito User Pool with Managed UI
- DynamoDB for session management
- API Gateway with Lambda functions
- Proper IAM permissions

## Key Files

### New Files
- src/auth-proxy/authorize.ts - Authorization endpoint
- src/auth-proxy/callback.ts - Cognito callback handler
- src/auth-proxy/token.ts - Token exchange endpoint
- src/auth-proxy/consent.ts - Consent page display
- src/auth-proxy/consent-action.ts - Consent approval/denial
- src/mcp-server/jwt-middleware.ts - JWT validation
- src/mcp-server/mcp-handler.ts - MCP protocol handler
- src/mcp-server/metadata.ts - Protected Resource Metadata
- src/config/index.ts - Configuration management
- src/types/index.ts - TypeScript type definitions
- lib/authenticated-mcp-stack.ts - CDK infrastructure

### Documentation
- docs/AUTHORIZATION_FLOW_VALIDATION.md - Flow validation report
- docs/REDIRECT_FLOW_FIX_SUMMARY.md - Redirect flow fixes
- docs/CONSENT_FLOW_ANALYSIS.md - Consent flow analysis
- docs/COGNITO_CONSENT_OPTIONS.md - Consent implementation options
- docs/CONSENT_IMPLEMENTATION_SUMMARY.md - Implementation summary
- docs/CLIENT_METADATA_DOCUMENT.md - Client metadata guide
- openapi.yaml - Complete API specification

## Compliance

✅ MCP Specification 2025-11-25
✅ OAuth 2.1 with PKCE
✅ Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document-00)
✅ Protected Resource Metadata (RFC 9728)
✅ Confused Deputy Problem mitigation

## Security Features

- PKCE (S256) required for all authorization flows
- JWT signature validation with Cognito JWKS
- Session management with TTL
- XSS protection (HTML escaping)
- CSRF protection (session-based)
- User consent enforcement

## Testing

- Unit tests for all major components
- Integration test setup
- Vitest configuration

## Deployment

Requires:
- Node.js 20+
- AWS CDK
- esbuild

Deploy with: make deploy or cdk deploy"

echo "Commit completed successfully!"
