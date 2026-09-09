export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const SENSITIVE_URL_PARAMETER = /^(?:access_token|auth(?:orization)?|code|credential|id_token|jwt|key|oauth_token|password|passwd|refresh_token|samlresponse|secret|session_state|sig|signature|token)$/i;

/**
 * Keep useful filter/query parameters while removing values that commonly carry
 * credentials or one-time authentication state. Fragments are never required
 * to request a page and frequently contain OAuth tokens, so they are omitted.
 */
export function sanitizeCapturedUrl(value: string): string {
  try {
    const parsed = new URL(value);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_URL_PARAMETER.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = "";
    return parsed.href;
  } catch {
    return value;
  }
}

export function resolveHttpUrl(value: string, baseUrl: string): string | null {
  const normalized = value.trim();
  if (normalized === "") {
    return null;
  }
  try {
    const parsed = new URL(normalized, baseUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? sanitizeCapturedUrl(parsed.href)
      : null;
  } catch {
    return null;
  }
}
