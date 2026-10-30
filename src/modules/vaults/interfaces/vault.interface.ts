import type { Signer } from "ethers";
import type { Address } from "../../../common/types/web3-primitives";

export type ApyWindowDays = 7 | 30;

export interface TokenInfo {
  symbol: string;
  decimals: number;
}

export interface VaultMetadata {
  name: string;
  /** Percent, keyed by window in days. */
  apy: Record<ApyWindowDays, number>;
  tvlUsd: number;
  depositToken: TokenInfo;
  /** The vault's own share token (LBTCv). */
  shareToken: TokenInfo;
}

export interface VaultStatus {
  tellerPaused: boolean;
  accountantPaused: boolean;
  queuePaused: boolean;
  depositsAllowed: boolean;
  withdrawalsAllowed: boolean;
  /** One message per check that would block the deposit/withdraw flow; empty when all is well. */
  warnings: string[];
}

export interface YieldVault {
  getVaultMetadata(signal?: AbortSignal): Promise<VaultMetadata>;
  getVaultStatus(): Promise<VaultStatus>;
  /** Vault shares held by `owner`, in share-token base units. */
  getShareBalance(owner: Address): Promise<bigint>;
  /** Approves (if needed) and deposits `amount` of the deposit token; resolves to the deposit tx hash once mined. */
  deposit(signer: Signer, amount: bigint): Promise<string>;
}
