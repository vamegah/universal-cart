export type SavedListSummaryInput = {
  items?: unknown[];
};

export type AlertSummaryInput = {
  status?: string;
};

export type AuditSummaryInput = {
  action: string;
  createdAt?: string;
  summary?: string;
  metadata?: {
    store?: string;
    ready?: boolean;
    routeType?: string;
    errors?: unknown[];
    warnings?: unknown[];
  } | null;
};

export function summarizeDashboardState(
  savedLists: SavedListSummaryInput[],
  alerts: AlertSummaryInput[],
  auditEvents: AuditSummaryInput[]
) {
  const checkoutEvents = auditEvents.filter((event) => event.action.startsWith('checkout.'));
  const latestCheckoutEvent = checkoutEvents[0] || null;

  return {
    savedListCount: savedLists.length,
    savedProductCount: savedLists.reduce((sum, list) => sum + (list.items?.length || 0), 0),
    activeAlertCount: alerts.filter((alert) => (alert.status || 'active') === 'active').length,
    triggeredAlertCount: alerts.filter((alert) => alert.status === 'triggered').length,
    openCheckoutState: latestCheckoutEvent
      ? {
          action: latestCheckoutEvent.action,
          store: latestCheckoutEvent.metadata?.store || null,
          ready: latestCheckoutEvent.metadata?.ready ?? null,
          issueCount: (latestCheckoutEvent.metadata?.errors?.length || 0) + (latestCheckoutEvent.metadata?.warnings?.length || 0),
          summary: latestCheckoutEvent.summary || latestCheckoutEvent.action,
          createdAt: latestCheckoutEvent.createdAt || null,
        }
      : null,
  };
}
