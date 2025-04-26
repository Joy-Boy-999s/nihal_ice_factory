export class GlobalResponseObject {
    status: boolean;
    errorCode: number;
    internalMessage: string;
    data: any
    constructor(status: boolean, errorCode: number, internalMessage: string, data: any){
        this.status = status;
        this.errorCode = errorCode;
        this.internalMessage = internalMessage;
        this.data = data
    }
}

