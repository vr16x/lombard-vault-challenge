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
  /** Seconds new shares stay non-transferable after a deposit; non-zero would block the queue request. */
  shareLockPeriodSeconds: number;
  /** One message per check that would block the deposit/withdraw flow; empty when all is well. */
  warnings: string[];
}

/** A withdraw-queue request, exactly as the queue stores it; the whole struct is needed to solve or cancel it. */
export interface WithdrawRequest {
  id: string;
  nonce: bigint;
  user: Address;
  assetOut: Address;
  amountOfShares: bigint;
  /** Payout, fixed when the request is made. */
  amountOfAssets: bigint;
  creationTime: number;
  secondsToMaturity: number;
  secondsToDeadline: number;
}

export interface YieldVault {
  getVaultMetadata(signal?: AbortSignal): Promise<VaultMetadata>;
  getVaultStatus(): Promise<VaultStatus>;
  /** Vault shares held by `owner`, in share-token base units. */
  getShareBalance(owner: Address): Promise<bigint>;
  /** Approves (if needed) and deposits `amount` of the deposit token; resolves to the deposit tx hash once mined. */
  deposit(signer: Signer, amount: bigint): Promise<string>;
  /** Approves (if needed) and queues `shares` for withdrawal; the shares leave the wallet immediately. */
  requestWithdraw(signer: Signer, shares: bigint): Promise<WithdrawRequest>;
  /** Pays out matured requests through the vault's solver; `keeper` must be allowed to call it. Resolves to the tx hash. */
  solveWithdraws(keeper: Signer, requests: WithdrawRequest[]): Promise<string>;
}
