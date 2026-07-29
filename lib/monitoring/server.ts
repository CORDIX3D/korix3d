import 'server-only';
import { randomUUID } from 'node:crypto';
import { normalizeMonitoringError, sanitizeMonitoringText } from './sanitize';

type MonitoringContext = {
  source: string;
  digest?: string;
  path?: string;
  requestId?: string;
};

export function captureServerError(error: unknown, context: MonitoringContext) {
  const eventId = randomUUID();
  const normalized = normalizeMonitoringError(error);
  const record = {
    type: 'korix3d_error',
    eventId,
    occurredAt: new Date().toISOString(),
    source: sanitizeMonitoringText(context.source, 120),
    digest: sanitizeMonitoringText(context.digest, 120),
    path: sanitizeMonitoringText(context.path, 500),
    requestId: sanitizeMonitoringText(context.requestId, 120),
    error: normalized,
    deployment:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.COMMIT_REF ||
      process.env.HEAD ||
      null,
  };

  console.error(JSON.stringify(record));
  return eventId;
}
