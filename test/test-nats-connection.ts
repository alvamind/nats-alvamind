import { connect } from 'nats';

async function testNatsConnection() {
  try {
    const nc = await connect({ servers: ['nats://localhost:4222'] }); // Changed from nats-test to localhost
    console.log('Connected to NATS server');
    await nc.close();
  } catch (err) {
    console.error('Failed to connect to NATS server:', err);
  }
}

testNatsConnection();
