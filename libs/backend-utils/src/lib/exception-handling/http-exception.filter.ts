import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { redactUrl } from '../logging/logging.interceptor';

/** Shape of the response body that NestJS HTTP exceptions expose. */
interface ExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

/**
 * A node in the class-validator validation-error tree.
 * Used by {@link HttpExceptionFilter.getChildMessage} to drill into nested
 * constraint violations.
 */
interface ValidationMessage {
  children?: ValidationMessage[];
  constraints?: Record<string, string>;
}

interface RequestWithContext extends Request {
  user?: { userId?: number; role?: string };
  requestId?: string;
}

const IS_PROD = process.env.NODE_ENV === 'production';

/** Body keys whose values must never reach the logs. */
const REDACTED_KEYS = /password|secret|token|otp|authorization/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACTED_KEYS.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<RequestWithContext>();

    let statusCode: number;
    let errorType = 'Unknown';
    let statusInfo      = '';
    let internalMessage = '';

    if (exception instanceof HttpException) {
      const status            = exception.getStatus();
      const exceptionResponse = exception.getResponse() as ExceptionResponse;

      internalMessage = exceptionResponse?.error || exception.message || 'Unknown error';

      if (status >= 400 && status < 500) {
        statusCode = status;

        switch (status) {
          case HttpStatus.BAD_REQUEST:
            errorType = 'Client Side Errors';
            if (Array.isArray(exceptionResponse.message)) {
              statusInfo = exceptionResponse.message[0];
            } else {
              statusInfo =
                'Server cannot or will not process the request due to client error (Request Payload)';
            }
            break;

          case HttpStatus.UNAUTHORIZED:
            errorType  = 'Unauthorized';
            statusInfo = 'Lack of valid authentication credentials';
            break;

          case HttpStatus.FORBIDDEN:
            errorType  = 'Forbidden';
            statusInfo = 'You are forbidden to perform this action';
            break;

          case HttpStatus.NOT_FOUND:
            errorType  = 'Not Found';
            statusInfo = 'Server cannot find the requested resource';
            break;

          case HttpStatus.NOT_ACCEPTABLE:
            errorType  = 'Not Acceptable';
            statusInfo = 'Response headers not matching with request headers';
            break;

          case HttpStatus.EXPECTATION_FAILED:
            errorType  = 'Expectation Failed';
            statusInfo = 'Request header could not be fulfilled';
            break;

          case HttpStatus.TOO_MANY_REQUESTS:
            errorType  = 'Too Many Requests';
            statusInfo = 'Too many requests in a limited time';
            break;

          default:
            errorType  = 'Client Side Errors';
            statusInfo = internalMessage;
        }
      } else {
        statusCode  = HttpStatus.INTERNAL_SERVER_ERROR;
        errorType   = 'Internal Server Error';
        statusInfo  = 'An unexpected error occurred on the server';
      }
    } else {
      // Non-HTTP exception (TypeError, DB driver error, etc.)
      statusCode      = HttpStatus.INTERNAL_SERVER_ERROR;
      errorType       = 'Internal Server Error';
      statusInfo      = 'An unexpected error occurred on the server';
      internalMessage = exception instanceof Error ? exception.message : 'Unknown error';
    }

    const responseObject = {
      status:          false,
      statusCode:      statusCode,
      errorType:       errorType,
      internalMessage: internalMessage,
      statusInfo:      statusInfo,
      requestId:       request.requestId,
    };

    const logContext = {
      requestId:   request.requestId,
      method:      request.method,
      url:         redactUrl(request.originalUrl),
      statusCode,
      errorType,
      internalMessage,
      userId:      request.user?.userId ?? null,
      role:        request.user?.role ?? null,
      requestBody: redact(request.body),
    };

    const line = IS_PROD ? JSON.stringify(logContext) : logContext;

    if (statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(line);
      this.logger.error(stack);
    } else {
      this.logger.warn(line);
    }

    response.status(statusCode).json(responseObject);
  }

  getChildMessage = (messages: ValidationMessage): string => {
    if (messages.children) {
      if (messages.children.length === 0) {
        return Object.values(messages.constraints ?? {})[0] ?? 'Validation error';
      }
      return this.getChildMessage(messages.children[0]);
    }
    return 'Validation error';
  };
}
