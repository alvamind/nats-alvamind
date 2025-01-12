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
        // Wait for connection to be fully established
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
