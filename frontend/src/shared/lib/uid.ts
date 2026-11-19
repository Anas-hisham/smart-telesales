/** A random id. Used as the Idempotency-Key of requests that must never be saved twice. */
export const generateUniqueId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
