/**
 * Event System Initialization
 *
 * Compatibility wrapper around domain-events runtime orchestration.
 */

import {
  type DomainEventRuntimeOptions,
  startDomainEventRuntime,
  stopDomainEventRuntime,
  getDomainEventRuntimeHealth,
  areDomainEventHandlersHealthy,
  isDomainEventRuntimeInitialized,
} from "@/lib/contexts/domain-events/runtime";

export interface HandlerHealth {
  name: string;
  initialized: boolean;
  healthy: boolean;
  error?: string;
}

export async function initializeEventHandlers(
  options: DomainEventRuntimeOptions = {},
): Promise<void> {
  await startDomainEventRuntime(options);
}

export async function shutdownEventHandlers(): Promise<void> {
  await stopDomainEventRuntime();
}

export function isEventSystemInitialized(): boolean {
  return isDomainEventRuntimeInitialized();
}

export function getHandlers() {
  return undefined;
}

export function getHandlerHealthStatus(): HandlerHealth[] {
  return getDomainEventRuntimeHealth();
}

export function areAllHandlersHealthy(): boolean {
  return areDomainEventHandlersHealthy();
}
