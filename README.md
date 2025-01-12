# 🚀 nats-alvamind: Your All-in-One NATS Toolkit 🧠

[![npm version](https://badge.fury.io/js/nats-alvamind.svg)](https://badge.fury.io/js/nats-alvamind)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/nats-alvamind/nats-alvamind/graphs/commit-activity)

**Welcome to `nats-alvamind`, a powerful and flexible Node.js library designed to simplify interactions with NATS.io, offering seamless integration for message queuing, stream processing, and key-value storage.**

## ✨ Features & Benefits

`nats-alvamind` is built to provide a robust and developer-friendly experience. Here's what it offers:

*   **Simplified NATS Connection:** Manages NATS connections with automatic reconnection logic and connection pooling. 🔗
*   **JetStream Integration:** Easily create and manage JetStream streams, publish messages, and subscribe with configurable consumer options. 🌊
*   **Key-Value (KV) Storage:** Interact with NATS KV store for configuration, state management, or caching directly. 🗄️
*   **Flexible Codecs:** Supports JSON and String codecs for encoding and decoding messages. ⚙️
*   **Built-in Retry Mechanism:** Robust retry logic with exponential backoff for message publishing and other operations. 🔄
*   **Error Handling:** Centralized and informative error handling for NATS operations. 🚨
*   **TypeScript Support:** Fully typed codebase for type safety and improved developer experience. ✅
*   **Configurable Logging:**  Utilizes a simple logging utility for monitoring operations. 🪵
*   **Modular Design:** Designed for modularity and extensibility, making it easy to integrate into your project. 🧩
*   **Promise-Based API:**  Asynchronous operations using Promises for better control and readability. ⏱️

## 📦 Installation

Install `nats-alvamind` using npm:

```bash
npm install nats-alvamind
```

Or with yarn:

```bash
yarn add nats-alvamind
```

## ⚙️ Configuration

`nats-alvamind` uses configuration objects to manage your NATS connections and services:

### Connection Options

You need to provide NATS connection options, which are similar to the options from the official `nats` library:

```typescript
import { ConnectionOptions } from 'nats';

const connectionOptions: ConnectionOptions = {
  servers: 'nats://localhost:4222', // Replace with your NATS server URL
  // Add other NATS options here if needed.
};
```

### Message Broker Configuration

This configuration sets up your message broker's stream and consumer settings:

```typescript
import { MessageBrokerConfig } from 'nats-alvamind';

const messageBrokerConfig: MessageBrokerConfig = {
  url: 'nats://localhost:4222',
  streamName: 'my-stream',
  subjects: ['my.subject'],
  consumerName: 'my-consumer',
};
```

### Storage Configuration

This configures your key-value storage settings:

```typescript
import { StorageConfig } from 'nats-alvamind';

const storageConfig: StorageConfig = {
  bucketName: 'my-bucket',
};
```

### Retry Configuration

Optionally you can configure the retry settings

```typescript
import { RetryConfig } from 'nats-alvamind';
const retryConfig: RetryConfig = {
  attempts: 5,
  delay: 200,
  factor: 2,
  maxDelay: 5000
}
```

## 📝 Usage Examples

### Initializing NatsAlvamind

Here’s how to create an instance of `NatsAlvamind`, connecting to NATS and using both MessageBroker and Storage:

```typescript
import { ConnectionOptions, RetentionPolicy, StorageType, DiscardPolicy, AckPolicy, DeliverPolicy, ReplayPolicy, nanos, ConsumerConfig } from "nats";
import { NatsAlvamind } from "nats-alvamind";
import { MessageBrokerConfig } from "nats-alvamind/src/config/message-broker-config";
import { StorageConfig } from "nats-alvamind/src/config/storage-config";
import { StreamOptions } from "nats-alvamind/src/core/streams/stream-options";
import { MessageHandler } from "nats-alvamind/src/interfaces/message-handler";
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
```

### Publishing Messages

```typescript
 await natsAlvamind.publish('my.subject', { message: 'hello nats!' });
```

### Subscribing to Messages

```typescript
const handler: MessageHandler<{ message: string }> = async (err, payload) => {
  if (err) {
    console.error('Error in message handler:', err.message);
    return;
  }
  console.log('Received message:', payload);
};

const subscription = await natsAlvamind.subscribe('my.subject', handler);
```

### Using Key-Value Store

```typescript
await natsAlvamind.set('my-key', { data: 'my-value' });
const value = await natsAlvamind.get<{ data: string }>('my-key');
console.log('Value:', value);
await natsAlvamind.delete('my-key');
```

### Creating a Stream

```typescript
import { RetentionPolicy, StorageType, DiscardPolicy, nanos } from 'nats';
const streamOptions = {
  name: 'my-stream',
  subjects: ['my.subject'],
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
}

await natsAlvamind.createStream(streamOptions);
```

## 🛣️ Roadmap

Here's a glimpse into the future of `nats-alvamind`:

*   **Enhanced Monitoring:**  Integration with metrics and monitoring tools. 📈
*   **Advanced Consumer Options:**  More control over consumer configurations. ⚙️
*   **Message Transformation:**  Adding middleware capabilities for message processing. 🛠️
*   **Schema Validation:** Integration with schema validators like JSON schema. 🗂️
*   **Clustering Support:** Improve support for NATS clustered environments. 🏘️
*   **More Codecs:**  Support for more codecs like Protobuf, Avro etc. 🧬
*   **Documentation Improvement:**  More examples and detailed API documentation. 📚

## 🙌 Contributing

We welcome contributions to `nats-alvamind`! Whether it’s bug fixes, feature enhancements, or documentation updates, your contributions are valuable. Here’s how you can help:

1.  **Fork the repository.**
2.  **Create a new branch:** `git checkout -b feature/your-feature`.
3.  **Make your changes.**
4.  **Commit your changes:** `git commit -am 'Add some feature'`.
5.  **Push to the branch:** `git push origin feature/your-feature`.
6.  **Open a pull request.**

Please adhere to the existing coding style, and ensure that all tests pass.

## 💖 Donations

If you find `nats-alvamind` useful and would like to support its development, you can make a donation:

*   [Buy me a Coffee](https://www.buymeacoffee.com/yourusername) ☕
*   [Patreon](https://www.patreon.com/yourusername) 🌟

Your support will help keep the library active and vibrant!

## ⚠️ Disclaimer

`nats-alvamind` is provided "as is", without warranty of any kind, express or implied. The authors are not responsible for any damages or loss of data arising from the use of this software. Please use responsibly. Always test your application thoroughly in a non-production environment before deploying to production.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Thank you for using `nats-alvamind`! We hope it simplifies your NATS development journey. Happy coding!** 🚀
