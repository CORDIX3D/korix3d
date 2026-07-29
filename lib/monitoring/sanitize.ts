const SECRET_PATTERNS = [
  /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9_-]{12,}\b/g,
  /\b(?:sbp|sb_secret|sb_publishable)_[A-Za-z0-9_-]{12,}\b/g,
  /\bwhsec_[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~-]{12,}\b/gi,
];
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function sanitizeMonitoringText(value: unknown, maxLength = 2000) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, '[REDACTED]');
  text = text.replace(EMAIL_PATTERN, '[EMAIL]');
  return text.slice(0, maxLength);
}

export function normalizeMonitoringError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: sanitizeMonitoringText(error.name, 100),
      message: sanitizeMonitoringText(error.message, 1000),
      stack: sanitizeMonitoringText(error.stack, 4000),
    };
  }

  return {
    name: 'UnknownError',
    message: sanitizeMonitoringText(error, 1000),
    stack: '',
  };
}
