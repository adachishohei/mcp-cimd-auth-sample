#!/bin/bash

# Script to create a test user in Cognito User Pool
# Usage: ./scripts/create-test-user.sh <user-pool-id> <email> <password>

set -e

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <user-pool-id> <email> <password>"
    echo "Example: $0 us-east-1_XXXXXXXXX test@example.com TestPassword123!"
    exit 1
fi

USER_POOL_ID=$1
EMAIL=$2
PASSWORD=$3

# Generate a unique username (email prefix + random suffix)
USERNAME=$(echo "$EMAIL" | cut -d'@' -f1)_$(date +%s)

echo "Creating test user in User Pool: $USER_POOL_ID"
echo "Email: $EMAIL"
echo "Username: $USERNAME"

# Create user
aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USERNAME" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --message-action SUPPRESS

echo "User created successfully"

# Set permanent password
aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USERNAME" \
    --password "$PASSWORD" \
    --permanent

echo "Password set successfully"
echo ""
echo "Test user created:"
echo "  Username: $USERNAME"
echo "  Email: $EMAIL"
echo "  Password: $PASSWORD"
echo ""
echo "IMPORTANT: When logging in, use the EMAIL address ($EMAIL), not the username."
echo "Cognito is configured with email alias, so you can sign in with your email."
