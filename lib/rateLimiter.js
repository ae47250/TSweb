import { RATE_LIMIT_REQUESTS_PER_HOUR } from "../config/constants.js";

const buckets = new Map();
const WINDOW_MS = 60 * 60 * 1000;

export function checkRateLimit(key, now = Date.now()) {
  const bucket = buckets.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }
  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= RATE_LIMIT_REQUESTS_PER_HOUR,
    remaining: Math.max(0, RATE_LIMIT_REQUESTS_PER_HOUR - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function resetRateLimiter() {
  buckets.clear();
}
