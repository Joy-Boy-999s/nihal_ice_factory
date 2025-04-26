import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
  } from '@nestjs/common';
  import { Response, Request } from 'express';
  
  interface ExceptionResponse {
    message?: string | string[];
    error?: string;
    statusCode?: number;
    [key: string]: any;
  }
  
  @Catch(HttpException)
  export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);
  
    catch(exception: HttpException, host: ArgumentsHost): void {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
  
      const { body } = request;
  
      const loggingObject = {
        requestData: body,
        responseData: {},
      };
  
      let statusCode: number | null = null;
      let errorType = 'Unknown';
      let statusInfo: string = '';
      let internalMessage: string = '';
  
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as ExceptionResponse;
  
      // Set internal message and fallback if not present
      internalMessage = exceptionResponse?.error || exception.message || 'Unknown error';
  
      if (status >= 400 && status < 500) {
        statusCode = status;
  
        switch (status) {
          case HttpStatus.BAD_REQUEST:
            errorType = 'Client Side Errors';
            if (Array.isArray(exceptionResponse.message)) {
              statusInfo = exceptionResponse.message[0];
            } else {
              statusInfo = 'Server cannot or will not process the request due to client error (Request Payload)';
            }
            break;
  
          case HttpStatus.UNAUTHORIZED:
            errorType = 'Unauthorized';
            statusInfo = 'Lack of valid authentication credentials';
            break;
  
          case HttpStatus.FORBIDDEN:
            errorType = 'Forbidden';
            statusInfo = 'You are forbidden to perform this action';
            break;
  
          case HttpStatus.NOT_FOUND:
            errorType = 'Not Found';
            statusInfo = 'Server cannot find the requested resource';
            break;
  
          case HttpStatus.NOT_ACCEPTABLE:
            errorType = 'Not Acceptable';
            statusInfo = 'Response headers not matching with request headers';
            break;
  
          case HttpStatus.EXPECTATION_FAILED:
            errorType = 'Expectation Failed';
            statusInfo = 'Request header could not be fulfilled';
            break;
  
          case HttpStatus.TOO_MANY_REQUESTS:
            errorType = 'Too Many Requests';
            statusInfo = 'Too many requests in a limited time';
            break;
  
          default:
            errorType = 'Client Side Errors';
            statusInfo = internalMessage;
        }
      } else {
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        errorType = 'Internal Server Error';
        statusInfo = 'An unexpected error occurred on the server';
      }
  
      const responseObject = {
        status: false,
        statusCode: statusCode,
        errorType: errorType,
        internalMessage: internalMessage,
        statusInfo: statusInfo,
      };
  
      loggingObject.responseData = responseObject;
      this.logger.error(loggingObject);
  
      response.status(statusCode).json(responseObject);
    }
  
    getChildMessage = (messages: any): string => {
      if (messages.children) {
        if (messages.children.length === 0) {
          return Object.values(messages.constraints)[0] as string;
        } else {
          return this.getChildMessage(messages.children[0]);
        }
      }
      return 'Validation error';
    };
  }
  