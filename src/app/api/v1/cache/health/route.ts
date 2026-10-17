import { NextResponse } from 'next/server';
import { linkCache } from '@/lib/cache';

export async function GET() {
  const startTime = Date.now();
  const pingResult = await linkCache.ping();

  // Test read/write cycle
  const testKey = `health_check_${Date.now()}`;
  let writeOk = false;
  let readOk = false;
  let delOk = false;

  try {
    await linkCache.set(testKey, { test: 'val', timestamp: Date.now() }, 10);
    writeOk = true;

    const readVal = await linkCache.get<{ test: string }>(testKey);
    readOk = readVal?.test === 'val';

    await linkCache.delete(testKey);
    delOk = true;
  } catch (err) {
    console.warn('[Cache Health] Cycle test failed:', err);
  }

  const totalDurationMs = Date.now() - startTime;
  const isFullyHealthy = pingResult.ok && writeOk && readOk && delOk;

  return NextResponse.json({
    success: isFullyHealthy,
    tier_l1: {
      type: 'in-memory-lru',
      status: 'active',
      description: 'Sub-millisecond process memory cache'
    },
    tier_l2: {
      type: 'upstash-redis',
      status: pingResult.ok ? 'connected' : 'degraded',
      latency_ms: pingResult.latencyMs,
      endpoint: process.env.UPSTASH_REDIS_REST_URL ? new URL(process.env.UPSTASH_REDIS_REST_URL).hostname : 'unconfigured',
      error: pingResult.error || null
    },
    operations_test: {
      ping: pingResult.ok,
      set: writeOk,
      get: readOk,
      delete: delOk,
      roundtrip_latency_ms: totalDurationMs
    },
    timestamp: new Date().toISOString()
  }, {
    status: isFullyHealthy ? 200 : 503
  });
}
