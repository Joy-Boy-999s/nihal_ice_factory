export class ErrorResponse extends Error {
  errorCode: number;
  override message: string;
  constructor(errorCode: number, message: string) {
      super();
      this.errorCode = errorCode;
      this.message = message;
  }
}
