import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import { CommonResponse } from '@nihal-ice-factory/shared-models';

export interface PlaceOrderPayload {
  unit: string;
  name: string;
  mobile: string;
  address: string;
  items: { iceTypeId: number; quantity: number }[];
}

export class CustomerHelpService extends CommonAxiosService {
  private ep(child: string): string {
    return `/customer/${child}`;
  }

  async getShopData(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep('shop'), config);
  }

  async placeOrder(payload: PlaceOrderPayload, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPostCall(this.ep('order'), payload, config);
  }

  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosPostCall(
      this.ep('verify-payment'),
      { razorpayOrderId, razorpayPaymentId, razorpaySignature },
      config,
    );
  }

  async getMyOrders(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep('my-orders'), config);
  }
}
