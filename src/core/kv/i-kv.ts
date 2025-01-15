import { KvEntry, } from 'nats';
export interface IKV<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, options?: Record<string, any>): Promise<void>;
  delete(key: string): Promise<void>;
  keys(key?: string): Promise<AsyncIterable<string>>;
  history(key: string, headersOnly?: boolean): Promise<AsyncIterable<KvEntry>>;
  watch(key?: string, headersOnly?: boolean, initializedFn?: () => void): Promise<AsyncIterable<KvEntry>>;
}
