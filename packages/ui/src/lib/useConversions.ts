import { useEffect, useState } from 'react';
import type { IceSizeConversionDto } from '@nihal-ice-factory/shared-models';
import { IceSizeConversionService } from '@nihal-ice-factory/shared-services';
import { buildAuthConfig } from './auth';

const svc = new IceSizeConversionService();

export function useConversions(): IceSizeConversionDto[] {
  const [convs, setConvs] = useState<IceSizeConversionDto[]>([]);

  useEffect(() => {
    svc.getAll(buildAuthConfig()).then(res => {
      const envelope = res?.data as { data?: unknown } | null;
      const raw      = envelope?.data ?? res?.data;
      const list     = Array.isArray(raw) ? (raw as IceSizeConversionDto[]) : [];
      setConvs(list);
    }).catch(() => {}); // eslint-disable-line @typescript-eslint/no-empty-function
  }, []);

  return convs;
}
