export interface IAnalyticsService {
  trackEvent(
    eventName: string,
    properties: Record<string, unknown>,
  ): Promise<void>;
}
