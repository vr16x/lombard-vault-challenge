import { JsonRpcProvider } from "ethers";

let provider: JsonRpcProvider | undefined;

/** Shared provider for RPC_URL, created on first use. */
export function getProvider(): JsonRpcProvider {
  if (!provider) {
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) throw new Error("RPC_URL is not set");
    provider = new JsonRpcProvider(rpcUrl);
  }
  return provider;
}
