import { NatsConnection, JetStreamClient, JetStreamManager } from 'nats';

export interface IConnection {
  connect(): Promise<void>;
  close(): Promise<void>;
  getNatsConnection(): NatsConnection;
  isConnectedToNats(): boolean;
  jetStream(): JetStreamClient;
  jetStreamManager(): Promise<JetStreamManager>
}
