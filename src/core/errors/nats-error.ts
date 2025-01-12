export class NatsError extends Error {
  constructor(message: string, public code: string, public originalError?: Error) {
    super(message);
    this.name = 'NatsError';
    if (originalError) {
      this.stack = originalError.stack;
    }
    Object.setPrototypeOf(this, NatsError.prototype);
  }
}