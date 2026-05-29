import { isAxiosError, AxiosError } from 'axios';
import type {
  CommonResponse,
  DashboardMetricsDto,
  ResponsePayloadRecord,
} from '@nihal-ice-factory/shared-models';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
import { buildAuthConfig } from '../../../lib/auth';

export interface NormalizedError {
  status?: number;
  message: string;
}

export const DASHBOARD_STREAM_EVENTS = {
  metrics:   'metrics',
  heartbeat: 'heartbeat',
} as const;

export const normalizeError = (err: AxiosError | Error): NormalizedError => {
  if (isAxiosError(err)) {
    const data = err.response?.data as { internalMessage?: string } | undefined;
    return {
      status:  err.response?.status,
      message: data?.internalMessage || err.message || 'Request failed',
    };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: 'Unexpected error' };
};

const isDashboardMetrics = (value: object | null): value is DashboardMetricsDto => {
  if (!value) return false;
  const candidate = value as Partial<DashboardMetricsDto>;
  return Array.isArray(candidate.stats) && Array.isArray(candidate.charts);
};

const isCommonResponse = (value: object | null): value is CommonResponse => {
  if (!value) return false;
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
  const payload = res.data as ResponsePayloadRecord | null;
  const metrics = (payload?.['data'] ?? payload) as object | null;
  if (!isDashboardMetrics(metrics)) {
    throw new Error('Dashboard metrics response was malformed');
  }
  return metrics;
};

export const createDashboardMetricsEventSource = (
  service: SalesHelpService,
  token: string,
): EventSource => {
  const streamUrl = service.getDashboardMetricsStreamUrl(token);
  return new EventSource(streamUrl);
};

export const parseDashboardMetricsEvent = (eventData: string): DashboardMetricsDto => {
  // JSON.parse returns `any`; immediately cast to the expected union.
  const parsed = JSON.parse(eventData) as DashboardMetricsDto | CommonResponse | null;

  if (parsed && typeof parsed === 'object') {
    if (isDashboardMetrics(parsed as object)) {
      return parsed as DashboardMetricsDto;
    }

    if (isCommonResponse(parsed as object)) {
      const cr = parsed as CommonResponse;
      if (!cr.status || cr.errorCode !== 200) {
        throw new Error(cr.internalMessage || 'Live dashboard stream returned an error');
      }
      const payload  = cr.data as ResponsePayloadRecord | null;
      const metrics  = (payload?.['data'] ?? payload) as object | null;
      if (!isDashboardMetrics(metrics)) {
        throw new Error('Dashboard stream payload was malformed');
      }
      return metrics;
    }
  }

  throw new Error('Unknown dashboard stream payload');
};
