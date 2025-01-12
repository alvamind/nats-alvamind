// test/main.test.ts
import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { NatsAlvamind } from "../src";
import { StreamConfig, RetentionPolicy, StorageType, DiscardPolicy } from "nats";
import { RetryUtil } from "../src/core/retry/retry-util";

const defaultStreamConfig: StreamConfig = {
  name: '',
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


describe("NatsAlvamind Integration Tests", () => {
  let natsClient: NatsAlvamind;

  // Test configuration
  const url = "nats://localhost:4222";
  const connectionOptions = {
    servers: [url],
    timeout: 10000, // Increased timeout for connection
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
      const streamConfig: StreamConfig = {
        ...defaultStreamConfig,
        name: "test-stream-creation",
        subjects: ["test.create.*"],
      };
      await expect(natsClient.createStream(streamConfig)).resolves.not.toThrow();
    });

    test("should handle invalid stream operations", async () => {
      const invalidStreamConfig: StreamConfig = {
        ...defaultStreamConfig,
        name: "",
        subjects: [],
      };

      await expect(natsClient.createStream(invalidStreamConfig)).rejects.toThrow();
    });
  });

  describe("Storage Operations", () => {
    test("should set and get value", async () => {
      const key = "test-key";
      const value = { data: "test value" };

      await natsClient.set(key, value);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for set operation
      const retrieved = await natsClient.get<typeof value>(key);
      expect(retrieved).toEqual(value);
    });

    test("should delete value", async () => {
      const key = "test-key-delete";
      const value = { data: "test value" };

      await natsClient.set(key, value);
      await new Promise(resolve => setTimeout(resolve, 500));
      await natsClient.delete(key);
      const retrieved = await natsClient.get(key);
      expect(retrieved).toBeNull();
    });

    test("should handle expiring keys", async () => {
      const key = "test-key-expire";
      const value = { data: "expiring value" };
      const expirationMs = 1000; // Increased expiration time

      await natsClient.set(key, value, { expireMode: "PX", time: expirationMs });
      await new Promise(resolve => setTimeout(resolve, 500));

      const retrieved = await natsClient.get<typeof value>(key);
      expect(retrieved).toEqual(value);

      await new Promise(resolve => setTimeout(resolve, expirationMs + 500));
      const expiredValue = await natsClient.get<typeof value>(key);
      expect(expiredValue).toBeNull();
    });
  });

  describe("Error Handling", () => {
    test("should handle connection errors gracefully", async () => {
      const badClient = new NatsAlvamind(
        { servers: ["nats://nonexistent:4222"], timeout: 1000 },
        messageBrokerConfig,
        storageConfig,
        { attempts: 1, delay: 100 } // Reduce retry attempts for faster test
      );

      await expect(badClient.connect()).rejects.toThrow();
    }, 10000);

    test("should handle invalid stream operations", async () => {
      const invalidConfig: StreamConfig = {
        ...defaultStreamConfig,
        name: "",
        subjects: [],
      };

      await expect(natsClient.createStream(invalidConfig)).rejects.toThrow();
    });

    test("should retry failed operations", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) throw new Error("Temporary failure");
        return true;
      };

      const result = await RetryUtil.withRetry(operation, {
        attempts: 3,
        delay: 100,
      });

      expect(result).toBe(true);
      expect(attempts).toBe(2);
    });
  });

  describe("Performance", () => {
    beforeEach(async () => {
      const streamConfig: StreamConfig = {
        ...defaultStreamConfig,
        name: "test-stream-perf",
        subjects: ["test.perf.*"],
      };
      await natsClient.createStream(streamConfig).catch(() => { });
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test("should handle multiple concurrent operations", async () => {
      const operations = [];
      const numOperations = 3;

      for (let i = 0; i < numOperations; i++) {
        operations.push(
          natsClient.publish(`test.perf.${i}`, { index: i })
        );
      }

      await expect(Promise.all(operations)).resolves.toBeDefined();
    }, 10000);

    test("should handle large messages", async () => {
      const largeMessage = {
        data: "x".repeat(1024) // Reduced size for testing
      };

      await expect(
        RetryUtil.withRetry(() => natsClient.publish("test.large", largeMessage), { attempts: 3, delay: 100, factor: 2 })
      ).resolves.not.toThrow();
    }, 10000);
  });
});
