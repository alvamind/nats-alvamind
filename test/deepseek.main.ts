import { ConnectionOptions, RetentionPolicy, StorageType, DiscardPolicy, AckPolicy, DeliverPolicy, ReplayPolicy, nanos } from "nats";
import { NatsAlvamind } from "../src";
import { MessageBrokerConfig } from "../src/config/message-broker-config";
import { StorageConfig } from "../src/config/storage-config";
import { StreamOptions } from "../src/core/streams/stream-options";
import { MessageHandler } from "../src/interfaces/message-handler";
import { ConsumerConfig } from "nats";
import logger from "logger-alvamind";

// NATS connection options
const connectionOptions: ConnectionOptions = {
  servers: 'nats://localhost:4222', // Replace with your NATS server URL
};

// Message Broker configuration
const messageBrokerConfig: MessageBrokerConfig = {
  url: 'nats://localhost:4222',
  streamName: 'test-stream',
  subjects: ['test.subject'],
  consumerName: 'test-consumer',
};

// Storage configuration
const storageConfig: StorageConfig = {
  bucketName: 'test-bucket',
};

// Create an instance of NatsAlvamind
const natsAlvamind = new NatsAlvamind(
  connectionOptions,
  messageBrokerConfig,
  storageConfig
);

// Test basic functionalities
async function testNatsAlvamind() {
  try {
    // Connect to NATS
    await natsAlvamind.connect();
    logger.info('Connected to NATS');

    // Create a stream with required properties
    const streamOptions: StreamOptions = {
      name: 'test-stream',
      subjects: ['test.subject'],
      retention: RetentionPolicy.Limits,
      storage: StorageType.File,
      max_consumers: -1,
      max_msgs: 10000,
      max_bytes: 1024 * 1024 * 10,
      max_age: nanos(60 * 60 * 24 * 7), // 7 days
      max_msg_size: 1024 * 1024,
      discard: DiscardPolicy.Old,
      num_replicas: 1,
      duplicate_window: nanos(2 * 60 * 60), // 2 hours
      sealed: false,
      first_seq: 1,
      max_msgs_per_subject: -1,
      discard_new_per_subject: false,
      allow_rollup_hdrs: false,
      deny_delete: false,
      deny_purge: false,
      allow_direct: false,
      mirror_direct: false,
    };
    await natsAlvamind.createStream(streamOptions);
    logger.info('Stream created');

    // Publish a message
    await natsAlvamind.publish('test.subject', { key: 'value' });
    logger.info('Message published');

    // Subscribe to messages
    const handler: MessageHandler<any> = async (err, payload) => {
      if (err) {
        logger.error('Error in message handler:', err.message);
        return;
      }
      logger.info('Received message:', JSON.stringify(payload));
    };

    const consumerOptions: ConsumerConfig = {
      durable_name: "test-consumer",
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      ack_wait: nanos(30 * 1000),
      max_deliver: 5,
      filter_subject: "test.subject",
      max_ack_pending: 100,
      idle_heartbeat: nanos(5000),
      replay_policy: ReplayPolicy.Instant,
    };

    await natsAlvamind.subscribe('test.subject', handler, consumerOptions);
    logger.info('Subscribed to messages');

    // Test KV store
    await natsAlvamind.set('test-key', { data: 'test-value' });
    logger.info('Value set in KV store');

    const value = await natsAlvamind.get('test-key');
    logger.info('Value retrieved from KV store:', JSON.stringify(value));

    await natsAlvamind.delete('test-key');
    logger.info('Value deleted from KV store');

    // Cleanup
    await natsAlvamind.deleteStream();
    logger.info('Stream deleted');

    await natsAlvamind.close();
    logger.info('Connection closed');
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error during test:', error.message);
    } else {
      logger.error('Error during test:', String(error));
    }
  }
}

// Run the test
testNatsAlvamind();
