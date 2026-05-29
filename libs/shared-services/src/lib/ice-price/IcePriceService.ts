import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import {
  CommonResponse,
  CreateIceTypeDto,
  UpdateIceTypeDto,
} from '@nihal-ice-factory/shared-models';

export class IceTypeService extends CommonAxiosService {
  private getUrl(childUrl: string): string {
    return `/ice-type/${childUrl}`;
  }

  async createIceType(
    dto: CreateIceTypeDto,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosPostCall(this.getUrl('create'), dto, config);
  }

  async getAllIceTypes(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.getUrl('getAll'), config);
  }

  async getIceTypeById(
    id: number,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosGetCall(this.getUrl(`getById/${id}`), config);
  }

  async updateIceType(
    id: number,
    dto: UpdateIceTypeDto,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosPutCall(this.getUrl(`update/${id}`), dto, config);
  }

  async deleteIceType(
    id: number,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosDeleteCall(this.getUrl(`delete/${id}`), config);
  }
}

/** @deprecated Use IceTypeService */
export const IcePriceService = IceTypeService;
