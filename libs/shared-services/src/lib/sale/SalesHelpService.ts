import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import { CreateSaleDto, UpdateSaleDto, CommonResponse } from '@nihal-ice-factory/shared-models';

export class SalesHelpService extends CommonAxiosService {
  private getURLwithMainEndPoint(childUrl: string): string {
    return `/sales/${childUrl}`;
  }

  async createSale(reqModel: CreateSaleDto, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('createSale'), reqModel, config);
  }

  async findAllSales(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('findAllSales'), {}, config);
  }

  async findSaleById(id: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('findSaleById'), { id }, config);
  }

  async updateSale(id: number, reqModel: UpdateSaleDto, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('updateSale'), { id, ...reqModel }, config);
  }

  async deleteSale(id: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('deleteSale'), { id }, config);
  }

  async getPrintData(id: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('getPrintData'), { id }, config);
  }
}
