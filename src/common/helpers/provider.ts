import { JsonRpcProvider } from "ethers";

let provider: JsonRpcProvider | undefined;

/** Shared provider for RPC_URL, created on first use. */
export function getProvider(): JsonRpcProvider {
  if (!provider) {
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) throw new Error("RPC_URL is not set");
    // ethers caches identical calls for 250ms by default; on an instantly mining node that serves a stale
    // nonce to a transaction sent right after another one (e.g. approve then deposit).
    provider = new JsonRpcProvider(rpcUrl, undefined, { cacheTimeout: -1 });
  }
  return provider;
}
