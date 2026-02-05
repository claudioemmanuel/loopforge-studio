/**
 * Clone Status Event System
 * Real-time clone status tracking with event-driven updates.
 */

export type CloneStatus = "pending" | "cloning" | "completed" | "failed";

export interface CloneStatusEvent {
  repoId: string;
  status: CloneStatus;
  timestamp: Date;
  error?: string;
}

/**
 * Client-side event emitter for clone status changes
 */
export const cloneStatusEmitter = new EventTarget();

/**
 * Subscribe to clone status changes for a specific repository
 */
export function subscribeToCloneStatus(
  repoId: string,
  callback: (event: CloneStatusEvent) => void,
): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<CloneStatusEvent>;
    if (customEvent.detail.repoId === repoId) {
      callback(customEvent.detail);
    }
  };

  cloneStatusEmitter.addEventListener("clone-status-changed", handler);

  return () => {
    cloneStatusEmitter.removeEventListener("clone-status-changed", handler);
  };
}

/**
 * Emit a clone status change event.
 * Called from the clone API route when clone status updates.
 */
export function emitCloneStatusChange(event: CloneStatusEvent): void {
  const customEvent = new CustomEvent("clone-status-changed", {
    detail: event,
  });
  cloneStatusEmitter.dispatchEvent(customEvent);
}
