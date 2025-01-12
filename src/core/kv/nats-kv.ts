import { JetStreamClient, JetStreamManager, KV } from 'nats';
import { IConnection } from '../connection/i-connection';
import { CodecFactory } from '../codecs/codec-factory';
import { logger } from '../../utils/logger';
import { IKV } from './i-kv';
import { NatsError } from '../errors/nats-error';

export class NatsKV<T> implements IKV<T> {
  private kv!: KV;
  private codec = CodecFactory.create<T>('json');
  private jsm!: JetStreamManager;
  private bucketName: string

  constructor(private connection: IConnection) {
    this.bucketName = '';
  }

  async init(bucket: string): Promise<void> {
    this.bucketName = bucket;
    this.jsm = await this.connection.jetStreamManager();
    const js: JetStreamClient = this.jsm.jetstream();
    this.kv = await js.views.kv(bucket);
  }

  async get(key: string): Promise<T | null> {
    try {
      const entry = await this.kv.get(key);
      if (entry) {
        return this.codec.decode(entry.value);
      }
      return null;
    } catch (error) {
      logger.error(`Error getting key ${key}:`, error);
      throw error;
    }
  }

  async set(key: string, value: T): Promise<void> {
    try {
      const encodedValue = this.codec.encode(value);
      await this.kv.put(key, encodedValue);
    } catch (error) {
      logger.error(`Error putting key ${key}:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      logger.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }
  async purge(): Promise<void> {
    try {
      const keys = await this.kv.keys();
      for await (const key of keys) {
        await this.kv.purge(key);
      }
    } catch (error: any) {
      logger.error(`Error purging KV store:`, error);
      throw new NatsError(`Failed to purge KV store: ${error.message}`, 'KV_ERROR', error);
    }
  }


  async deleteBucket(): Promise<void> {
    try {
      await this.jsm.streams.delete(this.bucketName);
      logger.info(`KV store ${this.bucketName} deleted.`);
    } catch (error: any) {
      logger.error(`Failed to delete KV store`, error);
      throw new NatsError(`Failed to delete KV store: ${error.message}`, 'KV_ERROR', error);
    }
  }
}
