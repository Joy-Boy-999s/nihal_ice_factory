import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import { CommonResponse } from '@nihal-ice-factory/shared-models';

export interface AuditEntry {
  id: number;
  userId: string;
  username: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
}

export class AuditHelpService extends CommonAxiosService {
  async list(limit = 200, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(`/audit?limit=${limit}`, config);
  }
}
