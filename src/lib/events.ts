/**
 * In-memory event bus for Server-Sent Events.
 * When a mutation happens (status change, new measurement, etc.),
 * we emit an event here. All connected SSE clients receive it instantly.
 */

type EventListener = (event: AppEvent) => void;

export interface AppEvent {
  type: "outfit_updated" | "order_updated" | "dependency_updated" | "payment_added" | "payment_deleted" | "reference_updated" | "customer_updated" | "outfit_deleted" | "customer_feedback";
  outfitId?: string;
  orderId?: string;
  customerId?: string;
  userId?: string;
  timestamp: number;
}

class EventBus {
  private listeners: Set<EventListener> = new Set();

  subscribe(listener: EventListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: AppEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    });
  }

  get connectionCount() {
    return this.listeners.size;
  }
}

// Global singleton (persists across hot reloads)
const globalForEvents = globalThis as unknown as { eventBus: EventBus | undefined };
if (!globalForEvents.eventBus) {
  globalForEvents.eventBus = new EventBus();
}

export const eventBus = globalForEvents.eventBus;
