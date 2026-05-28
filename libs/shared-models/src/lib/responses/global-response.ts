import { ResponsePayload } from './common-response';

export class GlobalResponseObject {
  status: boolean;
  errorCode: number;
  internalMessage: string;
  data: ResponsePayload;

  constructor(
    status: boolean,
    errorCode: number,
    internalMessage: string,
    data: ResponsePayload,
  ) {
    this.status = status;
    this.errorCode = errorCode;
    this.internalMessage = internalMessage;
    this.data = data;
  }
}
