const SENSITIVE_NORMALIZED_HEADERS = new Set([
  'authorization',
  'cookie',
  'setcookie',
  'xapikey',
  'apikey',
]);

const SENSITIVE_NORMALIZED_KEYS = new Set([
  'password',
  'pass',
  'otp',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'xapikey',
  'secret',
  'clientsecret',
  'pin',
  'creditcard',
  'cardnumber',
  'cvv',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

export function isSensitiveHeader(headerName: string): boolean {
  return SENSITIVE_NORMALIZED_HEADERS.has(normalizeKey(headerName));
}

export function isSensitiveKey(keyName: string): boolean {
  return SENSITIVE_NORMALIZED_KEYS.has(normalizeKey(keyName));
}

export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveHeader(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 10 || obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactObject(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function redactUrlOrQuery(urlString: string): string {
  try {
    const url = new URL(urlString, 'http://localhost');
    let hasModified = false;
    for (const [key] of url.searchParams.entries()) {
      if (isSensitiveKey(key)) {
        url.searchParams.set(key, '[REDACTED]');
        hasModified = true;
      }
    }
    if (!hasModified) return urlString;
    return urlString.startsWith('http')
      ? url.toString()
      : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return urlString;
  }
}
