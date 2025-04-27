import { AxiosRequestConfig } from 'axios';
import { AxiosInstance } from './axios-instance';
import { configVariables } from './config';

export class CommonAxiosService {
  private readonly URL = configVariables.APP_INO_SERVICE_URL;

  async axiosPostCall(urlEndPoint: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    try {
      const response = await AxiosInstance.post(this.URL + urlEndPoint, data, config);
      if (response && response.status >= 200 && response.status < 300) {
        return response.data;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(error?.message || 'Unknown error occurred during POST call');
    }
  }

  async axiosGetCall(urlEndPoint: string, config?: AxiosRequestConfig): Promise<any> {
    try {
      const response = await AxiosInstance.get(this.URL + urlEndPoint, config);
      if (response && response.status >= 200 && response.status < 300) {
        return response.data;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(error?.message || 'Unknown error occurred during GET call');
    }
  }

  async axiosPutCall(urlEndPoint: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    try {
      const response = await AxiosInstance.put(this.URL + urlEndPoint, data, config);
      if (response && response.status >= 200 && response.status < 300) {
        return response.data;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(error?.message || 'Unknown error occurred during PUT call');
    }
  }
  
}
