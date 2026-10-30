import { parseEther, toBeHex, type JsonRpcSigner } from "ethers";
import type { Address } from "../types/web3-primitives";
import { getProvider } from "./provider";

/**
 * Mines a block at `timestamp` (if it is in the future), so time-gated contract checks see it.
 * Resolves to how many seconds the chain clock moved forward (0 if it was already there).
 */
export async function advanceTimeTo(timestamp: number): Promise<number> {
  const provider = getProvider();
  const latest = await provider.getBlock("latest");
  if (!latest) throw new Error("Could not read the latest block");
  if (latest.timestamp >= timestamp) return 0;
  await provider.send("evm_setNextBlockTimestamp", [toBeHex(timestamp)]);
  await provider.send("evm_mine", []);
  return timestamp - latest.timestamp;
}

/** Runs `fn` as `address` (funded with 1 ETH for gas), then stops impersonating even if `fn` throws. */
export async function withImpersonation<T>(address: Address, fn: (signer: JsonRpcSigner) => Promise<T>): Promise<T> {
  const provider = getProvider();
  await provider.send("anvil_setBalance", [address, toBeHex(parseEther("1"))]);
  await provider.send("anvil_impersonateAccount", [address]);
  try {
    return await fn(await provider.getSigner(address));
  } finally {
    await provider.send("anvil_stopImpersonatingAccount", [address]);
  }
}
