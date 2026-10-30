/** e.g. 71019437.789 → "$71,019,437.79" */
export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** e.g. 1793318400 → "2026-10-30" (UTC) */
export function formatUtcDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}
