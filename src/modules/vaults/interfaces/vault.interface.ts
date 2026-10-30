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
}
