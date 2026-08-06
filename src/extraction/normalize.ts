export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function resolveHttpUrl(value: string, baseUrl: string): string | null {
  const normalized = value.trim();
  if (normalized === "") {
    return null;
  }
  try {
    const parsed = new URL(normalized, baseUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}
