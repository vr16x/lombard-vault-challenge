export interface ApiGetOptions {
  /** Default 10s. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** GET a JSON endpoint, failing on timeout, abort or a non-2xx response. */
export async function apiGet<T = unknown>(url: string, { timeoutMs = DEFAULT_TIMEOUT_MS, signal }: ApiGetOptions = {}): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) {
    // Origin + path only: query strings may carry API keys.
    const { origin, pathname } = new URL(url);
    throw new Error(`GET ${origin}${pathname} failed with HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
