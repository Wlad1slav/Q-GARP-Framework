export function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 16);
}
