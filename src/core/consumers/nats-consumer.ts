// nats-alvamind/src/core/consumers/nats-consumer.ts
import {
  JetStreamClient,
  JetStreamSubscription,
  SubscriptionOptions
} from 'nats';
import { IConsumer } from './i-consumer';
import { ConsumerOptions } from './consumer-options';
import { NatsError } from '../errors/nats-error';
import { IConnection } from '../connection/i-connection';
import { CodecFactory } from '../codecs/codec-factory';
import { MessageHandler } from '../../interfaces/message-handler';
import { logger } from '../../utils/logger';

export class NatsConsumer<T> implements IConsumer {
  private js: JetStreamClient;
  private subscription?: JetStreamSubscription;
  private codec = CodecFactory.create<T>('json');

  constructor(
    private connection: IConnection,
    private subject: string,
    private handler: MessageHandler<T>,
    private options?: ConsumerOptions,
  ) {
    this.js = this.connection.getNatsConnection().jetstream();
  }

  async consume(): Promise<void> {
    try {
      const opts = this.options || {};
      const consumerOptions = Object.assign({
        durable_name: this.subject,
        filter_subject: this.subject
      }, opts);

      this.subscription = await this.js.subscribe(this.subject, consumerOptions as SubscriptionOptions);

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
