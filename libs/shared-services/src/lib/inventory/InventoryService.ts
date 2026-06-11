import { AxiosRequestConfig } from 'axios';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { CommonAxiosService } from '../common-axios-service';
import { configVariables } from '../config';

export interface CreateBatchPayload {
  plantUnit: string;
  iceTypeId: number;
  batchLabel: string;
  rows: number;
  cols: number;
  productionStartedAt?: string;
  readyAt?: string;
  shelfLifeHours?: number;
  notes?: string;
}

export interface SellSlotsPayload {
  slotIds: number[];
  customerName: string;
  customerMobile: string;
  shopName?: string;
  discount?: number;
  soldBy: string;
  date?: string;
  time?: string;
}

export interface ReserveSlotsPayload {
  slotIds: number[];
  reservedFor: string;
  expiresInMinutes?: number;
}

export interface ReleaseSlotsPayload {
  slotIds: number[];
}

export interface MarkDamagedPayload {
  slotIds: number[];
  damageNote?: string;
}

export interface MarkBatchReadyPayload {
  readyAt?: string;
  shelfLifeHours?: number;
}

export interface SetNextBatchPayload {
  estimatedNextBatchAt: string;
  notes?: string;
}

export class InventoryService extends CommonAxiosService {
  private ep(path: string) { return `/inventory/${path}`; }

  async createBatch(payload: CreateBatchPayload, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPostCall(this.ep('batches/create'), payload, config);
  }

  async listBatches(plantUnit?: string, config?: AxiosRequestConfig): Promise<CommonResponse> {
    const url = plantUnit ? this.ep(`batches/list?plantUnit=${encodeURIComponent(plantUnit)}`) : this.ep('batches/list');
    return this.axiosGetCall(url, config);
  }

  async getBatchGrid(batchId: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep(`batches/${batchId}/grid`), config);
  }

  async markBatchReady(batchId: number, payload: MarkBatchReadyPayload, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPutCall(this.ep(`batches/${batchId}/markReady`), payload, config);
  }

  async setNextBatch(batchId: number, payload: SetNextBatchPayload, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPutCall(this.ep(`batches/${batchId}/setNextBatch`), payload, config);
  }

  async sellSlots(payload: SellSlotsPayload, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPostCall(this.ep('slots/sell'), payload, config);
  }

  async reserveSlots(payload: ReserveSlotsPayload, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPostCall(this.ep('slots/reserve'), payload, config);
  }

  async releaseSlots(payload: ReleaseSlotsPayload, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPostCall(this.ep('slots/release'), payload, config);
  }

  async markDamaged(payload: MarkDamagedPayload, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPostCall(this.ep('slots/markDamaged'), payload, config);
  }

  async getAvailability(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep('availability'), config);
  }

  /** Stock per ice type for a plant — used by Add Sale to show availability / out-of-stock. */
  async getPlantAvailability(plantUnit: string, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep(`plant-availability?plantUnit=${encodeURIComponent(plantUnit)}`), config);
  }

  async getExpiringSoon(hours = 4, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep(`expiring?hours=${hours}`), config);
  }

  /** Fulfill a customer order: selected slots are sold against the order (strict match). */
  async fulfillOrder(payload: { saleId: number; slotIds: number[] }, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPostCall(this.ep('slots/fulfill'), payload, config);
  }

  getStreamUrl(token: string): string {
    return this.buildUrl(this.ep(`stream?token=${encodeURIComponent(token)}`));
  }
}
