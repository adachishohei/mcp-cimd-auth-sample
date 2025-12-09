# Environment Setup Guide

This guide explains how to set up environment variables for the authenticated MCP server.

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Deploy the CDK stack to create AWS resources:
   ```bash
   npm run deploy
   ```

3. After deployment, the CDK will output important values. Copy these values to your `.env` file:
   - `UserPoolId` → `COGNITO_USER_POOL_ID`
   - `UserPoolClientId` → `COGNITO_CLIENT_ID`
   - `UserPoolDomain` → `COGNITO_DOMAIN`
   - `AuthProxyApiUrl` → `AUTH_PROXY_URI`
   - `McpServerApiUrl` → `MCP_SERVER_URI`

4. The Lambda functions are automatically configured with environment variables during deployment, but you may need to update them if you change configuration.

## Environment Variables by Component

### Auth Proxy (`/authorize` and `/token` endpoints)

These Lambda functions require:

```bash
# DynamoDB table for session storage
SESSION_TABLE_NAME=mcp-auth-sessions

# Cognito configuration
COGNITO_DOMAIN=mcp-auth-123456789012
COGNITO_CLIENT_ID=abc123def456
COGNITO_REGION=us-east-1
```

### MCP Server (metadata and protocol handler)

These Lambda functions require:

```bash
# API Gateway URLs (without trailing slash)
MCP_SERVER_URI=https://abc123.execute-api.us-east-1.amazonaws.com/prod
AUTH_PROXY_URI=https://xyz789.execute-api.us-east-1.amazonaws.com/prod

# Cognito configuration
COGNITO_USER_POOL_ID=us-east-1_ABC123
COGNITO_CLIENT_ID=abc123def456
COGNITO_REGION=us-east-1

# Optional: OAuth scopes (comma-separated)
SUPPORTED_SCOPES=mcp:tools,mcp:resources
```

## Configuration Validation

The system automatically validates configuration when Lambda functions are invoked. If any required environment variable is missing or invalid, the function will return a 500 error with a descriptive message.

### Validation Rules

1. **Required Variables**: Must be set and non-empty
2. **URLs**: Must be valid URLs (checked with WHATWG URL Standard)
3. **User Pool ID**: Must match format `region_id` (e.g., `us-east-1_ABC123`)
4. **Scopes**: At least one scope must be specified

### Common Validation Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Required environment variable X is not set` | Variable is missing or empty | Set the variable in Lambda environment |
| `Invalid URL format for X` | URL is malformed | Check URL format (must include protocol) |
| `Invalid COGNITO_USER_POOL_ID format` | User Pool ID doesn't match pattern | Verify User Pool ID from Cognito console |
| `SUPPORTED_SCOPES must contain at least one scope` | Scopes list is empty | Set at least one scope or remove variable to use default |

## Deployment Workflow

### Initial Deployment

1. **Deploy CDK Stack**:
   ```bash
   npm run deploy
   ```
   This creates all AWS resources with default environment variables.

2. **Note CDK Outputs**:
   The deployment will output important values:
   ```
   Outputs:
   AuthenticatedMcpStack.UserPoolId = us-east-1_ABC123
   AuthenticatedMcpStack.UserPoolClientId = abc123def456
   AuthenticatedMcpStack.UserPoolDomain = mcp-auth-123456789012
   AuthenticatedMcpStack.AuthProxyApiUrl = https://xyz789.execute-api.us-east-1.amazonaws.com/prod/
   AuthenticatedMcpStack.McpServerApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod/
   ```

3. **Verify Configuration**:
   The Lambda functions are automatically configured during deployment. You can verify by:
   - Checking Lambda function environment variables in AWS Console
   - Testing the endpoints
   - Checking CloudWatch Logs for configuration errors

### Updating Configuration

If you need to update environment variables after deployment:

1. **Update CDK Stack** (recommended):
   - Modify `lib/authenticated-mcp-stack.ts`
   - Run `npm run deploy`

2. **Update Lambda Directly** (for testing):
   - Go to AWS Lambda Console
   - Select the function
   - Update environment variables
   - Save changes

## Local Development

For local development and testing:

1. Create a `.env` file with all required variables
2. Use a tool like `dotenv` to load variables in tests
3. The test suite automatically sets environment variables in `beforeEach` hooks

Example test setup:
```typescript
beforeEach(() => {
  process.env.SESSION_TABLE_NAME = 'test-sessions';
  process.env.COGNITO_DOMAIN = 'test-domain';
  process.env.COGNITO_CLIENT_ID = 'test-client-id';
  process.env.COGNITO_REGION = 'us-east-1';
});
```

## Troubleshooting

### Lambda Returns 500 with "Server configuration error"

**Cause**: Required environment variable is missing or invalid

**Solution**:
1. Check CloudWatch Logs for the specific error message
2. Verify all required variables are set in Lambda configuration
3. Verify variable values match expected format (URLs, User Pool ID, etc.)

### "Invalid URL format" Error

**Cause**: URL environment variable is malformed

**Solution**:
1. Ensure URLs include protocol (`https://`)
2. Remove trailing slashes from URLs
3. Verify URLs are accessible

### "Invalid COGNITO_USER_POOL_ID format" Error

**Cause**: User Pool ID doesn't match expected pattern

**Solution**:
1. Get User Pool ID from Cognito Console
2. Verify format is `region_id` (e.g., `us-east-1_ABC123`)
3. Don't confuse with User Pool ARN or Client ID

## Security Best Practices

1. **Never commit `.env` files**: The `.env` file is in `.gitignore`
2. **Use AWS Secrets Manager**: For production, consider storing sensitive values in Secrets Manager
3. **Rotate credentials**: Regularly rotate Cognito Client IDs and other credentials
4. **Limit access**: Use IAM policies to restrict who can view/modify Lambda environment variables
5. **Audit changes**: Enable CloudTrail to track configuration changes

## AWS Systems Manager Parameter Store Integration

For production deployments, you can use AWS Systems Manager Parameter Store to manage configuration:

1. **Store parameters**:
   ```bash
   aws ssm put-parameter \
     --name /mcp/cognito/user-pool-id \
     --value us-east-1_ABC123 \
     --type SecureString
   ```

2. **Update Lambda to read from Parameter Store**:
   ```typescript
   import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
   
   const ssm = new SSMClient({});
   const response = await ssm.send(
     new GetParameterCommand({
       Name: '/mcp/cognito/user-pool-id',
       WithDecryption: true,
     })
   );
   const userPoolId = response.Parameter?.Value;
   ```

3. **Grant Lambda permissions**:
   Add SSM permissions to Lambda execution role in CDK stack.

## References

- [AWS Lambda Environment Variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)
- [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [Amazon Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
