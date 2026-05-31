/**
 * JSON-serializable object — the only shape that can appear as a keyed
 * response payload crossing an HTTP boundary.
 */
export interface ResponsePayloadRecord {
  [key: string]: ResponsePayload;
}

/**
 * Every JSON-serializable value an API endpoint can return.
 * Used by the frontend for type-narrowing after receiving a CommonResponse.
 */
export type ResponsePayload =
  | string
  | number
  | boolean
  | null
  | ResponsePayloadRecord
  | ResponsePayload[];

/**
 * Union of every JSON-serializable value at the data-boundary level.
 * Accepts primitives, plain objects, and class instances (via `object`).
 * Does NOT use `any` or `unknown`.
 */
type JsonSerializable = object | string | number | boolean | null;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic HTTP response wrapper.
 *
 * `T` defaults to `JsonSerializable` so any entity, DTO, array, or primitive
 * can be passed to `data` without a cast.  The frontend narrows the data field
 * by casting to the specific shape it expects after receiving the response.
 */
export class CommonResponse<T extends JsonSerializable = JsonSerializable> {
  status: boolean;
  errorCode: number;
  internalMessage: string;
  data?: T;

  constructor(
    status: boolean,
    errorCode: number,
    internalMessage: string,
    data?: T,
  ) {
    this.status = status;
    this.errorCode = errorCode;
    this.internalMessage = internalMessage;
    this.data = data;
  }
}
