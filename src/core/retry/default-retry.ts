import { NatsError } from "nats";
import { IRetry } from "./i-retry";
import { RetryOptions } from "./retry-options";

// src/core/retry/default-retry.ts
export class DefaultRetry implements IRetry {
  async withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}, onRetry?: (attempt: number, error: Error) => void): Promise<T> {
    const { attempts = 3, delay = 100, factor = 2, maxDelay = 3000 } = options;
    let currentAttempt = 0;
    let currentDelay = delay;

    while (currentAttempt < attempts) {
      try {
        return await operation();
      } catch (error: any) {
        currentAttempt++;
        if (currentAttempt >= attempts) {
          throw new NatsError(`Operation failed after ${attempts} retries: ${error.message}`, 'RETRY_ERROR', error);
        }
        if (onRetry) {
          onRetry(currentAttempt, error);
        }
        await this.sleep(currentDelay);
        currentDelay = Math.min(currentDelay * factor, maxDelay);
      }
    }
    throw new NatsError('Should not reach here', 'RETRY_ERROR');
  }
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
