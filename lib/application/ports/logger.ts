export interface AppLogger {
  info(details: Record<string, unknown> | string, message?: string): void;
  error(details: Record<string, unknown> | string, message?: string): void;
}
