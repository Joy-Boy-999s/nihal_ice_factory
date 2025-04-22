
import { GlobalResponseObject, ErrorResponse } from './global-response-object'
export class ApplicationExceptionHandler {
    constructor() {
        // do nothing
    }

    returnException<T extends GlobalResponseObject>(classType: new (status: boolean, errorCode: number, internalMessage: string, data?: any) => T, errorObj: any): T {
        let errorCode;
        let message;
        if (errorObj instanceof ErrorResponse) {
            errorCode = errorObj.errorCode;
            message = errorObj.message;
        } else if (errorObj instanceof Error) {
            errorCode = 0;
            message = errorObj.message;
        }
        const responseObj = new classType(false, errorCode, message);
        responseObj.status = false;
        responseObj.errorCode = errorCode;
        responseObj.internalMessage = message;
        return responseObj;
    }
}