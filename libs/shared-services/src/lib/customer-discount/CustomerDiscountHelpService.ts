import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import type { CreateDiscountTierDto, UpdateDiscountTierDto } from '@nihal-ice-factory/shared-models';

export class CustomerDiscountHelpService extends CommonAxiosService {
  private ep(child: string): string {
    return `/customer-discount/${child}`;
  }

  getTiers(customerId: string, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep(customerId), config);
  }

  createTier(dto: CreateDiscountTierDto, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPostCall('/customer-discount', dto, config);
  }

  updateTier(id: number, dto: UpdateDiscountTierDto, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPutCall(this.ep(String(id)), dto, config);
  }

  deleteTier(id: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosDeleteCall(this.ep(String(id)), config);
  }
}
