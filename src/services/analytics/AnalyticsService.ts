export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
}

class AnalyticsService {
  track(event: AnalyticsEvent): void {
    if (import.meta.env.DEV) {
      console.log('[Analytics]', event.name, event.properties);
    }
  }
}

export const analytics = new AnalyticsService();
