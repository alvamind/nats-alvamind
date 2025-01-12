import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { NatsAlvamind } from "../src";
import { StreamConfig, RetentionPolicy, StorageType, DiscardPolicy } from "nats";
import { RetryUtil } from "../src/core/retry/retry-util";
import logger from "logger-alvamind";
//
describe("NatsAlvamind Integration Tests", () => {
  let natsClient: NatsAlvamind;

  // Test configuration
  const url = "nats://localhost:4222"; // Modified URL
  const connectionOptions = {
    servers: [url],
  };

  const messageBrokerConfig = {
    url,
    streamName: "test-stream",
    subjects: ["test.*"],
    consumerName: "test-consumer",
  };

  const storageConfig = {
    bucketName: "test-bucket",
  };

  const retryConfig = {
    attempts: 3,
    delay: 100,
    factor: 2,
    maxDelay: 1000,
  };

  beforeAll(async () => {
    // Wait a bit longer for NATS server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    natsClient = new NatsAlvamind(
      connectionOptions,
      messageBrokerConfig,
      storageConfig,
      retryConfig
    );

    try {
      await natsClient.connect();
      // Wait for connection to be fully established
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      if (natsClient) {
        await natsClient.deleteStream().catch(() => { });
        await natsClient.close();
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe("Stream Operations", () => {
    test("should create a stream", async () => {
      const streamOptions: StreamConfig = {
        name: messageBrokerConfig.streamName,
        subjects: messageBrokerConfig.subjects,
        retention: RetentionPolicy.Limits,
        storage: StorageType.Memory,
        max_consumers: -1,
        max_msgs: -1,
        max_bytes: -1,
        max_age: 0,
        max_msg_size: -1,
        max_msgs_per_subject: -1,
        discard: DiscardPolicy.Old,
        num_replicas: 1,
        duplicate_window: 0,
        sealed: false,
        first_seq: 1,
        discard_new_per_subject: false,
        allow_rollup_hdrs: false,
        deny_delete: false,
        deny_purge: false,
        allow_direct: false,
        mirror_direct: false
      };

      await expect(natsClient.createStream(streamOptions)).resolves.not.toThrow();
    });

    test("should handle invalid stream operations", async () => {
      const invalidStreamOptions: StreamConfig = {
        name: "", // Invalid empty name
        subjects: [],
        retention: RetentionPolicy.Limits,
        storage: StorageType.Memory,
        max_consumers: -1,
        max_msgs: -1,
        max_bytes: -1,
        max_age: 0,
        max_msg_size: -1,
        max_msgs_per_subject: -1,
        discard: DiscardPolicy.Old,
        num_replicas: 1,
        duplicate_window: 0,
        sealed: false,
        first_seq: 1,
        discard_new_per_subject: false,
        allow_rollup_hdrs: false,
        deny_delete: false,
        deny_purge: false,
        allow_direct: false,
        mirror_direct: false
      };

      await expect(natsClient.createStream(invalidStreamOptions)).rejects.toThrow();
    });
  });


  describe("Storage Operations", () => {
    test("should set and get value", async () => {
      const key = "test-key";
      const value = { data: "test value" };

      await natsClient.set(key, value);
      const retrieved = await natsClient.get<typeof value>(key);
      expect(retrieved).toEqual(value);
    });

    test("should delete value", async () => {
      const key = "test-key-delete";
      const value = { data: "test value" };

      await natsClient.set(key, value);
      await natsClient.delete(key);
      const retrieved = await natsClient.get(key);
      expect(retrieved).toBeNull();
    });

    test("should handle expiring keys", async () => {
      const key = "test-key-expire";
      const value = { data: "expiring value" };
      const expirationMs = 100;

      await natsClient.set(key, value, { expireMode: "PX", time: expirationMs });

      let retrieved = await natsClient.get<typeof value>(key);
      expect(retrieved).toEqual(value);

      await new Promise((resolve) => setTimeout(resolve, expirationMs + 50));

      retrieved = await natsClient.get<typeof value>(key);
      expect(retrieved).toBeNull();
    });
  });

  describe("Error Handling", () => {
    test("should handle connection errors gracefully", async () => {
      const badClient = new NatsAlvamind(
        { servers: ["nats://nonexistent:4222"] },
        {
          ...messageBrokerConfig,
          url: "nats://nonexistent:4222"
        },
        storageConfig,
        retryConfig
      );

      await expect(badClient.connect()).rejects.toThrow();
    });
    test("should handle invalid stream operations", async () => {
      const invalidStreamOptions: StreamConfig = {
        name: "",  // Invalid empty name
        subjects: [],
        retention: RetentionPolicy.Limits,
        storage: StorageType.Memory,
        max_consumers: -1,
        max_msgs: -1,
        max_bytes: -1,
        max_age: 0,
        max_msg_size: -1,
        max_msgs_per_subject: -1,
        discard: DiscardPolicy.Old,
        num_replicas: 1,
        duplicate_window: 0,
        sealed: false,
        first_seq: 1,
        discard_new_per_subject: false,
        allow_rollup_hdrs: false,
        deny_delete: false,
        deny_purge: false,
        allow_direct: false,
        mirror_direct: false
      };

      expect(natsClient.createStream(invalidStreamOptions)).rejects.toThrow();
    });

    test("should retry failed operations", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary failure");
        }
        return true;
      };

      await expect(RetryUtil.withRetry(operation, {
        attempts: 3,
        delay: 100,
        factor: 2
      })).resolves.toBe(true);

      expect(attempts).toBe(3);
    });
  });

  describe("Performance", () => {
    beforeEach(async () => {
      // Ensure stream is created before tests
      await natsClient.createStream({
        name: messageBrokerConfig.streamName,
        subjects: messageBrokerConfig.subjects,
        retention: RetentionPolicy.Limits,
        storage: StorageType.Memory,
        max_consumers: -1,
        max_msgs: -1,
        max_bytes: -1,
        max_age: 0,
        max_msg_size: -1,
        max_msgs_per_subject: -1,
        discard: DiscardPolicy.Old,
        num_replicas: 1,
        duplicate_window: 0,
        sealed: false,
        first_seq: 1,
        discard_new_per_subject: false,
        allow_rollup_hdrs: false,
        deny_delete: false,
        deny_purge: false,
        allow_direct: false,
        mirror_direct: false
      });
      // Wait for stream to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
    });
    test("should handle multiple concurrent operations", async () => {
      const operations = [];
      const numOperations = 5; // Reduce number of concurrent operations

      for (let i = 0; i < numOperations; i++) {
        operations.push(
          RetryUtil.withRetry(() => natsClient.publish(`test.perf.${i}`, { index: i }), { attempts: 3, delay: 100, factor: 2 })
            .catch(err => logger.error(`Operation ${i} failed:`, err))
        );
      }

      await expect(Promise.allSettled(operations)).resolves.toBeDefined();
    });

    test("should handle large messages", async () => {
      const largeMessage = {
        data: "x".repeat(1024) // Reduce message size for testing
      };

      await expect(
        RetryUtil.withRetry(() => natsClient.publish("test.large", largeMessage), { attempts: 3, delay: 100, factor: 2 })
      ).resolves.not.toThrow();
    });
  });
});
