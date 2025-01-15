// minimal-kv-test.ts

import { ConnectionOptions } from 'nats';
import { NatsAlvamind } from '../src';
import { logger } from '../src/utils/logger';

const connectionOptions: ConnectionOptions = {
  servers: 'nats://localhost:4222', // Replace with your NATS server URL
};
const messageBrokerConfig = {
  url: 'nats://localhost:4222',
  streamName: 'test-stream',
  subjects: ['test.subject'],
  consumerName: 'test-consumer',
};
const storageConfig = {
  bucketName: 'test-bucket',
};

async function testMinimalKV() {
  const natsAlvamind = new NatsAlvamind(
    connectionOptions,
    messageBrokerConfig,
    storageConfig
  );
  try {
    await natsAlvamind.connect();

    const testKey = 'testKey';
    const testValue = { value: 'Test Value' };

    await natsAlvamind.set(testKey, testValue);
    logger.info('Set test value');
    const retrievedValue = await natsAlvamind.get(testKey);
    if (retrievedValue) {
      logger.info('Retrieved test value:', retrievedValue);
    } else {
      logger.error('Failed to retrieve test value');
    }
    await natsAlvamind.close();
  } catch (err) {
    logger.error('Test Failed', err);
  }
}

testMinimalKV();
