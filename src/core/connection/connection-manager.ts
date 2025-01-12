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