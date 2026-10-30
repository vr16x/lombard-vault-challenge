/** True when the error (or anything it wraps) is a refused TCP connection, e.g. the local fork isn't running. */
export function isConnectionRefused(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== "object" || depth > 5) return false;
  const { code, cause, error } = err as { code?: unknown; cause?: unknown; error?: unknown };
  return code === "ECONNREFUSED" || isConnectionRefused(cause, depth + 1) || isConnectionRefused(error, depth + 1);
}

/** Prints a fatal error for an entry script and exits non-zero. */
export function exitWithError(err: unknown): never {
  if (isConnectionRefused(err)) {
    console.error(`Can't reach RPC_URL (${process.env.RPC_URL}). Is the fork running? Start it with: npm run fork`);
  } else {
    console.error(err);
  }
  process.exit(1);
}
