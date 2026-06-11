import { configVariables } from '@nihal-ice-factory/shared-services';

/* ════════════════════════════════════════════════════════════════════
   Frontend logger
   - dev:  everything to the console, verbose
   - prod: warn/error to the console; errors are also shipped (batched)
           to the backend POST /client-logs so they show up in Render logs
   - keeps the last 200 entries in memory — dump them any time from the
     browser console with  window.__nifLogs()
   ════════════════════════════════════════════════════════════════════ */

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: Level;
  msg: string;
  ts: string;
  url: string;
  sessionId: string;
  stack?: string;
  extra?: unknown;
}

declare global {
  interface Window {
    __nifLogs?: () => LogEntry[];
  }
}

const IS_DEV = import.meta.env.DEV;
const API_BASE = configVariables.APP_INO_SERVICE_URL;

const SESSION_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

const BUFFER_MAX   = 200;
const FLUSH_MS     = 5000;
const DEDUPE_MS    = 30_000;

const buffer: LogEntry[] = [];
const shipQueue: LogEntry[] = [];
const lastShipped = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  flushTimer = null;
  if (shipQueue.length === 0 || !API_BASE) return;
  const logs = shipQueue.splice(0, 20);
  try {
    fetch(`${API_BASE}/client-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs }),
      keepalive: true,
    }).catch(() => { /* logging must never break the app */ });
  } catch { /* ignore */ }
}

function scheduleFlush(): void {
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
}

function ship(entry: LogEntry): void {
  // dedupe identical messages within a window (e.g. an error in a loop)
  const last = lastShipped.get(entry.msg);
  const now  = Date.now();
  if (last && now - last < DEDUPE_MS) return;
  lastShipped.set(entry.msg, now);

  shipQueue.push(entry);
  if (shipQueue.length >= 10) flush();
  else scheduleFlush();
}

function emit(level: Level, msg: string, extra?: unknown, stack?: string): void {
  const entry: LogEntry = {
    level,
    msg,
    ts: new Date().toISOString(),
    url: window.location.pathname,
    sessionId: SESSION_ID,
    ...(stack ? { stack } : {}),
    ...(extra !== undefined ? { extra } : {}),
  };

  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer.shift();

  const prefix = `[nif ${level}]`;
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    (console[level] ?? console.log)(prefix, msg, extra ?? '', stack ?? '');
  } else if (level === 'warn' || level === 'error') {
    // eslint-disable-next-line no-console
    (console[level])(prefix, msg, extra ?? '');
  }

  if (!IS_DEV && level === 'error') ship(entry);
}

export const logger = {
  debug: (msg: string, extra?: unknown) => emit('debug', msg, extra),
  info:  (msg: string, extra?: unknown) => emit('info', msg, extra),
  warn:  (msg: string, extra?: unknown) => emit('warn', msg, extra),
  error: (msg: string, extra?: unknown, stack?: string) => emit('error', msg, extra, stack),
};

/** Hook window-level failures + flush pending logs when the page closes. */
export function installGlobalErrorLogging(): void {
  window.__nifLogs = () => [...buffer];

  window.addEventListener('error', (event) => {
    logger.error(
      `Uncaught: ${event.message}`,
      { source: `${event.filename}:${event.lineno}:${event.colno}` },
      event.error instanceof Error ? event.error.stack : undefined,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logger.error(
      `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
      undefined,
      reason instanceof Error ? reason.stack : undefined,
    );
  });

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  logger.info(`session started (${SESSION_ID})`);
}
