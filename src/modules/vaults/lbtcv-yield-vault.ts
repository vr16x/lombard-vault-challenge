import { Contract, formatUnits, Interface, type Provider, type Signer } from "ethers";
import { ACCOUNTANT_ABI, QUEUE_ABI, SOLVER_ABI, TELLER_ABI } from "../../common/abis/boring-vault";
import { ERC20_ABI } from "../../common/abis/erc20";
import { apiGet } from "../../common/helpers/api-call";
import { formatUtcDate } from "../../common/helpers/formatters";
import { waitForSuccess } from "../../common/helpers/transaction";
import type { Address } from "../../common/types/web3-primitives";
import type { Opportunity } from "../../config/opportunities";
import type { ApyWindowDays, TokenInfo, VaultMetadata, VaultStatus, WithdrawRequest, YieldVault } from "./interfaces/vault.interface";

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
const BPS = 10_000n;
/** Matches the Accountant's maximum upward rate change per update (allowedExchangeRateChangeUpper = 1.005). */
const MIN_MINT_SLIPPAGE_BPS = 50n;

export class LbtcvYieldVault implements YieldVault {
  constructor(
    readonly opportunity: Opportunity,
    private readonly provider: Provider,
  ) {}

  /** APY and TVL come from one vault history fetch, run alongside the on-chain token reads. */
  async getVaultMetadata(signal?: AbortSignal): Promise<VaultMetadata> {
    const [snapshots, depositToken, shareToken] = await Promise.all([
      this.fetchDailySnapshots(signal),
      this.getTokenInfo(this.opportunity.depositToken),
      this.getTokenInfo(this.opportunity.vault),
    ]);
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
      shareToken,
    };
  }

  /** On-chain checks for anything that would make a deposit or withdrawal revert. */
  async getVaultStatus(): Promise<VaultStatus> {
    const { teller, accountant, queue, depositToken, withdrawToken } = this.opportunity;
    const [tellerPaused, accountantState, queuePaused, depositAssetData, withdrawAssetData, shareLockPeriod] = await Promise.all([
      new Contract(teller, TELLER_ABI, this.provider).isPaused(),
      new Contract(accountant, ACCOUNTANT_ABI, this.provider).accountantState(),
      new Contract(queue, QUEUE_ABI, this.provider).isPaused(),
      new Contract(teller, TELLER_ABI, this.provider).assetData(depositToken),
      new Contract(queue, QUEUE_ABI, this.provider).withdrawAssets(withdrawToken),
      new Contract(teller, TELLER_ABI, this.provider).shareLockPeriod(),
    ]);

    const status = {
      tellerPaused: Boolean(tellerPaused),
      accountantPaused: Boolean(accountantState.isPaused),
      queuePaused: Boolean(queuePaused),
      depositsAllowed: Boolean(depositAssetData.allowDeposits),
      withdrawalsAllowed: Boolean(withdrawAssetData.allowWithdraws),
      shareLockPeriodSeconds: Number(shareLockPeriod),
    };

    const warnings: string[] = [];
    if (status.tellerPaused) warnings.push("Teller is paused: deposits are disabled");
    if (status.accountantPaused) warnings.push("Accountant is paused: share pricing reverts");
    if (status.queuePaused) warnings.push("Withdraw queue is paused: withdrawals are disabled");
    if (!status.depositsAllowed) warnings.push("Teller does not accept deposits of the deposit token");
    if (!status.withdrawalsAllowed) warnings.push("Withdraw queue does not pay out the withdraw token");
    if (status.shareLockPeriodSeconds > 0) {
      warnings.push(`Teller locks new shares for ${status.shareLockPeriodSeconds}s: a withdrawal right after the deposit would revert`);
    }

    return { ...status, warnings };
  }

  async getShareBalance(owner: Address): Promise<bigint> {
    return new Contract(this.opportunity.vault, ERC20_ABI, this.provider).balanceOf(owner);
  }

  /**
   * Deposits through the Teller. The vault (not the Teller) pulls the tokens, so it is the approved spender.
   * minimumMint allows for one maximum-size rate update landing between the preview and the deposit.
   */
  async deposit(signer: Signer, amount: bigint): Promise<string> {
    if (amount <= 0n) throw new Error("Deposit amount must be greater than zero");

    const { vault, teller, accountant, depositToken } = this.opportunity;
    const owner = await signer.getAddress();
    const token = new Contract(depositToken, ERC20_ABI, signer);
    const tellerContract = new Contract(teller, TELLER_ABI, signer);

    const [balance, allowance, { symbol, decimals }, rateInQuote, assetData, shareDecimals] = await Promise.all([
      token.balanceOf(owner) as Promise<bigint>,
      token.allowance(owner, vault) as Promise<bigint>,
      this.getTokenInfo(depositToken),
      new Contract(accountant, ACCOUNTANT_ABI, this.provider).getRateInQuoteSafe(depositToken) as Promise<bigint>,
      tellerContract.assetData(depositToken),
      new Contract(vault, ERC20_ABI, this.provider).decimals(),
    ]);
    if (balance < amount) {
      throw new Error(`Insufficient ${symbol}: ${owner} holds ${formatUnits(balance, decimals)}, deposit needs ${formatUnits(amount, decimals)}`);
    }

    if (allowance < amount) {
      await waitForSuccess(await token.approve(vault, amount), `${symbol} approval`);
    }

    // Same maths and rounding as the Teller: shares = amount * ONE_SHARE / rateInQuote, then less the share premium.
    const oneShare = 10n ** BigInt(shareDecimals);
    const sharePremiumBps = BigInt(assetData.sharePremium);
    const expectedShares = (((amount * oneShare) / rateInQuote) * (BPS - sharePremiumBps)) / BPS;
    const minimumMint = (expectedShares * (BPS - MIN_MINT_SLIPPAGE_BPS)) / BPS;
    if (minimumMint === 0n) throw new Error(`Deposit of ${formatUnits(amount, decimals)} ${symbol} is too small to mint any shares`);

    const receipt = await waitForSuccess(await tellerContract.deposit(depositToken, amount, minimumMint), "Deposit");
    return receipt.hash;
  }

  /**
   * Queues `shares` for withdrawal at the queue's best terms for the user: the minimum discount and the
   * shortest allowed deadline. The queue takes the shares now and fixes the payout; a solver pays it after maturity.
   */
  async requestWithdraw(signer: Signer, shares: bigint): Promise<WithdrawRequest> {
    if (shares <= 0n) throw new Error("Withdraw amount must be greater than zero");

    const { vault, queue, withdrawToken } = this.opportunity;
    const owner = await signer.getAddress();
    const shareToken = new Contract(vault, ERC20_ABI, signer);
    const queueContract = new Contract(queue, QUEUE_ABI, signer);

    const [balance, allowance, rules, { symbol, decimals }] = await Promise.all([
      shareToken.balanceOf(owner) as Promise<bigint>,
      shareToken.allowance(owner, queue) as Promise<bigint>,
      queueContract.withdrawAssets(withdrawToken),
      this.getTokenInfo(vault),
    ]);
    if (!rules.allowWithdraws) throw new Error("Withdraw queue does not pay out the withdraw token");
    if (balance < shares) {
      throw new Error(`Insufficient ${symbol}: ${owner} holds ${formatUnits(balance, decimals)}, withdrawal needs ${formatUnits(shares, decimals)}`);
    }
    if (shares < rules.minimumShares) {
      throw new Error(`Withdrawal of ${formatUnits(shares, decimals)} ${symbol} is below the queue minimum of ${formatUnits(rules.minimumShares, decimals)}`);
    }

    // The queue pulls the shares, so it is the approved spender.
    if (allowance < shares) {
      await waitForSuccess(await shareToken.approve(queue, shares), "Share approval");
    }

    const tx = await queueContract.requestOnChainWithdraw(withdrawToken, shares, rules.minDiscount, rules.minimumSecondsToDeadline);
    const receipt = await waitForSuccess(tx, "Withdraw request");
    return parseWithdrawRequest(receipt.logs, queue);
  }

  /**
   * Pays out matured requests through the vault's BoringSolver, which redeems their shares at the Teller and
   * forwards each user's fixed payout. coverDeficit is off: the keeper does not top up a shortfall.
   */
  async solveWithdraws(keeper: Signer, requests: WithdrawRequest[]): Promise<string> {
    if (requests.length === 0) throw new Error("No withdraw requests to solve");

    const { solver, teller } = this.opportunity;
    const structs = requests.map(({ id: _id, ...request }) => request);
    const tx = await new Contract(solver, SOLVER_ABI, keeper).boringRedeemSolve(structs, teller, false);
    const receipt = await waitForSuccess(tx, "Withdraw solve");
    return receipt.hash;
  }

  private async getTokenInfo(address: Address): Promise<TokenInfo> {
    const token = new Contract(address, ERC20_ABI, this.provider);
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

const QUEUE_INTERFACE = new Interface(QUEUE_ABI);

/** Reads the request back from its OnChainWithdrawRequested event; the queue only stores its hash. */
function parseWithdrawRequest(logs: readonly { address: string; topics: readonly string[]; data: string }[], queue: Address): WithdrawRequest {
  for (const log of logs) {
    if (log.address.toLowerCase() !== queue.toLowerCase()) continue;
    const event = QUEUE_INTERFACE.parseLog(log);
    if (event?.name !== "OnChainWithdrawRequested") continue;

    const { requestId, user, assetOut, nonce, amountOfShares, amountOfAssets, creationTime, secondsToMaturity, secondsToDeadline } = event.args;
    return {
      id: requestId,
      nonce,
      user,
      assetOut,
      amountOfShares,
      amountOfAssets,
      creationTime: Number(creationTime),
      secondsToMaturity: Number(secondsToMaturity),
      secondsToDeadline: Number(secondsToDeadline),
    };
  }
  throw new Error("Withdraw request was mined but no OnChainWithdrawRequested event was found");
}
