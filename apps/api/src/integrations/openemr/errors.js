export class OpenEmrError extends Error {
  constructor(message, { statusCode = 502, operation } = {}) {
    super(message);
    this.name = 'OpenEmrError';
    this.statusCode = statusCode;
    this.operation = operation;
  }
}
