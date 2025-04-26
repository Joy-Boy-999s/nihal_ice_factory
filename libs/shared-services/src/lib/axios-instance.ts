import axios, { AxiosError } from 'axios';
import { configVariables } from './config';
import axiosRetry from 'axios-retry';

const RETRY_CODES: string[] = configVariables.APP_RETRY_CODES?.split(',');//network issue code
const APP_REQ_RETRY_STATUS_CODES: string[] = configVariables.APP_REQ_RETRY_STATUS_CODES?.split(',');

export const AxiosInstance = axios.create({});
axiosRetry(AxiosInstance, {
    retries: configVariables.APP_REQ_RETRY_MAX_ATTEMPTS, // number of retries
    retryDelay: (retryCount: number) => {
        if (retryCount === 0) return 0;
        return configVariables.APP_REQ_RETRY_DELAY;// time interval between retries
    },
    retryCondition: (error: AxiosError) => {
        const { response, code } :any= error;
        const { status } = response || {};
        if (RETRY_CODES?.includes(code)) return true;
        if (APP_REQ_RETRY_STATUS_CODES?.includes(`${status}`)) return true;
        return false;
    },
});





