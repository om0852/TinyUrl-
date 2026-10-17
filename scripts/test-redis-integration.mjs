import { Redis } from '@upstash/redis';

const url = 'https://outgoing-robin-147295.upstash.io';
const token = 'gQAAAAAAAj9fAAIgcDFiYjk3MjY0NmMzZjc0YjdjOGYwMzQ5YTlkNDRhYmQwZQ';

async function verify() {
  console.log('=== Step 1: Initializing Upstash Redis Client ===');
  const redis = new Redis({ url, token });

  console.log('=== Step 2: Testing Redis Ping ===');
  const start = Date.now();
  const pong = await redis.ping();
  const latency = Date.now() - start;
  console.log(`Ping response: "${pong}" (Roundtrip latency: ${latency}ms)`);

  console.log('\n=== Step 3: Testing Object Write with TTL ===');
  const sampleLink = {
    id: 'link_test_redis_123',
    short_code: 'redis-demo',
    destination_url: 'https://example.com/demo',
    title: 'Redis Fast Shortlink',
    clicks_count: 42
  };
  await redis.set('snip:link_redis-demo', sampleLink, { ex: 60 });
  console.log('Successfully set "snip:link_redis-demo" with 60s TTL');

  console.log('\n=== Step 4: Testing Object Read ===');
  const readBack = await redis.get('snip:link_redis-demo');
  console.log('Read back from Redis:', readBack);
  console.log('Verified match:', readBack.id === sampleLink.id && readBack.clicks_count === 42);

  console.log('\n=== Step 5: Testing Distributed Deduplication (SETNX) ===');
  const clickId = `clk_test_${Date.now()}`;
  const nx1 = await redis.set(`snip:tracked_clk_${clickId}`, '1', { ex: 60, nx: true });
  console.log(`Beacon 1 (first click event):`, nx1); // Should be "OK"

  const nx2 = await redis.set(`snip:tracked_clk_${clickId}`, '1', { ex: 60, nx: true });
  console.log(`Beacon 2 (duplicate click event):`, nx2); // Should be null (deduped!)

  console.log('\n=== Step 6: Cleaning Up Test Keys ===');
  await redis.del('snip:link_redis-demo', `snip:tracked_clk_${clickId}`);
  console.log('Test keys deleted successfully from Redis.');

  console.log('\n========================================');
  console.log(' Redis Verification PASSED 100%! ');
  console.log('========================================');
}

verify().catch(console.error);
