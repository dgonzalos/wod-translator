export function parseOptionalNumber(raw: string): number | null {
  return raw.trim() === '' ? null : Number(raw);
}
