import { CommonResponse } from './common-response';

export class ExceptionHandler {
  static handleError(error: any, message: string): CommonResponse {
    // Support NestJS-like errors without importing backend-only packages in UI bundles.
    if (error && typeof error.getStatus === 'function') {
      return new CommonResponse(
        false, 
        error.getStatus(), 
        error.message ?? message
      );
    }
    if (error && typeof error.status === 'number') {
      return new CommonResponse(
        false,
        error.status,
        error.message ?? message
      );
    }
    // For other errors, return a 500 Internal Server Error response
    return new CommonResponse(
      false, 
      500, 
      message
    );
  }
}
