/**
 * JSON-serializable object — the only shape that can appear as a keyed
 * response payload crossing an HTTP boundary.
 */
export interface ResponsePayloadRecord {
  [key: string]: ResponsePayload;
}

/**
 * Every JSON-serializable value an API endpoint can return.
 * Use this instead of `any` for response `data` fields.
 */
export type ResponsePayload =
  | string
  | number
  | boolean
  | null
  | ResponsePayloadRecord
  | ResponsePayload[];

// ─────────────────────────────────────────────────────────────────────────────

export class CommonResponse {
  status: boolean;
  errorCode: number;
  internalMessage: string;
  data?: ResponsePayload;

  constructor(
    status: boolean,
    errorCode: number,
    internalMessage: string,
    data?: ResponsePayload,
  ) {
    this.status = status;
    this.errorCode = errorCode;
    this.internalMessage = internalMessage;
    this.data = data;
  }
}
