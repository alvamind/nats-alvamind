// nats-alvamind/src/core/streams/i-stream.ts
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
