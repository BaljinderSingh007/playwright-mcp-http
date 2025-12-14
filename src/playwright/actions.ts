export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeSelector(selector: string): string {
  return selector.trim();
}

export function sanitizeText(text: string): string {
  return String(text);
}
