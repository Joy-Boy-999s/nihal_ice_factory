

export class GlobalResponseObject {
    status: boolean;
    errorCode: number;
    internalMessage: string;
    data?: any
    /**
     *
     * @param status
     * @param errorCode
     * @param internalMessage
     * @param data
     */
    constructor(status: boolean, errorCode: number, internalMessage: string, data?: any) {
        this.status = status;
        this.errorCode = errorCode;
        this.internalMessage = internalMessage;
        this.data = data
    }
}


// export class GlobalResponseObject {
//     status: boolean;
//     intlCode: number;
//     internalMessage: string;
//     data?: any;

//     /**
//      *
//      * @param status
//      * @param intlCode
//      * @param internalMessage
//      * @param data
//      */
//     constructor(status: boolean, intlCode: number, internalMessage: string, data?: any) {
//         this.status = status;
//         this.intlCode = intlCode;
//         this.internalMessage = internalMessage;
//         this.data = data;
//     }
// }

export class ErrorResponse extends Error {
    errorCode: number;
    message: string;
    constructor(errorCode: number, message: string) {
        super();
        this.errorCode = errorCode;
        this.message = message;
    }
}

export class CommonResponseModel extends GlobalResponseObject {
    data?: any
    data1?: any
    /**
     *
     * @param status
     * @param errorCode
     * @param internalMessage
     */
    constructor(status: boolean, errorCode: number, internalMessage: string, data?: any, data1?: any) {
        super(status, errorCode, internalMessage);
        this.data = data
        this.data1 = data1
    }
}

export function generateResponseModel(dataClass: any, name?: string) {
    class GeneratedClass extends GlobalResponseObject {
        data: typeof dataClass;

        /**
    *
    * @param status
    * @param errorCode
    * @param internalMessage
    */
        constructor(status: boolean, errorCode: number, internalMessage: string, data: any) {
            super(status, errorCode, internalMessage);
            this.data = data
        }
    }
    if (name) {
        Object.defineProperty(GeneratedClass, 'name', name)
    }
    return GeneratedClass
}

