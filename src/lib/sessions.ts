// In-memory store of consumed Stripe session IDs.
// In production, replace with a database or Redis.
const consumed = new Set<string>();

export function isSessionConsumed(sessionId: string): boolean {
  return consumed.has(sessionId);
}

export function markSessionConsumed(sessionId: string): void {
  consumed.add(sessionId);
}
