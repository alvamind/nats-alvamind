import { IConnection } from '../core/connection/i-connection';
import { IKV } from '../core/kv/i-kv';
import { NatsKV } from '../core/kv/nats-kv';
import { StorageConfig } from '../config/storage-config';
import { KvEntry } from 'nats';

export class Storage {
  private kv: IKV<any> | null = null;
  constructor(
    private connection: IConnection,
    private config: StorageConfig
  ) { }
  private async getKV(): Promise<IKV<any>> {
    if (!this.kv) {
      this.kv = new NatsKV(this.connection)
      await (this.kv as NatsKV<any>).init(this.config.bucketName);
    }
    return this.kv;
  }
  async get<T>(key: string): Promise<T | null> {
    const kv = await this.getKV();
    return kv.get(key)
  }
  async set<T>(key: string, value: T, options?: Record<string, any>): Promise<void> {
    const kv = await this.getKV();
    return kv.set(key, value, options);
  }
  async delete(key: string): Promise<void> {
    const kv = await this.getKV();
    return kv.delete(key);
  }

  async keys(key?: string): Promise<AsyncIterable<string>> {
    const kv = await this.getKV();
    return kv.keys(key);
  }

  async history(key: string, headersOnly?: boolean): Promise<AsyncIterable<KvEntry>> {
    const kv = await this.getKV();
    return kv.history(key, headersOnly);
  }

  async watch(key?: string, headersOnly?: boolean, initializedFn?: () => void): Promise<AsyncIterable<KvEntry>> {
    const kv = await this.getKV();
    return kv.watch(key, headersOnly, initializedFn);
  }
}
