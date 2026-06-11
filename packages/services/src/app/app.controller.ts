import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AppService } from './app.service';

interface ClientLogEntry {
  level?: string;
  msg?: string;
  ts?: string;
  sessionId?: string;
  url?: string;
  stack?: string;
  extra?: unknown;
}

const MAX_ENTRIES_PER_BATCH = 20;

const trunc = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' ? v.slice(0, max) : undefined;

@Controller()
export class AppController {
  private readonly clientLogger = new Logger('ClientLog');

  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  /**
   * Ingests error logs shipped from the frontend so production browser
   * errors are visible in the backend (Render) log stream.
   * Public on purpose — client errors can happen before login.
   */
  @Post('client-logs')
  @HttpCode(HttpStatus.NO_CONTENT)
  ingestClientLogs(@Body() body: { logs?: ClientLogEntry[] }, @Req() req: Request): void {
    const entries = Array.isArray(body?.logs) ? body.logs.slice(0, MAX_ENTRIES_PER_BATCH) : [];
    const ua = trunc(req.headers['user-agent'], 200);

    for (const e of entries) {
      const line = JSON.stringify({
        msg:       trunc(e.msg, 1000) ?? '(no message)',
        ts:        trunc(e.ts, 40),
        sessionId: trunc(e.sessionId, 40),
        url:       trunc(e.url, 300),
        stack:     trunc(e.stack, 4000),
        extra:     e.extra,
        ua,
        ip: req.ip,
      });
      if (e.level === 'warn') this.clientLogger.warn(line);
      else this.clientLogger.error(line);
    }
  }
}
