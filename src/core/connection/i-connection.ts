import { NatsConnection } from 'nats';

export interface IConnection {
  connect(): Promise<void>;
  close(): Promise<void>;
  getNatsConnection(): NatsConnection;
  isConnectedToNats(): boolean;
}