// nats-alvamind/src/services/message-broker.ts
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
