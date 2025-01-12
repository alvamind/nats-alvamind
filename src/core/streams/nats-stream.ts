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
  private jsm!: JetStreamManager;
  private js: JetStreamClient;
  private streamInfo: StreamInfo | null = null;
  private codec = CodecFactory.create<any>('json');

  constructor(
    private connection: IConnection,
    private options: StreamOptions
  ) {
    this.js = this.connection.getNatsConnection().jetstream();
  }

  async init(): Promise<void> {
    try {
      // Initialize JetStreamManager
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
    const consumer = new NatsConsumer<T>(this.connection, subject, handler, options);
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
