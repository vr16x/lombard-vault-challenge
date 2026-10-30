import "dotenv/config";
import { parseUnits } from "ethers";
import { advanceTimeTo, withImpersonation } from "./common/helpers/anvil";
import { exitWithError } from "./common/helpers/errors";
import { formatDuration, formatTokenAmount, formatUsd } from "./common/helpers/formatters";
import { assertLocalFork, getSigner } from "./common/helpers/signer";
import type { Address } from "./common/types/web3-primitives";
import { getOpportunity, LBTCV_YIELD_VAULT_ID } from "./config/opportunities";
import { getVault } from "./modules/vaults";

/** In deposit-token units (LBTC). */
const DEPOSIT_AMOUNT = "0.000001";

async function main(): Promise<void> {
  const vault = getVault(LBTCV_YIELD_VAULT_ID);

  const [{ name, apy, tvlUsd, depositToken, shareToken }, status] = await Promise.all([vault.getVaultMetadata(), vault.getVaultStatus()]);

  console.log(`Vault: ${name}`);
  console.log(`APY (7d, BTC): ${apy[7].toFixed(2)}%`);
  console.log(`APY (30d, BTC): ${apy[30].toFixed(2)}%`);
  console.log(`TVL: ${formatUsd(tvlUsd)}`);
  console.log(`Deposit token: ${depositToken.symbol} (${depositToken.decimals} decimals)`);
  console.log(`Share token: ${shareToken.symbol} (${shareToken.decimals} decimals)`);

  if (status.warnings.length > 0) {
    console.log();
    for (const warning of status.warnings) console.warn(`⚠️  ${warning}`);
    console.warn("Vault is not operational. Skipping deposit and withdrawal.");
    process.exitCode = 1;
    return;
  }

  await assertLocalFork();
  const signer = getSigner();
  const wallet = (await signer.getAddress()) as Address;
  const formatShares = (shares: bigint) => formatTokenAmount(shares, shareToken.decimals);

  console.log();
  console.log(`Wallet: ${wallet}`);
  console.log(`Balance before (${shareToken.symbol}): ${formatShares(await vault.getShareBalance(wallet))}`);

  console.log("Depositing...");
  await vault.deposit(signer, parseUnits(DEPOSIT_AMOUNT, depositToken.decimals));
  const sharesAfterDeposit = await vault.getShareBalance(wallet);
  console.log(`Balance after (${shareToken.symbol}): ${formatShares(sharesAfterDeposit)}`);

  console.log("Withdrawing...");
  const request = await vault.requestWithdraw(signer, sharesAfterDeposit);
  console.log(`  - Withdraw request queued, matures in ${formatDuration(request.secondsToMaturity)}`);

  // Fork only: the queue pays out after maturity, and only Lombard's keeper may trigger the solver,
  // so skip ahead past maturity and act as the keeper.
  const advancedSeconds = await advanceTimeTo(request.creationTime + request.secondsToMaturity);
  console.log(`  - [anvil] Advanced time by ${formatDuration(advancedSeconds)}`);
  console.log("  - Keeper solver solving...");
  await withImpersonation(getOpportunity(LBTCV_YIELD_VAULT_ID).solverKeeper, (keeper) => vault.solveWithdraws(keeper, [request]));

  console.log(`Balance final (${shareToken.symbol}): ${formatShares(await vault.getShareBalance(wallet))}`);
  console.log("✅ Complete!");
}

main().catch(exitWithError);
