/**
 * JSON-serialisable keyed object — replaces `any` for response data fields
 * throughout the backend-utils response hierarchy.
 */
export interface ResponseDataRecord {
  [key: string]: ResponseData;
}

/**
 * Every JSON-serialisable value an API response can carry.
 * Using this avoids `any` while still accepting any well-formed payload.
 */
export type ResponseData =
  | string
  | number
  | boolean
  | null
  | ResponseDataRecord
  | ResponseData[];

// ─────────────────────────────────────────────────────────────────────────────

export class GlobalResponseObject {
  status: boolean;
  errorCode: number;
  internalMessage: string;
  /**
   * `unknown` instead of `ResponseData` so that typed subclasses created by
   * `generateResponseModel` can safely narrow this field to a concrete type T
   * via `override data: T` without a TypeScript assignability error.
   */
  data?: unknown;

  constructor(
    status: boolean,
    errorCode: number,
    internalMessage: string,
    data?: unknown,
  ) {
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
    super(message);
    this.errorCode = errorCode;
    this.message = message;
  }
}

export class CommonResponseModel extends GlobalResponseObject {
  override data?: ResponseData;
  data1?: ResponseData;

  constructor(
    status: boolean,
    errorCode: number,
    internalMessage: string,
    data?: ResponseData,
    data1?: ResponseData,
  ) {
    super(status, errorCode, internalMessage);
    this.data  = data;
    this.data1 = data1;
  }
}

/**
 * Generates a typed subclass of {@link GlobalResponseObject} whose `data`
 * field carries a specific shape.
 *
 * @param dataClass  An instance (or constructor value) whose type anchors `data`.
 * @param name       Optional display name for the generated class.
 */
export function generateResponseModel<T extends object>(
  dataClass: T,
  name?: string,
): new (status: boolean, errorCode: number, internalMessage: string, data: T) => GlobalResponseObject & { data: T } {
  class GeneratedClass extends GlobalResponseObject {
    override data: T;

    constructor(
      status: boolean,
      errorCode: number,
      internalMessage: string,
      data: T,
    ) {
      super(status, errorCode, internalMessage);
      this.data = data;
    }
  }

  if (name) {
    Object.defineProperty(GeneratedClass, 'name', { value: name });
  }

  // dataClass is used only to anchor the generic T at call-site; it is not
  // stored at runtime.
  void dataClass;

  return GeneratedClass as new (
    status: boolean,
    errorCode: number,
    internalMessage: string,
    data: T,
  ) => GlobalResponseObject & { data: T };
}
