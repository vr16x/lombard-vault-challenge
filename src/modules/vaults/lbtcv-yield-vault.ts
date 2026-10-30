import { Contract, type Provider } from "ethers";
import { ACCOUNTANT_ABI, QUEUE_ABI, TELLER_ABI } from "../../common/abis/boring-vault";
import { ERC20_ABI } from "../../common/abis/erc20";
import { apiGet } from "../../common/helpers/api-call";
import { formatUtcDate } from "../../common/helpers/formatters";
import type { Opportunity } from "../../config/opportunities";
import type { ApyWindowDays, TokenInfo, VaultMetadata, VaultStatus, YieldVault } from "./interfaces/vault.interface";

/** One validated entry of Lombard's vault history API; only the fields we use. */
interface DailySnapshot {
  unixSeconds: number;
  sharePrice: number;
  tvlUsd: number;
}

const VAULT_HISTORY_URL = "https://bff.prod.lombard-fi.com/sevenseas-api/daily-data/all";
const SECONDS_PER_DAY = 86_400;
const DAYS_PER_YEAR = 365;
/** Snapshots are taken daily at 00:00 UTC, so anything older than this means the API stopped updating. */
const MAX_SNAPSHOT_AGE_SECONDS = 2 * SECONDS_PER_DAY;

export class LbtcvYieldVault implements YieldVault {
  constructor(
    readonly opportunity: Opportunity,
    private readonly provider: Provider,
  ) {}

  /** APY and TVL come from one vault history fetch, run alongside the on-chain token reads. */
  async getVaultMetadata(signal?: AbortSignal): Promise<VaultMetadata> {
    const [snapshots, depositToken] = await Promise.all([this.fetchDailySnapshots(signal), this.getDepositToken()]);
    const latest = snapshots[0];
    const { name, vault } = this.opportunity;
    if (!latest) throw new Error(`No history found for ${name} (${vault}), so APY and TVL are unavailable`);

    const ageSeconds = Date.now() / 1000 - latest.unixSeconds;
    if (ageSeconds > MAX_SNAPSHOT_AGE_SECONDS) {
      const ageDays = (ageSeconds / SECONDS_PER_DAY).toFixed(1);
      throw new Error(`History for ${name} is stale: latest snapshot (${formatUtcDate(latest.unixSeconds)}) is ${ageDays} days old, so APY and TVL would be outdated`);
    }

    return {
      name,
      apy: { 7: computeApy(snapshots, 7), 30: computeApy(snapshots, 30) },
      tvlUsd: requireTvlUsd(latest),
      depositToken,
    };
  }

  /** On-chain checks for anything that would make a deposit or withdrawal revert. */
  async getVaultStatus(): Promise<VaultStatus> {
    const { teller, accountant, queue, depositToken, withdrawToken } = this.opportunity;
    const [tellerPaused, accountantState, queuePaused, depositAssetData, withdrawAssetData] = await Promise.all([
      new Contract(teller, TELLER_ABI, this.provider).isPaused(),
      new Contract(accountant, ACCOUNTANT_ABI, this.provider).accountantState(),
      new Contract(queue, QUEUE_ABI, this.provider).isPaused(),
      new Contract(teller, TELLER_ABI, this.provider).assetData(depositToken),
      new Contract(queue, QUEUE_ABI, this.provider).withdrawAssets(withdrawToken),
    ]);

    const status = {
      tellerPaused: Boolean(tellerPaused),
      accountantPaused: Boolean(accountantState.isPaused),
      queuePaused: Boolean(queuePaused),
      depositsAllowed: Boolean(depositAssetData.allowDeposits),
      withdrawalsAllowed: Boolean(withdrawAssetData.allowWithdraws),
    };

    const warnings: string[] = [];
    if (status.tellerPaused) warnings.push("Teller is paused: deposits are disabled");
    if (status.accountantPaused) warnings.push("Accountant is paused: share pricing reverts");
    if (status.queuePaused) warnings.push("Withdraw queue is paused: withdrawals are disabled");
    if (!status.depositsAllowed) warnings.push("Teller does not accept deposits of the deposit token");
    if (!status.withdrawalsAllowed) warnings.push("Withdraw queue does not pay out the withdraw token");

    return { ...status, warnings };
  }

  private async getDepositToken(): Promise<TokenInfo> {
    const token = new Contract(this.opportunity.depositToken, ERC20_ABI, this.provider);
    const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
    return { symbol, decimals: Number(decimals) };
  }

  /** Newest first. */
  private async fetchDailySnapshots(signal?: AbortSignal): Promise<DailySnapshot[]> {
    const data = await apiGet(`${VAULT_HISTORY_URL}/${this.opportunity.vault}/0/latest`, { signal });
    return parseSnapshots(data).sort((a, b) => b.unixSeconds - a.unixSeconds);
  }
}

/**
 * Entries without a usable timestamp can't be placed in time, so they are dropped.
 * Share price and TVL are only validated on the snapshots actually used, so a bad old entry doesn't fail the run.
 */
function parseSnapshots(data: unknown): DailySnapshot[] {
  if (!Array.isArray(data)) throw new Error(`Vault history API returned an unexpected response: expected an array of snapshots, got ${data === null ? "null" : typeof data}`);

  return data
    .map((entry) => ({
      unixSeconds: Number(entry?.unix_seconds),
      sharePrice: Number(entry?.share_price),
      tvlUsd: Number(entry?.tvl),
    }))
    .filter((snapshot) => Number.isFinite(snapshot.unixSeconds));
}

function requireSharePrice(snapshot: DailySnapshot): number {
  if (!Number.isFinite(snapshot.sharePrice) || snapshot.sharePrice <= 0) {
    throw new Error(`Vault history API returned an invalid share price for the ${formatUtcDate(snapshot.unixSeconds)} snapshot`);
  }
  return snapshot.sharePrice;
}

function requireTvlUsd(snapshot: DailySnapshot): number {
  if (!Number.isFinite(snapshot.tvlUsd)) {
    throw new Error(`Vault history API returned an invalid TVL for the ${formatUtcDate(snapshot.unixSeconds)} snapshot`);
  }
  return snapshot.tvlUsd;
}

/**
 * APY in percent, compounded from share-price growth over the window:
 * (latest / start) ^ (365 / days) - 1. Expects snapshots newest first.
 */
function computeApy(snapshots: DailySnapshot[], windowDays: ApyWindowDays): number {
  const latest = snapshots[0];
  const start = latest && snapshots.find((s) => s.unixSeconds <= latest.unixSeconds - windowDays * SECONDS_PER_DAY);
  if (!latest || !start) throw new Error(`Not enough vault history for a ${windowDays}-day APY`);

  const days = (latest.unixSeconds - start.unixSeconds) / SECONDS_PER_DAY;
  return ((requireSharePrice(latest) / requireSharePrice(start)) ** (DAYS_PER_YEAR / days) - 1) * 100;
}
