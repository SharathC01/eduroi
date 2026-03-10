// Simple in-memory cache with TTL
const store = {};

export function get(key) {
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete store[key];
    return null;
  }
  return entry.value;
}

export function set(key, value, ttlMs) {
  store[key] = { value, expiresAt: Date.now() + ttlMs };
}
