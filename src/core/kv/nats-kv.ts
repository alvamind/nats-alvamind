import { Kvm, KV } from '@nats-io/kv';
import { IKV } from './i-kv';
import { KVOptions } from './kv-options';
import { NatsError } from '../errors/nats-error';
import { IConnection } from '../connection/i-connection';
import { CodecFactory } from '../codecs/codec-factory';
import { logger } from '../../utils/logger';
import { RetryUtil } from '../retry/retry-util';
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

    return RetryUtil.withRetry(async () => {
      try {
        this.kv = await this.kvm.open(this.options.bucketName)
          .catch(async () => {
            return await this.kvm.create(this.options.bucketName);
          });
        this.initialized = true;
        logger.info(`KV Store ready: ${this.options.bucketName}`);
      } catch (error: any) {
        logger.error(`Failed to initialize KV store ${this.options.bucketName}`, error);
        throw new NatsError(`Failed to initialize KV store: ${error.message}`, 'KV_ERROR', error);
      }
    });
  }
  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  async get(key: string): Promise<T | null> {
    await this.ensureInitialized();
    return RetryUtil.withRetry(async () => {
      try {
        const entry = await this.kv.get(key);
        return entry ? this.codec.decode(entry.value) : null;
      } catch (error: any) {
        logger.error(`Failed to get value for key ${key}`, error);
        throw new NatsError(`Failed to get value for key ${key}: ${error.message}`, 'KV_ERROR', error);
      }
    });
  }
  async set(key: string, value: T, options?: { expireMode?: 'PX', time?: number }): Promise<void> {
    await this.ensureInitialized();
    return RetryUtil.withRetry(async () => {
      try {
        await this.kv.put(key, this.codec.encode(value));
        if (options && options.expireMode === 'PX' && options.time) {
          setTimeout(() => this.delete(key), options.time);
        }
      } catch (error: any) {
        logger.error(`Failed to set value for key ${key}`, error);
        throw new NatsError(`Failed to set value for key ${key}: ${error.message}`, 'KV_ERROR', error);
      }
    });
  }
  async delete(key: string): Promise<void> {
    await this.ensureInitialized();
    return RetryUtil.withRetry(async () => {
      try {
        await this.kv.delete(key);
      } catch (error: any) {
        logger.error(`Failed to delete key ${key}`, error);
        throw new NatsError(`Failed to delete key ${key}: ${error.message}`, 'KV_ERROR', error);
      }
    });
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
