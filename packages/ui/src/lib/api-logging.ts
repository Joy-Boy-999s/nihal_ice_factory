import { AxiosInstance } from '@nihal-ice-factory/shared-services';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logger } from './logger';

/* ════════════════════════════════════════════════════════════════════
   API logging — registers interceptors on the shared axios instance.
   - tags every request with an X-Request-Id (the backend echoes it back
     and logs it, so one id correlates browser ↔ server logs)
   - logs timing for every call in dev, slow calls (>3s) everywhere
   - logs failures with status, duration and the server's message
   ════════════════════════════════════════════════════════════════════ */

const SLOW_MS = 3000;

interface TimedConfig extends InternalAxiosRequestConfig {
  metadata?: { start: number; requestId: string };
}

const newRequestId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const describe = (config?: TimedConfig): string =>
  `${(config?.method ?? 'get').toUpperCase()} ${config?.url ?? '?'}`;

export function installApiLogging(): void {
  AxiosInstance.interceptors.request.use((config: TimedConfig) => {
    const requestId = newRequestId();
    config.headers.set('X-Request-Id', requestId);
    config.metadata = { start: performance.now(), requestId };
    return config;
  });

  AxiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      const config = response.config as TimedConfig;
      const ms = Math.round(performance.now() - (config.metadata?.start ?? performance.now()));

      if (ms > SLOW_MS) {
        logger.warn(`Slow API: ${describe(config)} took ${ms}ms`, {
          requestId: config.metadata?.requestId,
          status: response.status,
        });
      } else {
        logger.debug(`API ${describe(config)} → ${response.status} ${ms}ms`);
      }
      return response;
    },
    (error: AxiosError<{ internalMessage?: string; statusInfo?: string }>) => {
      const config = error.config as TimedConfig | undefined;
      const ms = config?.metadata
        ? Math.round(performance.now() - config.metadata.start)
        : undefined;
      const status = error.response?.status;

      const detail = {
        status: status ?? error.code ?? 'NETWORK',
        durationMs: ms,
        requestId: config?.metadata?.requestId,
        serverMessage:
          error.response?.data?.internalMessage ?? error.response?.data?.statusInfo,
      };

      // 401s are routine session expiry — keep them out of the error stream
      if (status === 401) {
        logger.warn(`API ${describe(config)} → 401 (session expired)`, detail);
      } else {
        logger.error(`API failed: ${describe(config)}`, detail);
      }
      return Promise.reject(error);
    },
  );
}
