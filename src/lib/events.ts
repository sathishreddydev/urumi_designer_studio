/**
 * In-memory event log for polling-based real-time updates.
 *
 * Instead of SSE (which breaks on Vercel's serverless 10s timeout), we keep a
 * short rolling log of recent events. API clients poll /api/events?since=<ts>
 * and receive any events that arrived after that timestamp.
 *
 * The log is capped at MAX_EVENTS entries and events older than MAX_AGE_MS are
 * pruned on every write, so memory usage stays bounded even under heavy traffic.
 */

const MAX_EVENTS = 200;
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes — well beyond any reasonable poll interval

export interface AppEvent {
  type:
    | "outfit_updated"
    | "order_updated"
    | "dependency_updated"
    | "payment_added"
    | "payment_deleted"
    | "reference_updated"
    | "customer_updated"
    | "outfit_deleted"
    | "customer_feedback"
    | "session_revoked";
  outfitId?: string;
  orderId?: string;
  customerId?: string;
  userId?: string;
  sessionId?: string;
  timestamp: number;
}

class EventLog {
  private log: AppEvent[] = [];

  emit(event: AppEvent) {
    this.log.push(event);

    // Prune stale entries on every write so the log stays small
    const cutoff = Date.now() - MAX_AGE_MS;
    this.log = this.log.filter((e) => e.timestamp >= cutoff);

    // Hard cap in case of burst traffic
    if (this.log.length > MAX_EVENTS) {
      this.log = this.log.slice(this.log.length - MAX_EVENTS);
    }
  }

  /** Return all events with timestamp > since (exclusive). */
  since(since: number): AppEvent[] {
    return this.log.filter((e) => e.timestamp > since);
  }

  get size() {
    return this.log.length;
  }
}

// Global singleton — survives Next.js hot reloads in dev
const globalForEvents = globalThis as unknown as { eventLog: EventLog | undefined };
if (!globalForEvents.eventLog) {
  globalForEvents.eventLog = new EventLog();
}

export const eventBus = globalForEvents.eventLog;
