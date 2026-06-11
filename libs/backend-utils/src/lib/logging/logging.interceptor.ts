import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

const IS_PROD = process.env.NODE_ENV === 'production';
const SLOW_REQUEST_MS = 1500;

interface RequestWithContext extends Request {
  user?: { userId?: number; role?: string };
  requestId?: string;
}

/**
 * Logs one line per HTTP request: method, url, status, duration, user and a
 * correlation id. The id is taken from the incoming `x-request-id` header (or
 * generated), stored on the request for the exception filter, and echoed back
 * in the response so the frontend can surface it for support/debugging.
 *
 * Output is JSON in production (parseable in Render's log stream) and a
 * compact human-readable line in development.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req  = http.getRequest<RequestWithContext>();
    const res  = http.getResponse<Response>();

    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const started = Date.now();

    return next.handle().pipe(
      tap({
        next:  () => this.logRequest(req, res.statusCode, started),
        error: (err: unknown) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          this.logRequest(req, status, started);
        },
      }),
    );
  }

  private logRequest(req: RequestWithContext, status: number, started: number): void {
    const durationMs = Date.now() - started;
    const userId = req.user?.userId ?? null;
    const role   = req.user?.role ?? null;

    const line = IS_PROD
      ? JSON.stringify({
          method: req.method,
          url: req.originalUrl,
          status,
          durationMs,
          userId,
          role,
          requestId: req.requestId,
          ip: req.ip,
        })
      : `${req.method} ${req.originalUrl} → ${status} ${durationMs}ms` +
        (userId ? ` user=${userId}(${role})` : '') +
        ` req=${req.requestId}`;

    if (status >= 500)                                this.logger.error(line);
    else if (status >= 400)                           this.logger.warn(line);
    else if (durationMs > SLOW_REQUEST_MS)            this.logger.warn(`SLOW ${line}`);
    else                                              this.logger.log(line);
  }
}
