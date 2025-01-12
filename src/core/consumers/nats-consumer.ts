// nats-alvamind/src/core/consumers/nats-consumer.ts
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
