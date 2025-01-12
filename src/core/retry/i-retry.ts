// nats-alvamind/src/core/retry/i-retry.ts
import { RetryOptions } from './retry-options';

export interface IRetry {
  withRetry<T>(operation: () => Promise<T>, options?: RetryOptions, onRetry?: (attempt: number, error: Error) => void): Promise<T>;
}
