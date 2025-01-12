export interface KVEntry<T> {
  key: string;
  value: T;
  created: Date;
  modified: Date;
}