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
