import { HttpException } from '@nestjs/common';
import { CommonResponse } from './common-response';

export class ExceptionHandler {
  static handleError(error: any, message: string): CommonResponse {
    // If the error is an instance of HttpException, use its status and message
    if (error instanceof HttpException) {
      return new CommonResponse(
        false, 
        error.getStatus(), 
        error.message
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
