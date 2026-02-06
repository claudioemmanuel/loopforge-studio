import { SystemHealthService } from "../application/system-health-service";

export function getSystemHealthService(): SystemHealthService {
  return new SystemHealthService();
}

export { SystemHealthService } from "../application/system-health-service";
