import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import { CreateSaleDto, CommonResponse, SaleUpdateDto } from '@nihal-ice-factory/shared-models';

export class SalesHelpService extends CommonAxiosService {
  private getURLwithMainEndPoint(childUrl: string): string {
    return `/sales/${childUrl}`;
  }

  async createSale(reqModel: CreateSaleDto, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('createSale'), reqModel, config);
  }

  async updateSale(id: number, updateSaleDto: SaleUpdateDto, config?: AxiosRequestConfig, ): Promise<CommonResponse> {
    return await this.axiosPutCall(this.getURLwithMainEndPoint(`updateSale/${id}`), updateSaleDto, config,);
  }

  async getAllSales(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosGetCall(this.getURLwithMainEndPoint('getAllSales'), config);
  }

  async getDashboardMetrics(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosGetCall(this.getURLwithMainEndPoint('getDashboardMetrics'), config);
  }

  getDashboardMetricsStreamUrl(token: string): string {
    const encodedToken = encodeURIComponent(token);
    return this.buildUrl(`${this.getURLwithMainEndPoint('dashboardMetrics/stream')}?token=${encodedToken}`);
  }

  async findSaleById(id: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('findSaleById'), { id }, config);
  }

  async getPrintData(id: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(
      this.getURLwithMainEndPoint('getPrintData'),
      { saleId: String(id) },
      config,
    );
  }

  async deleteSale(id: number,config?: AxiosRequestConfig,): Promise<CommonResponse> {
    return await this.axiosDeleteCall(this.getURLwithMainEndPoint(`deleteSale/${id}`), config,);
  }

  async deleteMultiple(ids: number[],config?: AxiosRequestConfig,): Promise<CommonResponse> {
    return await this.axiosDeleteCall(this.getURLwithMainEndPoint('deleteSales'),{...config,data: { ids },},);
  }
}
