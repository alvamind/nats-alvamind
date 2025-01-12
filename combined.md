// nats-alvamind/src/core/connection/nats-connection.ts
import { connect, NatsConnection } from 'nats';
import { IConnection } from './i-connection';
import { ConnectionOptions } from './connection-options';
import { NatsError } from '../errors/nats-error';
import { logger } from '../../utils/logger';

export class NatsConnectionImpl implements IConnection {
  private connection: NatsConnection | null = null;
  private isConnected = false;
  constructor(private options: ConnectionOptions) { }
  async connect(): Promise<void> {
    try {
      this.connection = await connect(this.options);
      this.isConnected = true;
      logger.info('Connected to NATS server');
    } catch (error) {
      logger.error('Failed to connect to NATS', error);
      throw new NatsError(`Failed to connect to NATS: ${error.message}`, 'CONNECTION_ERROR');
    }
  }
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.isConnected = false;
      logger.info('NATS connection closed');
    }
  }
  getNatsConnection(): NatsConnection {
    if (!this.connection) {
      throw new NatsError('NATS connection is not established', 'CONNECTION_ERROR');
    }
    return this.connection;
  }
  isConnectedToNats(): boolean {
    return this.isConnected;
  }
}

// nats-alvamind/src/core/connection/connection-options.ts
import { ConnectionOptions as NatsOptions } from 'nats'
export type ConnectionOptions = NatsOptions;

// nats-alvamind/src/core/connection/connection-manager.ts
import { IConnection } from './i-connection';
import { ConnectionOptions } from './connection-options';
import { NatsConnectionImpl } from './nats-connection';

export class ConnectionManager {
  private connection: IConnection | null = null;

  constructor(private options: ConnectionOptions) { }

  async getConnection(): Promise<IConnection> {
    if (!this.connection || !this.connection.isConnectedToNats()) {
      this.connection = new NatsConnectionImpl(this.options);
      await this.connection.connect();
    }
    return this.connection;
  }
  async closeConnection(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}

// nats-alvamind/src/core/connection/i-connection.ts
import { NatsConnection } from 'nats';

export interface IConnection {
  connect(): Promise<void>;
  close(): Promise<void>;
  getNatsConnection(): NatsConnection;
  isConnectedToNats(): boolean;
}

// nats-alvamind/src/core/codecs/i-codec.ts
export interface ICodec<T> {
  encode(data: T): Uint8Array;
  decode(data: Uint8Array): T;
}

// nats-alvamind/src/core/codecs/json-codec.ts
import { JSONCodec } from 'nats';
import { ICodec } from './i-codec';

export class JsonCodec<T> implements ICodec<T> {
  private codec = JSONCodec();
  encode(data: T): Uint8Array {
    return this.codec.encode(data);
  }
  decode(data: Uint8Array): T {
    return this.codec.decode(data) as T;
  }
}

// nats-alvamind/src/core/codecs/string-codec.ts
import { StringCodec as NatsStringCodec } from 'nats';
import { ICodec } from './i-codec';

export class StringCodec implements ICodec<string> {
  private codec = NatsStringCodec();
  encode(data: string): Uint8Array {
    return this.codec.encode(data);
  }
  decode(data: Uint8Array): string {
    return this.codec.decode(data);
  }
}

// nats-alvamind/src/core/codecs/codec-factory.ts
import { ICodec } from './i-codec';
import { JsonCodec } from './json-codec';
import { StringCodec } from './string-codec';

export class CodecFactory {
  static create<T>(type: 'json' | 'string'): ICodec<T> {
    switch (type) {
      case 'json':
        return new JsonCodec<T>();
      case 'string':
        return new StringCodec() as ICodec<T>;
      default:
        throw new Error(`Unsupported codec type: ${type}`);
    }
  }
}

// nats-alvamind/src/core/streams/i-stream.ts
import { StreamInfo, StreamConfig, JetStreamPublishOptions } from 'nats';
import { ConsumerOptions } from '../consumers/consumer-options';
import { IConsumer } from '../consumers/i-consumer';
import { MessageHandler } from '../../interfaces/message-handler';

export interface IStream {
  init(): Promise<void>;
  getStreamInfo(): Promise<StreamInfo>;
  publish<T>(subject: string, data: T, options?: JetStreamPublishOptions): Promise<void>;
  subscribe<T>(subject: string, handler: MessageHandler<T>, options?: ConsumerOptions): Promise<IConsumer>;
  delete(): Promise<void>;
}

// nats-alvamind/src/core/streams/nats-stream.ts
import {
  JetStreamManager,
  JetStreamClient,
  StreamInfo,
  StreamConfig,
  JetStreamPublishOptions,
} from 'nats';
import { IStream } from './i-stream';
import { StreamOptions } from './stream-options';
import { NatsError } from '../errors/nats-error';
import { IConnection } from '../connection/i-connection';
import { CodecFactory } from '../codecs/codec-factory';
import { IConsumer } from '../consumers/i-consumer';
import { NatsConsumer } from '../consumers/nats-consumer';
import { ConsumerOptions } from '../consumers/consumer-options';
import { MessageHandler } from '../../interfaces/message-handler';
import { logger } from '../../utils/logger';

export class NatsStream implements IStream {
  private jsm: JetStreamManager;
  private js: JetStreamClient;
  private streamInfo: StreamInfo | null = null;
  private codec = CodecFactory.create<any>('json');

  constructor(
    private connection: IConnection,
    private options: StreamOptions
  ) {
    this.jsm = this.connection.getNatsConnection().jetstreamManager();
    this.js = this.connection.getNatsConnection().jetstream();
  }

  async init(): Promise<void> {
    try {
      const streamExists = await this.jsm.streams.info(this.options.name)
        .catch(() => false);

      if (!streamExists) {
        await this.jsm.streams.add(this.options as StreamConfig);
        logger.info(`Stream ${this.options.name} created`);
      }
      this.streamInfo = await this.jsm.streams.info(this.options.name);
    } catch (error) {
      logger.error(`Failed to initialize stream ${this.options.name}`, error);
      throw new NatsError(`Failed to initialize stream: ${error.message}`, 'STREAM_ERROR');
    }
  }

  async getStreamInfo(): Promise<StreamInfo> {
    if (!this.streamInfo) {
      this.streamInfo = await this.jsm.streams.info(this.options.name);
    }
    return this.streamInfo;
  }
  async publish<T>(subject: string, data: T, options?: JetStreamPublishOptions): Promise<void> {
    try {
      await this.js.publish(subject, this.codec.encode(data), options);
    } catch (error) {
      logger.error(`Failed to publish message to subject: ${subject}`, error);
      throw new NatsError(`Failed to publish to subject: ${subject}, ${error.message}`, 'PUBLISH_ERROR');
    }
  }
  async subscribe<T>(
    subject: string,
    handler: MessageHandler<T>,
    options?: ConsumerOptions
  ): Promise<IConsumer> {
    if (!this.streamInfo) {
      throw new NatsError(`Stream ${this.options.name} is not initialized, can't subscribe`, 'STREAM_ERROR');
    }
    const consumer = new NatsConsumer<T>(this.connection, this, subject, handler, options);
    await consumer.consume();
    return consumer;
  }

  async delete(): Promise<void> {
    try {
      await this.jsm.streams.delete(this.options.name);
      logger.info(`Stream ${this.options.name} deleted.`);
    } catch (error) {
      logger.error(`Failed to delete stream ${this.options.name}`, error);
      throw new NatsError(`Failed to delete stream: ${error.message}`, 'STREAM_ERROR');
    }
  }
}

// nats-alvamind/src/core/streams/stream-options.ts
import { StreamConfig } from 'nats';

export type StreamOptions = StreamConfig;

// nats-alvamind/src/core/consumers/i-consumer.ts
export interface IConsumer {
  consume(): Promise<void>;
  stop(): Promise<void>;
}

// nats-alvamind/src/core/consumers/nats-consumer.ts
import {
  JetStreamClient,
  JetStreamSubscription,
  JsMsg,
  ConsumerOpts,
} from 'nats';
import { IConsumer } from './i-consumer';
import { ConsumerOptions } from './consumer-options';
import { NatsError } from '../errors/nats-error';
import { IConnection } from '../connection/i-connection';
import { IStream } from '../streams/i-stream';
import { CodecFactory } from '../codecs/codec-factory';
import { MessageHandler } from '../../interfaces/message-handler';
import { logger } from '../../utils/logger';

export class NatsConsumer<T> implements IConsumer {
  private js: JetStreamClient;
  private subscription?: JetStreamSubscription;
  private codec = CodecFactory.create<T>('json');
  constructor(
    private connection: IConnection,
    private stream: IStream,
    private subject: string,
    private handler: MessageHandler<T>,
    private options?: ConsumerOptions,
  ) {
    this.js = this.connection.getNatsConnection().jetstream();
  }
  async consume(): Promise<void> {
    try {
      const opts = this.options || {}
      const consumerOptions = Object.assign({
        durable_name: this.subject,
        filter_subject: this.subject
      }, opts)
      this.subscription = await this.js.subscribe(this.subject, consumerOptions)

        (async () => {
          for await (const msg of this.subscription) {
            try {
              const payload = this.codec.decode(msg.data);
              await this.handler(null, payload);
              msg.ack();
            } catch (error) {
              this.handler(error as Error, null);
              msg.term();
            }
          }
        })().catch(error => this.handler(error as Error, null));
      logger.info(`Subscribed to ${this.subject}`);

    } catch (error) {
      logger.error(`Failed to subscribe to ${this.subject}`, error);
      throw new NatsError(`Failed to subscribe to ${this.subject}: ${error.message}`, 'CONSUMER_ERROR');
    }
  }
  async stop(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      logger.info(`Unsubscribed from subject ${this.subject}`);
    }
  }
}

// nats-alvamind/src/core/consumers/consumer-options.ts
import { ConsumerOpts } from 'nats';

export type ConsumerOptions = ConsumerOpts;

// nats-alvamind/src/core/kv/i-kv.ts
export interface IKV<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, options?: Record<string, any>): Promise<void>;
  delete(key: string): Promise<void>;
}

// nats-alvamind/src/core/kv/nats-kv.ts
import { Kvm, KV, Entry } from '@nats-io/kv';
import { IKV } from './i-kv';
import { KVOptions } from './kv-options';
import { NatsError } from '../errors/nats-error';
import { IConnection } from '../connection/i-connection';
import { CodecFactory } from '../codecs/codec-factory';
import { logger } from '../../utils/logger';

export class NatsKV<T> implements IKV<T> {
  private kv: KV;
  private kvm: Kvm;
  private codec = CodecFactory.create<T>('json');
  constructor(
    private connection: IConnection,
    private options: KVOptions
  ) {
    this.kvm = new Kvm(this.connection.getNatsConnection() as any);
  }
  async init(): Promise<void> {
    try {
      this.kv = await this.kvm.open(this.options.bucketName)
        .catch(async () => {
          return await this.kvm.create(this.options.bucketName);
        });
      logger.info(`KV Store ready: ${this.options.bucketName}`);
    } catch (error) {
      logger.error(`Failed to initialize KV store ${this.options.bucketName}`, error);
      throw new NatsError(`Failed to initialize KV store: ${error.message}`, 'KV_ERROR');
    }
  }

  async get(key: string): Promise<T | null> {
    try {
      const entry = await this.kv.get(key);
      return entry ? this.codec.decode(entry.value) : null;
    } catch (error) {
      logger.error(`Failed to get value for key ${key}`, error);
      throw new NatsError(`Failed to get value for key ${key}: ${error.message}`, 'KV_ERROR');
    }
  }
  async set(key: string, value: T, options?: Record<string, any>): Promise<void> {
    try {
      await this.kv.put(key, this.codec.encode(value));
      if (options?.expireMode === 'PX' && options.time) {
        setTimeout(() => this.delete(key), options.time as number);
      }
    } catch (error) {
      logger.error(`Failed to set value for key ${key}`, error);
      throw new NatsError(`Failed to set value for key ${key}: ${error.message}`, 'KV_ERROR');
    }
  }
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      logger.error(`Failed to delete key ${key}`, error);
      throw new NatsError(`Failed to delete key ${key}: ${error.message}`, 'KV_ERROR');
    }
  }
}

// nats-alvamind/src/core/kv/kv-options.ts
export interface KVOptions {
  bucketName: string;
}

// nats-alvamind/src/core/kv/kv-entry.ts
export interface KVEntry<T> {
  key: string;
  value: T;
  created: Date;
  modified: Date;
}

// nats-alvamind/src/core/retry/i-retry.ts
export interface IRetry {
  withRetry<T>(operation: () => Promise<T>, options?: RetryOptions, onRetry?: (attempt: number, error: Error) => void): Promise<T>;
}

// nats-alvamind/src/core/retry/retry-options.ts
export interface RetryOptions {
  attempts?: number;
  delay?: number;
  factor?: number;
  maxDelay?: number;
}

// nats-alvamind/src/core/retry/retry-util.ts
import { IRetry } from './i-retry';
import { RetryOptions } from './retry-options';
import { DefaultRetry } from './default-retry';

export class RetryUtil {
  static withRetry<T>(operation: () => Promise<T>, options?: RetryOptions, onRetry?: (attempt: number, error: Error) => void): Promise<T> {
    const retry = new DefaultRetry()
    return retry.withRetry(operation, options, onRetry);
  }
}

// nats-alvamind/src/core/retry/default-retry.ts
import { IRetry } from './i-retry';
import { RetryOptions } from './retry-options';
import { NatsError } from '../errors/nats-error';

export class DefaultRetry implements IRetry {
  async withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}, onRetry?: (attempt: number, error: Error) => void): Promise<T> {
    const { attempts = 3, delay = 100, factor = 2, maxDelay = 3000 } = options;
    let currentAttempt = 0;
    let currentDelay = delay;

    while (currentAttempt < attempts) {
      try {
        return await operation();
      } catch (error) {
        currentAttempt++;
        if (currentAttempt >= attempts) {
          throw new NatsError(`Operation failed after ${attempts} retries: ${error.message}`, 'RETRY_ERROR');
        }
        if (onRetry) {
          onRetry(currentAttempt, error as Error);
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

// nats-alvamind/src/core/errors/nats-error.ts
export class NatsError extends Error {
  constructor(message: string, public code: string, public originalError?: Error) {
    super(message);
    this.name = 'NatsError';
    if (originalError) {
      this.stack = originalError.stack;
    }
    Object.setPrototypeOf(this, NatsError.prototype);
  }
}

// nats-alvamind/src/services/message-broker.ts
import { IConnection } from '../core/connection/i-connection';
import { IStream } from '../core/streams/i-stream';
import { NatsStream } from '../core/streams/nats-stream';
import { StreamOptions } from '../core/streams/stream-options';
import { IConsumer } from '../core/consumers/i-consumer';
import { ConsumerOptions } from '../core/consumers/consumer-options';
import { RetryUtil } from '../core/retry/retry-util';
import { MessageBrokerConfig } from '../config/message-broker-config';
import { IRetry } from '../core/retry/i-retry';
import { RetryOptions } from '../core/retry/retry-options';
import { MessageHandler } from '../interfaces/message-handler';
import { MessageOptions } from '../interfaces/message-options';
import { logger } from '../utils/logger';

export class MessageBroker {
  private stream: IStream | null = null;
  constructor(
    private connection: IConnection,
    private config: MessageBrokerConfig,
    private retryConfig?: RetryOptions
  ) { }

  async createStream(options: StreamOptions): Promise<void> {
    this.stream = new NatsStream(this.connection, options);
    await this.stream.init();
  }

  async getStream(): Promise<IStream> {
    if (!this.stream) {
      const streamOptions = Object.assign({
        name: this.config.streamName,
        subjects: this.config.subjects,
      })
      this.stream = new NatsStream(this.connection, streamOptions)
      await this.stream.init();
    }
    return this.stream;
  }
  async publish<T>(subject: string, payload: T, options?: MessageOptions): Promise<void> {
    const stream = await this.getStream();
    return RetryUtil.withRetry(
      async () => {
        await stream.publish(subject, payload, options);
        logger.info(`Published to ${subject}`);
      },
      this.retryConfig,
      (attempt, error) => logger.warn(`Retry ${attempt}: ${error.message}`)
    );
  }
  async subscribe<T>(subject: string, handler: MessageHandler<T>, options?: ConsumerOptions): Promise<IConsumer> {
    const stream = await this.getStream();
    return stream.subscribe(subject, handler, options)
  }
  async deleteStream(): Promise<void> {
    if (this.stream) {
      await this.stream.delete();
      this.stream = null;
    }
  }
}

// nats-alvamind/src/services/storage.ts
import { IConnection } from '../core/connection/i-connection';
import { IKV } from '../core/kv/i-kv';
import { NatsKV } from '../core/kv/nats-kv';
import { KVOptions } from '../core/kv/kv-options';
import { StorageConfig } from '../config/storage-config';
import { logger } from '../utils/logger';

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

// nats-alvamind/src/services/index.ts
export { MessageBroker } from './message-broker';
export { Storage } from './storage';

// nats-alvamind/src/config/message-broker-config.ts
export interface MessageBrokerConfig {
  url: string;
  streamName: string;
  subjects: string[];
  consumerName: string;
}

// nats-alvamind/src/config/storage-config.ts
export interface StorageConfig {
  bucketName: string;
}

// nats-alvamind/src/config/retry-config.ts
import { RetryOptions } from '../core/retry/retry-options';
export type RetryConfig = RetryOptions

// nats-alvamind/src/interfaces/message-handler.ts
export type MessageHandler<T> = (err: Error | null, payload: T | null) => Promise<void> | void;

// nats-alvamind/src/interfaces/message-options.ts
import { JetStreamPublishOptions } from 'nats';
export type MessageOptions = JetStreamPublishOptions;

// nats-alvamind/src/utils/logger.ts
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};

// nats-alvamind/src/utils/uuid.ts
import { v4 as uuidv4 } from 'uuid';
export const uuid = uuidv4;

// nats-alvamind/src/index.ts
import { ConnectionManager } from './core/connection/connection-manager';
import { ConnectionOptions } from './core/connection/connection-options';
import { MessageBroker } from './services/message-broker';
import { Storage } from './services/storage';
import { MessageBrokerConfig } from './config/message-broker-config';
import { StorageConfig } from './config/storage-config';
import { RetryConfig } from './config/retry-config';
import { StreamOptions } from './core/streams/stream-options';

export class NatsAlvamind {
  private connectionManager: ConnectionManager;
  private messageBroker: MessageBroker;
  private storage: Storage;

  constructor(
    connectionOptions: ConnectionOptions,
    messageBrokerConfig: MessageBrokerConfig,
    storageConfig: StorageConfig,
    retryConfig?: RetryConfig,
  ) {
    this.connectionManager = new ConnectionManager(connectionOptions);
    this.messageBroker = new MessageBroker(this.connectionManager.getConnection() as any, messageBrokerConfig, retryConfig);
    this.storage = new Storage(this.connectionManager.getConnection() as any, storageConfig);
  }
  async connect(): Promise<void> {
    await this.connectionManager.getConnection();
  }
  async createStream(options: StreamOptions): Promise<void> {
    await this.messageBroker.createStream(options);
  }
  async publish<T>(subject: string, payload: T, options?: any): Promise<void> {
    await this.messageBroker.publish(subject, payload, options);
  }
  async subscribe<T>(subject: string, handler: (err: Error | null, payload: T | null) => Promise<void> | void, options?: any) {
    return this.messageBroker.subscribe(subject, handler, options)
  }
  async get<T>(key: string): Promise<T | null> {
    return this.storage.get(key);
  }
  async set<T>(key: string, value: T, options?: any): Promise<void> {
    return this.storage.set(key, value, options);
  }
  async delete(key: string): Promise<void> {
    return this.storage.delete(key);
  }
  async deleteStream(): Promise<void> {
    return this.messageBroker.deleteStream();
  }
  async close(): Promise<void> {
    await this.connectionManager.closeConnection();
  }
}
