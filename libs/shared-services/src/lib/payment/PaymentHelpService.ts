import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import { CommonResponse } from '@nihal-ice-factory/shared-models';

export class PaymentHelpService extends CommonAxiosService {
  private ep(child: string): string {
    return `/payment/${child}`;
  }

  async createOrder(saleId: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosPostCall(this.ep('create-order'), { saleId }, config);
  }

  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosPostCall(
      this.ep('verify'),
      { razorpayOrderId, razorpayPaymentId, razorpaySignature },
      config,
    );
  }

  async getPaymentStatus(saleId: number, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.ep(`status/${saleId}`), config);
  }

  async reportPaymentFailed(
    razorpayOrderId: string,
    reason?: string,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosPostCall(this.ep('failed'), { razorpayOrderId, reason }, config);
  }
}
