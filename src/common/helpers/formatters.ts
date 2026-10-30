import { formatUnits } from "ethers";

/** e.g. 71019437.789 → "$71,019,437.79" */
export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** e.g. (97n, 8) → "0.000001" */
export function formatTokenAmount(amount: bigint, decimals: number, fractionDigits = 6): string {
  return Number(formatUnits(amount, decimals)).toFixed(fractionDigits);
}

/** e.g. 1793318400 → "2026-10-30" (UTC) */
export function formatUtcDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** e.g. 3600 → "1h 0m", 1728000 → "20d 0h", 45 → "45s" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${s % 60}s`;
  return `${s}s`;
}
