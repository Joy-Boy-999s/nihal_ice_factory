
import { GlobalResponseObject, ErrorResponse } from './global-response-object'
export class ApplicationExceptionHandler {
    constructor() {
        // do nothing
    }

    returnException<T extends GlobalResponseObject>(
        classType: new (status: boolean, errorCode: number, internalMessage: string, data?: any) => T,
        errorObj: any
    ): T {
        let errorCode: number = 0;
        let message: string = 'Unknown error';
    
        if (errorObj instanceof ErrorResponse) {
            errorCode = errorObj.errorCode ?? 0;
            message = errorObj.message ?? 'Unknown error';
        } else if (errorObj instanceof Error) {
            message = errorObj.message ?? 'Unknown error';
        }
    
        const responseObj = new classType(false, errorCode, message);
        responseObj.status = false;
        responseObj.errorCode = errorCode;
        responseObj.internalMessage = message;
        return responseObj;
    }
}        