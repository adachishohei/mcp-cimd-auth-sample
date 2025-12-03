#!/bin/bash

# Script to verify Cognito User Pool configuration
# Usage: ./scripts/verify-cognito-setup.sh <user-pool-id>

set -e

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <user-pool-id>"
    echo "Example: $0 us-east-1_XXXXXXXXX"
    exit 1
fi

USER_POOL_ID=$1

echo "Verifying Cognito User Pool: $USER_POOL_ID"
echo ""

# Get User Pool details
echo "=== User Pool Configuration ==="
aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" \
    --query 'UserPool.{Name:Name,Status:Status,MfaConfiguration:MfaConfiguration}' \
    --output table

echo ""
echo "=== User Pool Clients ==="
CLIENT_IDS=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" \
    --query 'UserPoolClients[*].ClientId' --output text)

for CLIENT_ID in $CLIENT_IDS; do
    echo "Client ID: $CLIENT_ID"
    aws cognito-idp describe-user-pool-client \
        --user-pool-id "$USER_POOL_ID" \
        --client-id "$CLIENT_ID" \
        --query 'UserPoolClient.{Name:ClientName,AllowedOAuthFlows:AllowedOAuthFlows,AllowedOAuthScopes:AllowedOAuthScopes,CallbackURLs:CallbackURLs}' \
        --output table
    echo ""
done

echo "=== User Pool Domain ==="
aws cognito-idp describe-user-pool-domain \
    --domain "mcp-auth-$(aws sts get-caller-identity --query Account --output text)" \
    --query 'DomainDescription.{Domain:Domain,Status:Status}' \
    --output table 2>/dev/null || echo "Domain not found or not configured"

echo ""
echo "Verification complete!"
