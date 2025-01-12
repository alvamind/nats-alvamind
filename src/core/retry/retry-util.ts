// nats-alvamind/src/core/retry/retry-util.ts
import { RetryOptions } from './retry-options';
import { DefaultRetry } from './default-retry';

export class RetryUtil {
  static withRetry<T>(operation: () => Promise<T>, options?: RetryOptions, onRetry?: (attempt: number, error: Error) => void): Promise<T> {
    const retry = new DefaultRetry()
    return retry.withRetry(operation, options, onRetry);
  }
}
