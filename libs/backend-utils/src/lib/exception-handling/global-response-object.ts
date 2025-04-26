export class GlobalResponseObject {
    status: boolean;
    errorCode: number;
    internalMessage: string;
    data?: any;

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
        this.data = data;
    }
}

export class ErrorResponse extends Error {
    errorCode: number;
    override message: string;

    constructor(errorCode: number, message: string) {
        super(message); // Pass message to the base Error class
        this.errorCode = errorCode;
        this.message = message;
    }
}

export class CommonResponseModel extends GlobalResponseObject {
    override data?: any;
    data1?: any;

    /**
     *
     * @param status
     * @param errorCode
     * @param internalMessage
     * @param data
     * @param data1
     */
    constructor(status: boolean, errorCode: number, internalMessage: string, data?: any, data1?: any) {
        super(status, errorCode, internalMessage);
        this.data = data;
        this.data1 = data1;
    }
}

export function generateResponseModel(dataClass: any, name?: string) {
    class GeneratedClass extends GlobalResponseObject {
        override data: typeof dataClass;

        /**
         *
         * @param status
         * @param errorCode
         * @param internalMessage
         * @param data
         */
        constructor(status: boolean, errorCode: number, internalMessage: string, data: any) {
            super(status, errorCode, internalMessage);
            this.data = data;
        }
    }

    if (name) {
        Object.defineProperty(GeneratedClass, 'name', { value: name });
    }

    return GeneratedClass;
}
