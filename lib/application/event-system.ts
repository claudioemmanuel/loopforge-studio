import { getDomainEventBus } from "@/lib/domain-events/bus";
import { registerDomainEventHandlers } from "@/lib/application/event-handlers";
import { registerProcessManagers } from "@/lib/application/process-managers";

let initialized = false;

export function initDomainEventSystem() {
  if (initialized) {
    return getDomainEventBus();
  }

  const bus = getDomainEventBus();
  registerDomainEventHandlers(bus);
  registerProcessManagers(bus);
  initialized = true;
  return bus;
}
