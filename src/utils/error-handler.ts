/**
 * Centralized error handling for Lambda functions
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { OAuth2Error, MCPError } from './errors';

/**
 * Handle Lambda errors and return appropriate API Gateway response
 */
export function handleLambdaError(error: unknown): APIGatewayProxyResult {
  console.error('Lambda error:', error);

  // OAuth2 errors
  if (error instanceof OAuth2Error) {
    return {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        error: error.error,
        error_description: error.error_description,
      }),
    };
  }

  // MCP errors
  if (error instanceof MCPError) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: error.code,
          message: error.message,
          data: error.data,
        },
        id: null,
      }),
    };
  }

  // Generic errors
  if (error instanceof Error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: error.message,
      }),
    };
  }

  // Unknown errors
  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      error: 'server_error',
      error_description: 'An unexpected error occurred',
    }),
  };
}

/**
 * Wrap Lambda handler with error handling
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<APIGatewayProxyResult>
): (...args: T) => Promise<APIGatewayProxyResult> {
  return async (...args: T): Promise<APIGatewayProxyResult> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleLambdaError(error);
    }
  };
}
