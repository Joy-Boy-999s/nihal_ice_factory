import { AxiosRequestConfig } from 'axios';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { CommonAxiosService } from '../common-axios-service';

export type NotificationType = 'ORDER_PLACED' | 'ORDER_PAID' | 'ORDER_FULFILLED';

export interface AppNotification {
  id: number;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { saleId?: number; plantUnit?: string } | null;
  isRead: boolean;
  createdAt: string;
}

export class NotificationHelpService extends CommonAxiosService {
  private ep(path = ''): string {
    if (!path) return '/notifications';
    return path.startsWith('?') ? `/notifications${path}` : `/notifications/${path}`;
  }

  async list(limit = 50, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep(`?limit=${limit}`), config);
  }

  async unreadCount(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep('unread-count'), config);
  }

  async markRead(id: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPutCall(this.ep(`${id}/read`), {}, config);
  }

  async markAllRead(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPutCall(this.ep('read-all'), {}, config);
  }

  getStreamUrl(token: string): string {
    return this.buildUrl(this.ep(`stream?token=${encodeURIComponent(token)}`));
  }
}
