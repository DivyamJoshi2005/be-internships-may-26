const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 5);
const WINDOW_MS = 60_000;
const buckets = new Map();

export function checkAndConsume(userId, nowMs = Date.now()) {
  let timestamps = buckets.get(userId) || [];

  timestamps = timestamps.filter(ts => nowMs - ts < WINDOW_MS);

  timestamps.push(nowMs);

  buckets.set(userId, timestamps);

  const ok = timestamps.length <= RATE;

  const oldest = timestamps[0] || nowMs;

  const resetMs = oldest + WINDOW_MS;

  const remaining = Math.max(RATE - timestamps.length, 0);

  return {
    ok,
    remaining,
    resetMs
  };
}