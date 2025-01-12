export interface IKV<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, options?: Record<string, any>): Promise<void>;
  delete(key: string): Promise<void>;
}