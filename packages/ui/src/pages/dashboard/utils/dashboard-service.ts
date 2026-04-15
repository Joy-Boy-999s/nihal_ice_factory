import { isAxiosError } from 'axios';
import type {
  CommonResponse,
  DashboardMetricsDto,
} from '@nihal-ice-factory/shared-models';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
import { buildAuthConfig } from '../../../lib/auth';

export interface NormalizedError {
  status?: number;
  message: string;
}

export const DASHBOARD_STREAM_EVENTS = {
  metrics: 'metrics',
  heartbeat: 'heartbeat',
} as const;

export const normalizeError = (err: unknown): NormalizedError => {
  if (isAxiosError(err)) {
    const data = err.response?.data as { internalMessage?: string } | undefined;
    return {
      status: err.response?.status,
      message: data?.internalMessage || err.message || 'Request failed',
    };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: 'Unexpected error' };
};

const isDashboardMetrics = (value: unknown): value is DashboardMetricsDto => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DashboardMetricsDto>;
  return Array.isArray(candidate.stats) && Array.isArray(candidate.charts);
};

const isCommonResponse = (value: unknown): value is CommonResponse => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CommonResponse>;
  return typeof candidate.status === 'boolean' && typeof candidate.errorCode === 'number';
};

export const fetchDashboardMetrics = async (
  service: SalesHelpService,
): Promise<DashboardMetricsDto> => {
  const res: CommonResponse = await service.getDashboardMetrics(buildAuthConfig());
  if (!res?.status || res.errorCode !== 200) {
    throw new Error(res?.internalMessage || 'Failed to load dashboard metrics');
  }
  if (!isDashboardMetrics(res.data)) {
    throw new Error('Dashboard metrics response was malformed');
  }
  return res.data;
};

export const createDashboardMetricsEventSource = (
  service: SalesHelpService,
  token: string,
): EventSource => {
  const streamUrl = service.getDashboardMetricsStreamUrl(token);
  return new EventSource(streamUrl);
};

export const parseDashboardMetricsEvent = (eventData: string): DashboardMetricsDto => {
  const parsed: unknown = JSON.parse(eventData);

  if (isDashboardMetrics(parsed)) {
    return parsed;
  }

  if (isCommonResponse(parsed)) {
    if (!parsed.status || parsed.errorCode !== 200) {
      throw new Error(parsed.internalMessage || 'Live dashboard stream returned an error');
    }
    if (!isDashboardMetrics(parsed.data)) {
      throw new Error('Dashboard stream payload was malformed');
    }
    return parsed.data;
  }

  throw new Error('Unknown dashboard stream payload');
};
