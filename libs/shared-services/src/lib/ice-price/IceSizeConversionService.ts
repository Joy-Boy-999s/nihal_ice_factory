import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { ConversionInputDto } from '@nihal-ice-factory/shared-models';

export class IceSizeConversionService extends CommonAxiosService {
  private getUrl(path: string): string {
    return `/ice-conversion/${path}`;
  }

  async getAll(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.getUrl('all'), config);
  }

  async saveAll(
    conversions: ConversionInputDto[],
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosPostCall(this.getUrl('save-all'), { conversions }, config);
  }
}
