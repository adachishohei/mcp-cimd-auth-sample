#!/bin/bash

# Update Cognito User Pool Client callback URLs with Auth Proxy callback endpoint
# This script should be run after initial deployment

set -e

STACK_NAME="AuthenticatedMcpStack"

echo "🔍 Fetching stack outputs..."

# Get stack outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

CALLBACK_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`CallbackEndpoint`].OutputValue' \
  --output text)

if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ] || [ -z "$CALLBACK_URL" ]; then
  echo "❌ Error: Could not retrieve stack outputs"
  echo "   USER_POOL_ID: $USER_POOL_ID"
  echo "   CLIENT_ID: $CLIENT_ID"
  echo "   CALLBACK_URL: $CALLBACK_URL"
  exit 1
fi

echo "✅ Stack outputs retrieved:"
echo "   User Pool ID: $USER_POOL_ID"
echo "   Client ID: $CLIENT_ID"
echo "   Callback URL: $CALLBACK_URL"
echo ""

echo "🔄 Updating Cognito User Pool Client..."

# Update User Pool Client with callback URL
aws cognito-idp update-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --callback-urls \
    "$CALLBACK_URL" \
    "http://localhost:3000/callback" \
    "https://localhost:3000/callback" \
  --allowed-o-auth-flows authorization_code \
  --allowed-o-auth-scopes openid email profile mcp-server/tools \
  --allowed-o-auth-flows-user-pool-client \
  --supported-identity-providers COGNITO \
  > /dev/null

echo "✅ Cognito User Pool Client updated successfully!"
echo ""
echo "📋 Callback URLs configured:"
echo "   - $CALLBACK_URL"
echo "   - http://localhost:3000/callback"
echo "   - https://localhost:3000/callback"
echo ""
echo "🎉 Setup complete! You can now test the authorization flow."
