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
const RATE_LIMIT_PER_MINUTE = 60;

const trunc = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' ? v.slice(0, max) : undefined;

/** Cap arbitrary `extra` payloads so one client can't flood the log stream. */
const truncExtra = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  try {
    return JSON.stringify(v).slice(0, 2000);
  } catch {
    return '[unserializable]';
  }
};

@Controller()
export class AppController {
  private readonly clientLogger = new Logger('ClientLog');

  /** Naive in-memory per-IP rate limiting for the public log-ingest endpoint. */
  private readonly logRate = new Map<string, { count: number; windowStart: number }>();

  constructor(private readonly appService: AppService) {}

  private allowClientLogs(ip: string, entries: number): boolean {
    const now = Date.now();
    const bucket = this.logRate.get(ip);
    if (!bucket || now - bucket.windowStart > 60_000) {
      // Also keep the map itself bounded
      if (this.logRate.size > 5000) this.logRate.clear();
      this.logRate.set(ip, { count: entries, windowStart: now });
      return true;
    }
    bucket.count += entries;
    return bucket.count <= RATE_LIMIT_PER_MINUTE;
  }

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
    if (entries.length === 0) return;
    if (!this.allowClientLogs(req.ip ?? 'unknown', entries.length)) return;

    const ua = trunc(req.headers['user-agent'], 200);

    for (const e of entries) {
      const line = JSON.stringify({
        msg:       trunc(e.msg, 1000) ?? '(no message)',
        ts:        trunc(e.ts, 40),
        sessionId: trunc(e.sessionId, 40),
        url:       trunc(e.url, 300),
        stack:     trunc(e.stack, 4000),
        extra:     truncExtra(e.extra),
        ua,
        ip: req.ip,
      });
      if (e.level === 'warn') this.clientLogger.warn(line);
      else this.clientLogger.error(line);
    }
  }
}
