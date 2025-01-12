// src/core/kv/nats-kv.ts
import { Kvm, KV } from '@nats-io/kv';
import { IKV } from './i-kv';
import { KVOptions } from './kv-options';
import { NatsError } from '../errors/nats-error';
import { IConnection } from '../connection/i-connection';
import { CodecFactory } from '../codecs/codec-factory';
import { logger } from '../../utils/logger';
import { jetstream } from '@nats-io/jetstream';
import { NatsConnection as CoreNatsConnection } from '@nats-io/nats-core'

interface DecodedKvEntry<T> {
  key: string;
  value: T | null;
  created: Date;
  modified: Date;
}

// src/core/kv/nats-kv.ts
export class NatsKV<T> implements IKV<T> {
  private kv!: KV;
  private kvm: Kvm;
  private codec = CodecFactory.create<T>('json');
  private initialized = false; // Initialization Flag
  private kvWatch: any = null;

  constructor(
    private connection: IConnection,
    private options: KVOptions
  ) {
    const nc = this.connection.getNatsConnection() as CoreNatsConnection
    const js = jetstream(nc, { timeout: 10_000 });
    this.kvm = new Kvm(js as any);
  }
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info(`Attempting to open/create KV store: ${this.options.bucketName}`);
      this.kv = await this.kvm.open(this.options.bucketName)
        .catch(async () => {
          logger.info(`KV Store not found. Creating ${this.options.bucketName}`);
          return await this.kvm.create(this.options.bucketName);
        });
      this.initialized = true;
      logger.info(`KV Store initialized: ${this.options.bucketName}`);
    } catch (error: any) {
      logger.error(`Failed to initialize KV store ${this.options.bucketName}`, error);
      throw new NatsError(`Failed to initialize KV store: ${error.message}`, 'KV_ERROR', error);
    }

  }
  private async ensureInitialized() {
    if (!this.initialized) {
      logger.info(`ensureInitialized: KV Store not initialized, calling init`);
      await this.init();
      logger.info(`ensureInitialized: KV Store initialized`);
    }
  }

  async get(key: string): Promise<T | null> {
    await this.ensureInitialized();
    try {
      logger.info(`get: Attempting to get key: ${key} from KV store ${this.options.bucketName}`);
      const entry = await this.kv.get(key);
      logger.info(`get: Retrieved key: ${key} from KV store ${this.options.bucketName}`);
      return entry ? this.codec.decode(entry.value) : null;
    } catch (error: any) {
      logger.error(`Failed to get value for key ${key}`, error);
      throw new NatsError(`Failed to get value for key ${key}: ${error.message}`, 'KV_ERROR', error);
    }
  }
  async set(key: string, value: T, options?: { expireMode?: 'PX', time?: number }): Promise<void> {
    await this.ensureInitialized();
    if (!this.initialized) {
      logger.error(`set: KV store is not initialized for key ${key}`);
      throw new NatsError("KV Store not initialized", 'KV_ERROR');
    }
    try {
      logger.info(`set: Attempting to put key: ${key} into KV store ${this.options.bucketName}`);
      await this.kv.put(key, this.codec.encode(value));
      logger.info(`set: Put key: ${key} into KV store ${this.options.bucketName}`);

      if (options && options.expireMode === 'PX' && options.time) {
        setTimeout(() => this.delete(key), options.time);
      }
    } catch (error: any) {
      logger.error(`set: Failed to set value for key ${key} : ${error.message}`, error);
      throw new NatsError(`Failed to set value for key ${key}: ${error.message}`, 'KV_ERROR', error);
    }
  }
  async delete(key: string): Promise<void> {
    await this.ensureInitialized();
    try {
      logger.info(`delete: Attempting to delete key: ${key} from KV store ${this.options.bucketName}`);
      await this.kv.delete(key);
      logger.info(`delete: Deleted key: ${key} from KV store ${this.options.bucketName}`);
    } catch (error: any) {
      logger.error(`Failed to delete key ${key}`, error);
      throw new NatsError(`Failed to delete key ${key}: ${error.message}`, 'KV_ERROR', error);
    }
  }

  async watch(onEntry: (entry: DecodedKvEntry<T>) => void, keys?: string[]): Promise<void> {
    await this.ensureInitialized();
    if (this.kvWatch) {
      this.kvWatch.stop();
    }
    this.kvWatch = await this.kv.watch(keys ? { key: keys } : undefined);
    (async () => {
      for await (const entry of this.kvWatch!) {
        onEntry({
          key: entry.key,
          value: entry.value instanceof Uint8Array ? this.codec.decode(entry.value) : null,
          created: entry.created,
          modified: entry.modified,
        });
      }
    })().catch((error) => {
      logger.error("Error in watch iterator", error);
    });
  }
}
