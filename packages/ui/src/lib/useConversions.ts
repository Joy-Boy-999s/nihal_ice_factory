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
// here i make a screen for inventory of ice dsign backend and entities and structure for maintaining the ice in the inventory here the ice will be like in a movie booking app seats with rows and cols and seats like this should show live availbalility of ice in each plant according to user plant access its should able to add ice but when removeing it should be should add sale pop modal and that particalu ice should be shold and unable to seel agin util the ice is ready agin and keep time to ready for nxt batch of to ready and think of additinal best features which we use in daily life for the ice factory and implent those alos
