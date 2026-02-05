/**
 * TaskConfiguration value object - Task execution settings
 */
export interface TaskConfiguration {
  autonomousMode: boolean;
  autoApprove: boolean;
}

export function createDefaultConfiguration(): TaskConfiguration {
  return {
    autonomousMode: false,
    autoApprove: false,
  };
}
