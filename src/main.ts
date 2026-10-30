import "dotenv/config";
import { parseUnits } from "ethers";
import { exitWithError } from "./common/helpers/errors";
import { formatTokenAmount, formatUsd } from "./common/helpers/formatters";
import { assertLocalFork, getSigner } from "./common/helpers/signer";
import type { Address } from "./common/types/web3-primitives";
import { LBTCV_YIELD_VAULT_ID } from "./config/opportunities";
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
  console.log(`Balance before: ${formatShares(await vault.getShareBalance(wallet))}`);

  console.log("Depositing...");
  await vault.deposit(signer, parseUnits(DEPOSIT_AMOUNT, depositToken.decimals));
  console.log(`Balance after: ${formatShares(await vault.getShareBalance(wallet))}`);
}

main().catch(exitWithError);
