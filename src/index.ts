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
import { KvEntry } from 'nats';

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

  // Message Broker Operations
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

  // Storage Operations
  async get<T>(key: string): Promise<T | null> {
    return this.ensureConnected('storage').get<T>(key);
  }

  async set<T>(key: string, value: T, options?: any): Promise<void> {
    return this.ensureConnected('storage').set(key, value, options);
  }

  async keys(key?: string): Promise<AsyncIterable<string>> {
    return this.ensureConnected('storage').keys(key);
  }
  async history(key: string, headersOnly?: boolean): Promise<AsyncIterable<KvEntry>> {
    return this.ensureConnected('storage').history(key, headersOnly);
  }

  async watch(key?: string, headersOnly?: boolean, initializedFn?: () => void): Promise<AsyncIterable<KvEntry>> {
    return this.ensureConnected('storage').watch(key, headersOnly, initializedFn);
  }
  async delete(key: string): Promise<void> {
    return this.ensureConnected('storage').delete(key);
  }

  // Cleanup
  async close(): Promise<void> {
    await this.connectionManager.closeConnection();
    this.messageBroker = null;
    this.storage = null;
  }
}
