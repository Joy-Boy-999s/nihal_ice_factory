import { CommonResponse } from './common-response';

/** Minimal shape of any error object that {@link ExceptionHandler.handleError} knows how to inspect. */
export interface HandleableError {
  /** NestJS HTTP exceptions expose this. */
  getStatus?: () => number;
  /** Axios / plain-object errors carry a numeric status. */
  status?: number;
  message?: string;
}

export class ExceptionHandler {
  static handleError(error: HandleableError, message: string): CommonResponse {
    // NestJS-like errors (HttpException, ForbiddenException, …)
    if (typeof error.getStatus === 'function') {
      return new CommonResponse(false, error.getStatus(), error.message ?? message);
    }
    // Axios-like errors or plain objects with a numeric status
    if (typeof error.status === 'number') {
      return new CommonResponse(false, error.status, error.message ?? message);
    }
    // Fallback — treat as 500
    return new CommonResponse(false, 500, message);
  }
}
