import { getAuditEvents } from '@/services/api';
import { useEffect, useState } from 'react';

type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAuditEvents()
      .then((data) => {
        if (active) setEvents(data || []);
      })
      .catch((loadError: any) => {
        if (active) {
          setError(loadError.response?.status === 401 ? 'Sign in to view your audit trail.' : 'Unable to load audit trail.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Audit Trail</h1>
      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <p className="p-6 text-gray-500">Loading audit events...</p>
        ) : error ? (
          <p className="p-6 text-red-600">{error}</p>
        ) : events.length === 0 ? (
          <p className="p-6 text-gray-500">No audited cart or checkout actions yet.</p>
        ) : (
          <div className="divide-y">
            {events.map((event) => (
              <article key={event.id} className="p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="font-semibold text-gray-900">{event.summary}</h2>
                  <time className="text-xs text-gray-500">{formatDate(event.createdAt)}</time>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {event.action} on {event.entityType}
                  {event.entityId ? ` ${event.entityId}` : ''}
                </p>
                {event.metadata ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-blue-700">Details</summary>
                    <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
