/**
 * Error handling utilities
 */

export class OAuth2Error extends Error {
  constructor(
    public error: string,
    public error_description?: string,
    public statusCode: number = 400
  ) {
    super(error_description || error);
    this.name = 'OAuth2Error';
  }
}

export class MCPError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}
