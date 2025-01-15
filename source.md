# Project: nats-alvamind

## 📁 Dir Structure:
- src/config/
  • message-broker-config.ts
  • retry-config.ts
  • storage-config.ts
- src/core/codecs/
  • codec-factory.ts
  • i-codec.ts
  • json-codec.ts
  • string-codec.ts
- src/core/connection/
  • connection-manager.ts
  • connection-options.ts
  • i-connection.ts
  • nats-connection.ts
- src/core/consumers/
  • consumer-options.ts
  • i-consumer.ts
  • nats-consumer.ts
- src/core/errors/
  • nats-error.ts
- src/core/kv/
  • i-kv.ts
  • kv-entry.ts
  • kv-options.ts
  • nats-kv.ts
- src/core/retry/
  • default-retry.ts
  • i-retry.ts
  • retry-options.ts
  • retry-util.ts
- src/core/streams/
  • i-stream.ts
  • nats-stream.ts
  • stream-options.ts
- src/
  • index.ts
- src/interfaces/
  • message-handler.ts
  • message-options.ts
- src/services/
  • index.ts
  • message-broker.ts
  • storage.ts
- src/utils/
  • logger.ts
  • uuid.ts
- test/
  • deepseek.main.ts
  • minimal-kv-test.ts
  • test-nats-connection.ts

- ./
  • docker-compose.yml
  • nats.conf
  • package.json
  • tsconfig.build.json
  • tsconfig.json
## 🚫 Excludes:
- **/node_modules/**
- **/dist/**
- **/.git/**
- **/generate-source.ts
- **/.zed-settings.json
- **/.vscode/settings.json
- **/package-lock.json
- **/bun.lockb
- **/build/**
- source.md
- **/dist/**
- .gitignore
- bun.lockb
- *md
- *.test.ts

## 📁 Dir Structure:
- src/config
- src/core/codecs
- src/core/connection
- src/core/consumers
- src/core/errors
- src/core/kv
- src/core/retry
- src/core/streams
- src
- src/interfaces
- src/services
- src/utils
- test

## 💻 Code:
====================

// docker-compose.yml
services:
  nats:
    image: nats:2.10.24
    ports:
      - '4222:4222'
      - '8222:8222'
    volumes:
      - ./nats.conf:/nats.conf
    command:
      - '-c'
      - '/nats.conf'
    container_name: nats-test
    restart: always

// nats.conf
jetstream {
    store_dir = "/data"
    max_memory_store = 1GB  # Use memory storage for JetStream
}
http_port = 8222  # HTTP monitoring port

// package.json
{
  "name": "nats-alvamind",
  "version": "1.0.1",
  "description": "a powerful and flexible Node.js library designed to simplify interactions with NATS.io, offering seamless integration for message queuing, stream processing, and key-value storage.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "repository": {
    "type": "git",
    "url": "https://github.com/alvamind/nats-alvamind.git"
  },
  "scripts": {
    "format": "prettier --write \"src*.ts\"",
    "lint": "eslint \"src*.ts\" --fix",
    "dev": "bun tsc --watch",
    "compose": "docker compose up -d",
    "commit": "commit",
    "reinstall": "bun clean && bun install",
    "build": "tsc -p tsconfig.build.json",
    "source": "generate-source --exclude=**/dist*"
  ],
  "peerDependencies": {
    "typescript": "^5.0.0"
  }
}

// src/config/message-broker-config.ts
export interface MessageBrokerConfig {
  url: string;
  streamName: string;
  subjects: string[];
  consumerName: string;
}

// src/config/retry-config.ts
import { RetryOptions } from '../core/retry/retry-options';
export type RetryConfig = RetryOptions

// src/config/storage-config.ts
export interface StorageConfig {
  bucketName: string;
}

// src/core/codecs/codec-factory.ts
import { ICodec } from './i-codec';
import { JsonCodec } from './json-codec';
import { StringCodec } from './string-codec';
export class CodecFactory {
  static create<T>(type: 'json' | 'string'): ICodec<T> {
    switch (type) {
      case 'json':
        return new JsonCodec<T>();
      case 'string':
        return new StringCodec() as ICodec<any>;
      default:
        throw new Error(`Unsupported codec type: ${type}`);
    }
  }
}

// src/core/codecs/i-codec.ts
export interface ICodec<T> {
  encode(data: T): Uint8Array;
  decode(data: Uint8Array): T;
}

// src/core/codecs/json-codec.ts
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

// src/core/codecs/string-codec.ts
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

// src/core/connection/connection-manager.ts
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

// src/core/connection/connection-options.ts
import { ConnectionOptions as NatsOptions } from 'nats'
export type ConnectionOptions = NatsOptions;

// src/core/connection/i-connection.ts
import { NatsConnection, JetStreamClient, JetStreamManager } from 'nats';
export interface IConnection {
  connect(): Promise<void>;
  close(): Promise<void>;
  getNatsConnection(): NatsConnection;
  isConnectedToNats(): boolean;
  jetStream(): JetStreamClient;
  jetStreamManager(): Promise<JetStreamManager>
}

// src/core/connection/nats-connection.ts
import { connect, NatsConnection, JetStreamClient, JetStreamManager } from 'nats';
import { IConnection } from './i-connection';
import { ConnectionOptions } from './connection-options';
import { NatsError } from '../errors/nats-error';
import { logger } from '../../utils/logger';
export class NatsConnectionImpl implements IConnection {
  private connection: NatsConnection | null = null;
  private isConnected = false;
  constructor(private options: ConnectionOptions) { }
  async connect(): Promise<void> {
    const maxAttempts = 5;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        logger.info('Attempting to connect to NATS server with options:', this.options);
        this.connection = await connect({
          ...this.options,
          timeout: 5000,
        });
        this.isConnected = true;
        logger.info('Connected to NATS server');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
      } catch (error: any) {
        attempt++;
        logger.error(`Failed to connect to NATS (attempt ${attempt}):`, error);
        if (attempt >= maxAttempts) {
          throw new NatsError(`Failed to connect to NATS after ${maxAttempts} attempts: ${error.message}`, 'CONNECTION_ERROR', error);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw new NatsError(`Failed to connect to NATS after ${maxAttempts} attempts`, 'CONNECTION_ERROR');
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
  jetStream(): JetStreamClient {
    if (!this.connection) {
      throw new NatsError('NATS connection is not established', 'CONNECTION_ERROR');
    }
    return this.connection.jetstream();
  }
  async jetStreamManager(): Promise<JetStreamManager> {
    if (!this.connection) {
      throw new NatsError('NATS connection is not established', 'CONNECTION_ERROR');
    }
    return this.connection.jetstreamManager();
  }
}

// src/core/consumers/consumer-options.ts
import { ConsumerOpts } from 'nats';
export type ConsumerOptions = ConsumerOpts;

// src/core/consumers/i-consumer.ts
export interface IConsumer {
  consume(): Promise<void>;
  stop(): Promise<void>;
}

// src/core/consumers/nats-consumer.ts
import {
  JetStreamClient,
  JetStreamSubscription,
  ConsumerConfig,
  AckPolicy,
  DeliverPolicy,
  ReplayPolicy,
  ConsumerOpts,
} from 'nats';
import { IConsumer } from './i-consumer';
import { NatsError } from '../errors/nats-error';
import { IConnection } from '../connection/i-connection';
import { CodecFactory } from '../codecs/codec-factory';
import { MessageHandler } from '../../interfaces/message-handler';
import { logger } from '../../utils/logger';
import { uuid } from '../../utils/uuid';
export class NatsConsumer<T> implements IConsumer {
  private js: JetStreamClient;
  private subscription?: JetStreamSubscription;
  private codec = CodecFactory.create<T>('json');
  private consumerConfig: ConsumerOpts;
  constructor(
    private connection: IConnection,
    private subject: string,
    private handler: MessageHandler<T>,
    options?: ConsumerConfig, // Use ConsumerConfig
  ) {
    this.js = this.connection.getNatsConnection().jetstream();
    const deliverSubject = `deliver.${this.subject}.${uuid()}`;
    this.consumerConfig = {
      config: {
        durable_name: this.subject,
        filter_subject: this.subject,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        replay_policy: ReplayPolicy.Instant,
        ack_wait: 30_000,
        max_deliver: 3,
        max_ack_pending: 1000,
        idle_heartbeat: 5000,
        deliver_subject: deliverSubject,
        ...options, // Merge any provided options
      }
    } as ConsumerOpts
  }
  async consume(): Promise<void> {
    try {
      this.subscription = await this.js.subscribe(this.subject, {
        ...this.consumerConfig,
      });
      (async () => {
        if (this.subscription) {
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
        }
      })().catch((error: any) => this.handler(error as Error, null));
      logger.info(`Subscribed to ${this.subject}`);
    } catch (error: any) {
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

// src/core/errors/nats-error.ts
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

// src/core/kv/i-kv.ts
export interface IKV<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, options?: Record<string, any>): Promise<void>;
  delete(key: string): Promise<void>;
}

// src/core/kv/kv-entry.ts
export interface KVEntry<T> {
  key: string;
  value: T;
  created: Date;
  modified: Date;
}

// src/core/kv/kv-options.ts
export interface KVOptions {
  bucketName: string;
}

// src/core/kv/nats-kv.ts
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

// src/core/retry/default-retry.ts
import { NatsError } from "nats";
import { IRetry } from "./i-retry";
import { RetryOptions } from "./retry-options";
export class DefaultRetry implements IRetry {
  async withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}, onRetry?: (attempt: number, error: Error) => void): Promise<T> {
    const { attempts = 3, delay = 100, factor = 2, maxDelay = 3000 } = options;
    let currentAttempt = 0;
    let currentDelay = delay;
    while (currentAttempt < attempts) {
      try {
        return await operation();
      } catch (error: any) {
        currentAttempt++;
        if (currentAttempt >= attempts) {
          throw new NatsError(`Operation failed after ${attempts} retries: ${error.message}`, 'RETRY_ERROR', error);
        }
        if (onRetry) {
          onRetry(currentAttempt, error);
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

// src/core/retry/i-retry.ts
import { RetryOptions } from './retry-options';
export interface IRetry {
  withRetry<T>(operation: () => Promise<T>, options?: RetryOptions, onRetry?: (attempt: number, error: Error) => void): Promise<T>;
}

// src/core/retry/retry-options.ts
export interface RetryOptions {
  attempts?: number;
  delay?: number;
  factor?: number;
  maxDelay?: number;
}

// src/core/retry/retry-util.ts
import { RetryOptions } from './retry-options';
import { DefaultRetry } from './default-retry';
export class RetryUtil {
  static withRetry<T>(operation: () => Promise<T>, options?: RetryOptions, onRetry?: (attempt: number, error: Error) => void): Promise<T> {
    const retry = new DefaultRetry()
    return retry.withRetry(operation, options, onRetry);
  }
}

// src/core/streams/i-stream.ts
import { StreamInfo, JetStreamPublishOptions } from 'nats';
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

// src/core/streams/nats-stream.ts
import {
  JetStreamManager,
  JetStreamClient,
  StreamInfo,
  StreamConfig,
  JetStreamPublishOptions,
  AckPolicy,
  DeliverPolicy,
  ReplayPolicy,
  ConsumerConfig
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
  private jsm!: JetStreamManager;
  private js: JetStreamClient;
  private streamInfo: StreamInfo | null = null;
  private codec = CodecFactory.create<any>('json');
  constructor(
    private connection: IConnection,
    private options: StreamOptions
  ) {
    if (!options.name || options.name.trim() === '') {
      throw new NatsError(`Stream name cannot be empty`, 'STREAM_ERROR');
    }
    this.js = this.connection.getNatsConnection().jetstream();
  }
  async init(): Promise<void> {
    try {
      this.jsm = await this.connection.getNatsConnection().jetstreamManager();
      const streamExists = await this.jsm.streams.info(this.options.name)
        .catch(() => false);
      if (!streamExists) {
        await this.jsm.streams.add(this.options as StreamConfig);
        logger.info(`Stream ${this.options.name} created`);
      }
      this.streamInfo = await this.jsm.streams.info(this.options.name);
    } catch (error: any) {
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
    } catch (error: any) {
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
    const defaultOptions: ConsumerConfig = {
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant
    };
    const consumerOptions: ConsumerConfig = {
      ...defaultOptions,
      ...options,
    };
    const consumer = new NatsConsumer<T>(this.connection, subject, handler, consumerOptions);
    await consumer.consume();
    return consumer;
  }
  async delete(): Promise<void> {
    try {
      await this.jsm.streams.delete(this.options.name);
      logger.info(`Stream ${this.options.name} deleted.`);
    } catch (error: any) {
      logger.error(`Failed to delete stream ${this.options.name}`, error);
      throw new NatsError(`Failed to delete stream: ${error.message}`, 'STREAM_ERROR');
    }
  }
}

// src/core/streams/stream-options.ts
import { StreamConfig } from 'nats';
export type StreamOptions = StreamConfig;

// src/index.ts
import { ConnectionManager } from './core/connection/connection-manager';
import { ConnectionOptions } from './core/connection/connection-options';
import { MessageBroker } from './services/message-broker';
import { Storage } from './services/storage';
import { MessageBrokerConfig } from './config/message-broker-config';
import { StorageConfig } from './config/storage-config';
import { RetryConfig } from './config/retry-config';
import { StreamOptions } from './core/streams/stream-options';
import { MessageHandler } from './interfaces/message-handler';
import { IConsumer } from './core/consumers/i-consumer';
type ServiceType = {
  messageBroker: MessageBroker;
  storage: Storage;
};
export class NatsAlvamind {
  private connectionManager: ConnectionManager;
  private messageBroker: MessageBroker | null = null;
  private storage: Storage | null = null;
  constructor(
    connectionOptions: ConnectionOptions,
    private messageBrokerConfig: MessageBrokerConfig,
    private storageConfig: StorageConfig,
    private retryConfig?: RetryConfig,
  ) {
    this.connectionManager = new ConnectionManager(connectionOptions);
  }
  private ensureConnected<T extends keyof ServiceType>(
    service: T
  ): ServiceType[T] {
    const services: Record<keyof ServiceType, MessageBroker | Storage | null> = {
      messageBroker: this.messageBroker,
      storage: this.storage
    };
    const serviceInstance = services[service];
    if (!serviceInstance) {
      throw new Error(`${service} not connected. Call connect() first`);
    }
    return serviceInstance as ServiceType[T];
  }
  async connect(): Promise<void> {
    const connection = await this.connectionManager.getConnection();
    this.messageBroker = new MessageBroker(connection, this.messageBrokerConfig, this.retryConfig);
    this.storage = new Storage(connection, this.storageConfig);
  }
  async createStream(options: StreamOptions): Promise<void> {
    await this.ensureConnected('messageBroker').createStream(options);
  }
  async publish<T>(subject: string, payload: T, options?: any): Promise<void> {
    return this.ensureConnected('messageBroker').publish(subject, payload, options);
  }
  async subscribe<T>(
    subject: string,
    handler: MessageHandler<T>,
    options?: any
  ): Promise<IConsumer> {
    return this.ensureConnected('messageBroker').subscribe(subject, handler, options);
  }
  async deleteStream(): Promise<void> {
    return this.ensureConnected('messageBroker').deleteStream();
  }
  async get<T>(key: string): Promise<T | null> {
    return this.ensureConnected('storage').get<T>(key);
  }
  async set<T>(key: string, value: T, options?: any): Promise<void> {
    return this.ensureConnected('storage').set(key, value, options);
  }
  async delete(key: string): Promise<void> {
    return this.ensureConnected('storage').delete(key);
  }
  async close(): Promise<void> {
    await this.connectionManager.closeConnection();
    this.messageBroker = null;
    this.storage = null;
  }
}

// src/interfaces/message-handler.ts
export type MessageHandler<T> = (err: Error | null, payload: T | null) => Promise<void> | void;

// src/interfaces/message-options.ts
import { JetStreamPublishOptions } from 'nats';
export type MessageOptions = JetStreamPublishOptions;

// src/services/index.ts
export { MessageBroker } from './message-broker';
export { Storage } from './storage';

// src/services/message-broker.ts
import { IConnection } from '../core/connection/i-connection';
import { IStream } from '../core/streams/i-stream';
import { NatsStream } from '../core/streams/nats-stream';
import { StreamOptions } from '../core/streams/stream-options';
import { IConsumer } from '../core/consumers/i-consumer';
import { ConsumerOptions } from '../core/consumers/consumer-options';
import { RetryUtil } from '../core/retry/retry-util';
import { MessageBrokerConfig } from '../config/message-broker-config';
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

// src/services/storage.ts
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
}

// src/utils/logger.ts
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

// src/utils/uuid.ts
import { v4 as uuidv4 } from 'uuid';
export const uuid = uuidv4;

// test/deepseek.main.ts
import { ConnectionOptions, RetentionPolicy, StorageType, DiscardPolicy, AckPolicy, DeliverPolicy, ReplayPolicy, nanos } from "nats";
import { NatsAlvamind } from "../src";
import { MessageBrokerConfig } from "../src/config/message-broker-config";
import { StorageConfig } from "../src/config/storage-config";
import { StreamOptions } from "../src/core/streams/stream-options";
import { MessageHandler } from "../src/interfaces/message-handler";
import { ConsumerConfig } from "nats";
import logger from "logger-alvamind";
const connectionOptions: ConnectionOptions = {
  servers: 'nats://localhost:4222', // Replace with your NATS server URL
};
const messageBrokerConfig: MessageBrokerConfig = {
  url: 'nats://localhost:4222',
  streamName: 'test-stream',
  subjects: ['test.subject'],
  consumerName: 'test-consumer',
};
const storageConfig: StorageConfig = {
  bucketName: 'test-bucket',
};
const natsAlvamind = new NatsAlvamind(
  connectionOptions,
  messageBrokerConfig,
  storageConfig
);
async function testNatsAlvamind() {
  try {
    await natsAlvamind.connect();
    logger.info('Connected to NATS');
    const streamOptions: StreamOptions = {
      name: 'test-stream',
      subjects: ['test.subject'],
      retention: RetentionPolicy.Limits,
      storage: StorageType.File,
      max_consumers: -1,
      max_msgs: 10000,
      max_bytes: 1024 * 1024 * 10,
      max_age: nanos(60 * 60 * 24 * 7), // 7 days
      max_msg_size: 1024 * 1024,
      discard: DiscardPolicy.Old,
      num_replicas: 1,
      duplicate_window: nanos(2 * 60 * 60), // 2 hours
      sealed: false,
      first_seq: 1,
      max_msgs_per_subject: -1,
      discard_new_per_subject: false,
      allow_rollup_hdrs: false,
      deny_delete: false,
      deny_purge: false,
      allow_direct: false,
      mirror_direct: false,
    };
    await natsAlvamind.createStream(streamOptions);
    logger.info('Stream created');
    await natsAlvamind.publish('test.subject', { key: 'value' });
    logger.info('Message published');
    const handler: MessageHandler<any> = async (err, payload) => {
      if (err) {
        logger.error('Error in message handler:', err.message);
        return;
      }
      logger.info('Received message:', JSON.stringify(payload));
    };
    const consumerOptions: ConsumerConfig = {
      durable_name: "test-consumer",
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      ack_wait: nanos(30 * 1000),
      max_deliver: 5,
      filter_subject: "test.subject",
      max_ack_pending: 100,
      idle_heartbeat: nanos(5000),
      replay_policy: ReplayPolicy.Instant,
    };
    await natsAlvamind.subscribe('test.subject', handler, consumerOptions);
    logger.info('Subscribed to messages');
    await natsAlvamind.set('test-key', { data: 'test-value' });
    logger.info('Value set in KV store');
    const value = await natsAlvamind.get('test-key');
    logger.info('Value retrieved from KV store:', JSON.stringify(value));
    await natsAlvamind.delete('test-key');
    logger.info('Value deleted from KV store');
    await natsAlvamind.deleteStream();
    logger.info('Stream deleted');
    await natsAlvamind.close();
    logger.info('Connection closed');
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error during test:', error.message);
    } else {
      logger.error('Error during test:', String(error));
    }
  }
}
testNatsAlvamind();

// test/minimal-kv-test.ts
import { ConnectionOptions } from 'nats';
import { NatsAlvamind } from '../src';
import { logger } from '../src/utils/logger';
const connectionOptions: ConnectionOptions = {
  servers: 'nats://localhost:4222', // Replace with your NATS server URL
};
const messageBrokerConfig = {
  url: 'nats://localhost:4222',
  streamName: 'test-stream',
  subjects: ['test.subject'],
  consumerName: 'test-consumer',
};
const storageConfig = {
  bucketName: 'test-bucket',
};
async function testMinimalKV() {
  const natsAlvamind = new NatsAlvamind(
    connectionOptions,
    messageBrokerConfig,
    storageConfig
  );
  try {
    await natsAlvamind.connect();
    const testKey = 'testKey';
    const testValue = { value: 'Test Value' };
    await natsAlvamind.set(testKey, testValue);
    logger.info('Set test value');
    const retrievedValue = await natsAlvamind.get(testKey);
    if (retrievedValue) {
      logger.info('Retrieved test value:', retrievedValue);
    } else {
      logger.error('Failed to retrieve test value');
    }
    await natsAlvamind.close();
  } catch (err) {
    logger.error('Test Failed', err);
  }
}
testMinimalKV();

// test/test-nats-connection.ts
import { connect } from 'nats';
async function testNatsConnection() {
  try {
    const nc = await connect({ servers: ['nats://localhost:4222'] }); // Changed from nats-test to localhost
    console.log('Connected to NATS server');
    await nc.close();
  } catch (err) {
    console.error('Failed to connect to NATS server:', err);
  }
}
testNatsConnection();

// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true,
    "module": "CommonJS",
    "target": "ES2019",
    "moduleResolution": "node",
    "allowImportingTsExtensions": false,
    "esModuleInterop": true
  },
  "include": ["src*"],
  "exclude": ["test", "dist", "node_modules"]
}

// tsconfig.json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": false,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noPropertyAccessFromIndexSignature": true,
    "noEmit": true
  }
}

