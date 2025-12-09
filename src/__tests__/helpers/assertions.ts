/**
 * Common test assertion helpers
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { expect } from 'vitest';

/**
 * Assert OAuth2 error response
 */
export function assertOAuth2Error(
  response: APIGatewayProxyResult,
  expectedError: string,
  expectedStatusCode: number = 400
): void {
  expect(response.statusCode).toBe(expectedStatusCode);
  expect(response.headers?.['Content-Type']).toBe('application/json');
  
  const body = JSON.parse(response.body);
  expect(body.error).toBe(expectedError);
  expect(body.error_description).toBeDefined();
}

/**
 * Assert successful OAuth2 response
 */
export function assertOAuth2Success(
  response: APIGatewayProxyResult,
  expectedStatusCode: number = 200
): any {
  expect(response.statusCode).toBe(expectedStatusCode);
  expect(response.headers?.['Content-Type']).toBe('application/json');
  
  const body = JSON.parse(response.body);
  expect(body.error).toBeUndefined();
  
  return body;
}

/**
 * Assert redirect response
 */
export function assertRedirect(
  response: APIGatewayProxyResult,
  expectedLocation?: string
): void {
  expect(response.statusCode).toBe(302);
  expect(response.headers?.Location).toBeDefined();
  
  if (expectedLocation) {
    expect(response.headers?.Location).toContain(expectedLocation);
  }
}

/**
 * Assert MCP error response
 */
export function assertMcpError(
  response: APIGatewayProxyResult,
  expectedCode: number
): void {
  expect(response.statusCode).toBe(400);
  expect(response.headers?.['Content-Type']).toBe('application/json');
  
  const body = JSON.parse(response.body);
  expect(body.jsonrpc).toBe('2.0');
  expect(body.error).toBeDefined();
  expect(body.error.code).toBe(expectedCode);
}

/**
 * Assert MCP success response
 */
export function assertMcpSuccess(
  response: APIGatewayProxyResult
): any {
  expect(response.statusCode).toBe(200);
  expect(response.headers?.['Content-Type']).toBe('application/json');
  
  const body = JSON.parse(response.body);
  expect(body.jsonrpc).toBe('2.0');
  expect(body.error).toBeUndefined();
  expect(body.result).toBeDefined();
  
  return body.result;
}

/**
 * Assert HTML response
 */
export function assertHtmlResponse(
  response: APIGatewayProxyResult,
  expectedStatusCode: number = 200
): string {
  expect(response.statusCode).toBe(expectedStatusCode);
  expect(response.headers?.['Content-Type']).toBe('text/html');
  expect(response.body).toBeDefined();
  
  return response.body;
}

/**
 * Assert response contains security headers
 */
export function assertSecurityHeaders(
  response: APIGatewayProxyResult
): void {
  expect(response.headers?.['Cache-Control']).toBeDefined();
  expect(response.headers?.['X-Content-Type-Options']).toBe('nosniff');
}

/**
 * Assert JWT token format
 */
export function assertJwtFormat(token: string): void {
  const parts = token.split('.');
  expect(parts).toHaveLength(3);
  
  // Verify each part is base64url encoded
  parts.forEach(part => {
    expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
  });
}

/**
 * Assert URL has query parameter
 */
export function assertUrlHasParam(
  url: string,
  paramName: string,
  expectedValue?: string
): void {
  const urlObj = new URL(url);
  const paramValue = urlObj.searchParams.get(paramName);
  
  expect(paramValue).not.toBeNull();
  
  if (expectedValue !== undefined) {
    expect(paramValue).toBe(expectedValue);
  }
}
