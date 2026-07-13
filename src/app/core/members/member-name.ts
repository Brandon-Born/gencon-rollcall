export function normalizeDisplayName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 32) : '';
}

export function memberNameKey(value: unknown): string {
  return normalizeDisplayName(value).toLocaleLowerCase('en-US');
}
