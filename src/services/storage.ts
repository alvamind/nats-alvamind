// nats-alvamind/src/services/storage.ts
import { IConnection } from '../core/connection/i-connection';
import { IKV } from '../core/kv/i-kv';
import { NatsKV } from '../core/kv/nats-kv';
import { StorageConfig } from '../config/storage-config';
export class Storage {
  private kv: IKV<any> | null = null;
  constructor(
    private connection: IConnection,
    private config: StorageConfig
  ) { }
  private async getKV(): Promise<IKV<any>> {
    if (!this.kv) {
      this.kv = new NatsKV(this.connection, { bucketName: this.config.bucketName })
      await (this.kv as NatsKV<any>).init();
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
}
