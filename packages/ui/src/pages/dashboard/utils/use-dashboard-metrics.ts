import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DashboardMetricsDto } from '@nihal-ice-factory/shared-models';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
import { logout, useAuth } from '../../../lib/auth';
import {
  DASHBOARD_STREAM_EVENTS,
  createDashboardMetricsEventSource,
  fetchDashboardMetrics,
  normalizeError,
  parseDashboardMetricsEvent,
} from './dashboard-service';

const REFRESH_INTERVAL_MS = 30_000;
const SSE_BASE_RECONNECT_MS = 1000;
const SSE_MAX_RECONNECT_MS = 30000;

export interface DashboardMetricsState {
  metrics: DashboardMetricsDto | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  lastUpdated: string;
  refresh: () => void;
}

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export const useDashboardMetrics = (): DashboardMetricsState => {
  const navigate = useNavigate();
  const service = useMemo(() => new SalesHelpService(), []);
  const { role, token } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [metrics, setMetrics] = useState<DashboardMetricsDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const load = useCallback(
    async (silent: boolean) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await fetchDashboardMetrics(service);
        setMetrics(data);
        setLastUpdated(formatTime(data.generatedAt));
        setError('');
      } catch (err) {
        const info = normalizeError(err);
        if (info.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setError(info.message);
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [service, navigate],
  );

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      setRefreshing(false);
      setMetrics(null);
      setError('Dashboard is available for admin users only.');
      return;
    }

    load(false);

    if (token) {
      let disposed = false;
      let source: EventSource | null = null;
      let reconnectTimer: number | null = null;
      let reconnectAttempts = 0;

      const clearReconnectTimer = (): void => {
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      const handleMetricsEvent = (event: MessageEvent<string>): void => {
        try {
          const data = parseDashboardMetricsEvent(event.data);
          setMetrics(data);
          setLastUpdated(formatTime(data.generatedAt));
          setError('');
        } catch (parseError) {
          const parsed = normalizeError(parseError);
          setError(parsed.message);
        }
      };

      const connect = (): void => {
        if (disposed) return;

        try {
          const next = createDashboardMetricsEventSource(service, token);
          source = next;

          next.addEventListener(
            DASHBOARD_STREAM_EVENTS.metrics,
            handleMetricsEvent as EventListener,
          );
          next.onmessage = handleMetricsEvent;
          next.addEventListener(DASHBOARD_STREAM_EVENTS.heartbeat, () => {
            // Keepalive signal; metrics events carry actual dashboard payload.
          });

          next.onopen = () => {
            reconnectAttempts = 0;
            setError('');
          };

          next.onerror = () => {
            if (disposed) return;

            next.close();
            clearReconnectTimer();

            reconnectAttempts += 1;
            const exponentialDelay = Math.min(
              SSE_BASE_RECONNECT_MS * 2 ** (reconnectAttempts - 1),
              SSE_MAX_RECONNECT_MS,
            );
            const jitter = Math.floor(Math.random() * 400);
            const reconnectIn = exponentialDelay + jitter;
            setError(
              `Live stream disconnected. Reconnecting in ${Math.ceil(reconnectIn / 1000)}s...`,
            );

            reconnectTimer = window.setTimeout(connect, reconnectIn);
          };
        } catch (err) {
          const parsed = normalizeError(err);
          setError(parsed.message);
        }
      };

      connect();

      const onVisibility = (): void => {
        if (document.visibilityState === 'visible') load(true);
      };
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        disposed = true;
        clearReconnectTimer();
        source?.close();
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }

    const interval = window.setInterval(() => load(true), REFRESH_INTERVAL_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') load(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load, isAdmin, token, service]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { metrics, loading, refreshing, error, lastUpdated, refresh };
};
