import { connect, NatsConnection, StringCodec } from "nats";

const sc = StringCodec();

async function main() {
  // connect to nats server using tcp
  const nc: NatsConnection = await connect({ servers: "localhost:4222" });
  console.log("connected to nats server");

  // Create a JetStream client
  const js = nc.jetstream();
  const bucketName = "mykv";

  try {
    // Create a KV store (or open if it exists)
    const kv = await js.views.kv(bucketName, { history: 5 });
    console.log(`KV bucket "${bucketName}" created/opened`);

    // Create entry
    const hw = await kv.create("hello.world", sc.encode("hi"));
    if (hw) {
      console.log(`created hello.world revision: ${hw}`) // hw is just a number
    } else {
      // Use kv.put if the key already exists
      const entry = await kv.put("hello.world", sc.encode("hi"))
      console.log(`created or updated hello.world revision: ${entry}`); // entry is just a number
    }

    const e = await kv.get("hello.world");
    if (e) {
      console.log(`created ${e.key} => ${sc.decode(e.value)}`);
    } else {
      console.log(`key hello.world was not found`)
    }


    // Watch for changes (starts with initial values)
    const watch = await kv.watch();
    (async () => {
      for await (const e of watch) {
        console.log(
          `watch: ${e.key}: ${e.operation} ${e.value ? sc.decode(e.value) : ""}`
        );
      }
    })().then();

    // Update an entry
    await kv.put("hello.world", sc.encode("world"));
    console.log("updated value: hello.world to world");

    // Retrieve an entry
    const e2 = await kv.get("hello.world");
    if (e2) {
      console.log(`value for get ${sc.decode(e2.value)}`);
    } else {
      console.log("key hello.world not found");
    }

    // Get all keys
    const buf: string[] = [];
    const keys = await kv.keys();
    for await (const k of keys) {
      buf.push(k);
    }
    console.log(`keys contains hello.world: ${buf.includes("hello.world")}`);

    // History
    const h = await kv.history();
    (async () => {
      for await (const e of h) {
        console.log(
          `history: ${e.key}: ${e.operation} ${e.value ? sc.decode(e.value) : ""}`
        );
      }
    })();

    // delete the entry
    await kv.delete("hello.world");
    console.log("deleted: hello.world");

    // Purge the entry
    await kv.purge("hello.world");
    console.log("purged: hello.world");

    // stop the watch operation
    await watch.stop();

    // Get all keys after deletion/purge
    const buf2: string[] = [];
    const keys2 = await kv.keys();
    for await (const k of keys2) {
      buf2.push(k);
    }
    console.log(
      `keys contains hello.world after delete/purge: ${buf2.includes(
        "hello.world"
      )}`
    );

    // Destroy the KV store
    // await kv.destroy(); // NOTE: uncomment this to destroy the bucket
    // console.log(`KV bucket "${bucketName}" destroyed`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await nc.close();
    console.log("nats connection closed");
  }
}

main().catch(console.error);
