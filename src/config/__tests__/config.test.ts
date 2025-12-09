import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAuthProxyConfig,
  getMcpServerConfig,
  getAwsConfig,
  validateConfiguration,
  ConfigurationError,
} from '../index';

describe('Configuration Management', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getAuthProxyConfig', () => {
    it('should return valid configuration when all required env vars are set', () => {
      process.env.SESSION_TABLE_NAME = 'test-sessions';
      process.env.COGNITO_DOMAIN = 'test-domain';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';
      process.env.COGNITO_REGION = 'us-east-1';
      process.env.API_ID = 'test-api-id';
      process.env.STAGE_NAME = 'prod';
      process.env.AWS_REGION_NAME = 'us-east-1';

      const config = getAuthProxyConfig();

      expect(config).toEqual({
        sessionTableName: 'test-sessions',
        cognitoDomain: 'test-domain',
        cognitoClientId: 'test-client-id',
        cognitoRegion: 'us-east-1',
        authProxyBaseUrl: 'https://test-api-id.execute-api.us-east-1.amazonaws.com/prod',
      });
    });

    it('should use AWS_REGION as fallback for COGNITO_REGION', () => {
      process.env.SESSION_TABLE_NAME = 'test-sessions';
      process.env.COGNITO_DOMAIN = 'test-domain';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';
      process.env.AWS_REGION = 'eu-west-1';
      process.env.API_ID = 'test-api-id';
      process.env.STAGE_NAME = 'prod';
      process.env.AWS_REGION_NAME = 'eu-west-1';

      const config = getAuthProxyConfig();

      expect(config.cognitoRegion).toBe('eu-west-1');
    });

    it('should throw ConfigurationError when SESSION_TABLE_NAME is missing', () => {
      process.env.COGNITO_DOMAIN = 'test-domain';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';

      expect(() => getAuthProxyConfig()).toThrow(ConfigurationError);
      expect(() => getAuthProxyConfig()).toThrow('SESSION_TABLE_NAME');
    });

    it('should throw ConfigurationError when COGNITO_DOMAIN is missing', () => {
      process.env.SESSION_TABLE_NAME = 'test-sessions';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';

      expect(() => getAuthProxyConfig()).toThrow(ConfigurationError);
      expect(() => getAuthProxyConfig()).toThrow('COGNITO_DOMAIN');
    });

    it('should throw ConfigurationError when COGNITO_CLIENT_ID is missing', () => {
      process.env.SESSION_TABLE_NAME = 'test-sessions';
      process.env.COGNITO_DOMAIN = 'test-domain';

      expect(() => getAuthProxyConfig()).toThrow(ConfigurationError);
      expect(() => getAuthProxyConfig()).toThrow('COGNITO_CLIENT_ID');
    });

    it('should trim whitespace from environment variables', () => {
      process.env.SESSION_TABLE_NAME = '  test-sessions  ';
      process.env.COGNITO_DOMAIN = '  test-domain  ';
      process.env.COGNITO_CLIENT_ID = '  test-client-id  ';
      process.env.COGNITO_REGION = '  us-east-1  ';
      process.env.API_ID = '  test-api-id  ';
      process.env.STAGE_NAME = '  prod  ';
      process.env.AWS_REGION_NAME = '  us-east-1  ';

      const config = getAuthProxyConfig();

      expect(config.sessionTableName).toBe('test-sessions');
      expect(config.cognitoDomain).toBe('test-domain');
      expect(config.cognitoClientId).toBe('test-client-id');
      expect(config.cognitoRegion).toBe('us-east-1');
    });
  });

  describe('getMcpServerConfig', () => {
    it('should return valid configuration when all required env vars are set', () => {
      process.env.MCP_API_ID = 'test-mcp-api';
      process.env.AUTH_API_ID = 'test-auth-api';
      process.env.STAGE_NAME = 'prod';
      process.env.AWS_REGION_NAME = 'us-east-1';
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';
      process.env.COGNITO_REGION = 'us-east-1';
      process.env.SUPPORTED_SCOPES = 'mcp:tools,mcp:resources';

      const config = getMcpServerConfig();

      expect(config).toEqual({
        mcpServerUri: 'https://test-mcp-api.execute-api.us-east-1.amazonaws.com/prod',
        authProxyUri: 'https://test-auth-api.execute-api.us-east-1.amazonaws.com/prod',
        cognitoUserPoolId: 'us-east-1_ABC123',
        cognitoClientId: 'test-client-id',
        cognitoRegion: 'us-east-1',
        supportedScopes: ['mcp:tools', 'mcp:resources'],
      });
    });

    it('should use default scope when SUPPORTED_SCOPES is not set', () => {
      process.env.MCP_API_ID = 'test-mcp-api';
      process.env.AUTH_API_ID = 'test-auth-api';
      process.env.STAGE_NAME = 'prod';
      process.env.AWS_REGION_NAME = 'us-east-1';
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';

      const config = getMcpServerConfig();

      expect(config.supportedScopes).toEqual(['openid', 'email', 'profile']);
    });

    it('should throw ConfigurationError when MCP_API_ID is missing', () => {
      process.env.AUTH_API_ID = 'test-auth-api';
      process.env.STAGE_NAME = 'prod';
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';

      expect(() => getMcpServerConfig()).toThrow(ConfigurationError);
      expect(() => getMcpServerConfig()).toThrow('MCP_API_ID');
    });

    it('should throw ConfigurationError when AUTH_API_ID is missing', () => {
      process.env.MCP_API_ID = 'test-mcp-api';
      process.env.STAGE_NAME = 'prod';
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';

      expect(() => getMcpServerConfig()).toThrow(ConfigurationError);
      expect(() => getMcpServerConfig()).toThrow('AUTH_API_ID');
    });

    it('should throw ConfigurationError when COGNITO_USER_POOL_ID has invalid format', () => {
      process.env.MCP_API_ID = 'test-mcp-api';
      process.env.AUTH_API_ID = 'test-auth-api';
      process.env.STAGE_NAME = 'prod';
      process.env.AWS_REGION_NAME = 'us-east-1';
      process.env.COGNITO_USER_POOL_ID = 'invalid-format';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';

      expect(() => getMcpServerConfig()).toThrow(ConfigurationError);
      expect(() => getMcpServerConfig()).toThrow('Invalid COGNITO_USER_POOL_ID format');
    });

    it('should parse comma-separated scopes correctly', () => {
      process.env.MCP_API_ID = 'test-mcp-api';
      process.env.AUTH_API_ID = 'test-auth-api';
      process.env.STAGE_NAME = 'prod';
      process.env.AWS_REGION_NAME = 'us-east-1';
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';
      process.env.SUPPORTED_SCOPES = 'scope1, scope2 , scope3';

      const config = getMcpServerConfig();

      expect(config.supportedScopes).toEqual(['scope1', 'scope2', 'scope3']);
    });

    it('should use default scope when SUPPORTED_SCOPES is whitespace only', () => {
      process.env.MCP_API_ID = 'test-mcp-api';
      process.env.AUTH_API_ID = 'test-auth-api';
      process.env.STAGE_NAME = 'prod';
      process.env.AWS_REGION_NAME = 'us-east-1';
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';
      process.env.SUPPORTED_SCOPES = '   ';

      const config = getMcpServerConfig();

      expect(config.supportedScopes).toEqual(['openid', 'email', 'profile']);
    });
  });

  describe('getAwsConfig', () => {
    it('should return AWS configuration', () => {
      process.env.AWS_REGION = 'eu-west-1';
      process.env.AWS_ACCOUNT_ID = '123456789012';

      const config = getAwsConfig();

      expect(config).toEqual({
        region: 'eu-west-1',
        accountId: '123456789012',
      });
    });

    it('should use default region when AWS_REGION is not set', () => {
      delete process.env.AWS_REGION;

      const config = getAwsConfig();

      expect(config.region).toBe('us-east-1');
    });

    it('should handle missing AWS_ACCOUNT_ID', () => {
      process.env.AWS_REGION = 'us-east-1';
      delete process.env.AWS_ACCOUNT_ID;

      const config = getAwsConfig();

      expect(config.accountId).toBeUndefined();
    });
  });

  describe('validateConfiguration', () => {
    it('should validate auth-proxy configuration successfully', () => {
      process.env.SESSION_TABLE_NAME = 'test-sessions';
      process.env.COGNITO_DOMAIN = 'test-domain';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';
      process.env.COGNITO_REGION = 'us-east-1';
      process.env.API_ID = 'test-api-id';
      process.env.STAGE_NAME = 'prod';

      expect(() => validateConfiguration('auth-proxy')).not.toThrow();
    });

    it('should validate mcp-server configuration successfully', () => {
      process.env.MCP_API_ID = 'test-mcp-api';
      process.env.AUTH_API_ID = 'test-auth-api';
      process.env.STAGE_NAME = 'prod';
      process.env.AWS_REGION_NAME = 'us-east-1';
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';

      expect(() => validateConfiguration('mcp-server')).not.toThrow();
    });

    it('should throw ConfigurationError for invalid auth-proxy config', () => {
      // Missing required variables
      expect(() => validateConfiguration('auth-proxy')).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid mcp-server config', () => {
      // Missing required variables
      expect(() => validateConfiguration('mcp-server')).toThrow(ConfigurationError);
    });
  });

  describe('ConfigurationError', () => {
    it('should create error with correct name and message', () => {
      const error = new ConfigurationError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Test error message');
    });
  });
});
