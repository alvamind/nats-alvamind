// nats-alvamind/src/core/kv/nats-kv.ts
import { Kvm, KV } from '@nats-io/kv';
import { IKV } from './i-kv';
import { KVOptions } from './kv-options';
import { NatsError } from '../errors/nats-error';
import { IConnection } from '../connection/i-connection';
import { CodecFactory } from '../codecs/codec-factory';
import { logger } from '../../utils/logger';
import { RetryUtil } from '../retry/retry-util';

// src/core/kv/nats-kv.ts
export class NatsKV<T> implements IKV<T> {
  private kv!: KV;
  private kvm: Kvm;
  private codec = CodecFactory.create<T>('json');
  private initialized = false; // Initialization Flag
  constructor(
    private connection: IConnection,
    private options: KVOptions
  ) {
    this.kvm = new Kvm(this.connection.getNatsConnection() as any);
  }
  async init(): Promise<void> {
    if (this.initialized) return;
    return RetryUtil.withRetry(async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
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
  async set(key: string, value: T, options?: Record<string, any>): Promise<void> {
    await this.ensureInitialized();
    return RetryUtil.withRetry(async () => {
      try {
        await this.kv.put(key, this.codec.encode(value));
        if (options && options['expireMode'] === 'PX' && options['time']) {
          setTimeout(() => this.delete(key), options['time'] as number);
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
}
