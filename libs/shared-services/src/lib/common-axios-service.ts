import { AxiosRequestConfig } from 'axios';
import { AxiosInstance } from './axios-instance';
import { configVariables } from './config';

export class CommonAxiosService {
    URL = configVariables.APP_INO_SERVICE_URL;

    axiosPostCall = async (urlEndPoint: string, data?: any, config?: AxiosRequestConfig) => {
        console.log(AxiosInstance)
        return await AxiosInstance.post(this.URL + urlEndPoint, data, config)
            .then(response => {
                if (response && response.status >= 200 && response.status < 300) {
                    return response.data;
                } else {
                    throw response;
                }
            })
            .catch(err => {
                throw new Error(err.message);
            });
    };
}