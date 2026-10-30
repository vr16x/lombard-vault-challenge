import { Wallet } from "ethers";
import { getProvider } from "./provider";

let signer: Wallet | undefined;

/** Shared wallet for PRIVATE_KEY on the shared provider, created on first use. */
export function getSigner(): Wallet {
  if (!signer) {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("PRIVATE_KEY is not set");
    signer = new Wallet(privateKey, getProvider());
  }
  return signer;
}

/** Refuses to continue unless RPC_URL is a local Anvil node, so transactions never reach a real network. */
export async function assertLocalFork(): Promise<void> {
  const clientVersion: string = await getProvider().send("web3_clientVersion", []);
  if (!clientVersion.toLowerCase().startsWith("anvil")) {
    throw new Error(`Refusing to send transactions: RPC_URL is "${clientVersion}", not a local Anvil fork`);
  }
}
