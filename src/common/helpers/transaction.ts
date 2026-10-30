import type { ContractTransactionResponse, TransactionReceipt } from "ethers";

/** Waits for the transaction to be mined and throws if it reverted. */
export async function waitForSuccess(tx: ContractTransactionResponse, label: string): Promise<TransactionReceipt> {
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${label} transaction ${tx.hash} failed`);
  return receipt;
}
