import { AxiosRequestConfig } from 'axios';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { AxiosInstance } from './axios-instance';
import { configVariables } from './config';

/** Minimal shape of an Axios / network error. */
interface NetworkError {
  message?: string;
}

export class CommonAxiosService {
  private readonly URL = configVariables.APP_INO_SERVICE_URL;

  protected buildUrl(urlEndPoint: string): string {
    return this.URL + urlEndPoint;
  }

  async axiosPostCall(
    urlEndPoint: string,
    data?: object,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    try {
      const response = await AxiosInstance.post(this.buildUrl(urlEndPoint), data, config);
      if (response && response.status >= 200 && response.status < 300) {
        return response.data as CommonResponse;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      const err = error as NetworkError;
      throw new Error(err.message || 'Unknown error occurred during POST call');
    }
  }

  async axiosGetCall(
    urlEndPoint: string,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    try {
      const response = await AxiosInstance.get(this.buildUrl(urlEndPoint), config);
      if (response && response.status >= 200 && response.status < 300) {
        return response.data as CommonResponse;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      const err = error as NetworkError;
      throw new Error(err.message || 'Unknown error occurred during GET call');
    }
  }

  async axiosPutCall(
    urlEndPoint: string,
    data?: object,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    try {
      const response = await AxiosInstance.put(this.buildUrl(urlEndPoint), data, config);
      if (response && response.status >= 200 && response.status < 300) {
        return response.data as CommonResponse;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      const err = error as NetworkError;
      throw new Error(err.message || 'Unknown error occurred during PUT call');
    }
  }

  async axiosDeleteCall(
    urlEndPoint: string,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    try {
      const response = await AxiosInstance.delete(this.buildUrl(urlEndPoint), config);
      if (response && response.status >= 200 && response.status < 300) {
        return response.data as CommonResponse;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      const err = error as NetworkError;
      throw new Error(err.message || 'Unknown error occurred during DELETE call');
    }
  }

  async axiosPatchCall(
    urlEndPoint: string,
    data?: object,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    try {
      const response = await AxiosInstance.patch(this.buildUrl(urlEndPoint), data, config);
      if (response && response.status >= 200 && response.status < 300) {
        return response.data as CommonResponse;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      const err = error as NetworkError;
      throw new Error(err.message || 'Unknown error occurred during PATCH call');
    }
  }
}
