import "dotenv/config";
import { formatUsd } from "./common/helpers/formatters";
import { getVault } from "./modules/vaults";

async function main(): Promise<void> {
  const vault = getVault("lbtcv-yield-vault");

  const [{ name, apy, tvlUsd, depositToken }, status] = await Promise.all([vault.getVaultMetadata(), vault.getVaultStatus()]);

  console.log(`Vault: ${name}`);
  console.log(`APY (7d, BTC): ${apy[7].toFixed(2)}%`);
  console.log(`APY (30d, BTC): ${apy[30].toFixed(2)}%`);
  console.log(`TVL: ${formatUsd(tvlUsd)}`);
  console.log(`Token: ${depositToken.symbol} (${depositToken.decimals} decimals)`);

  if (status.warnings.length > 0) {
    console.log();
    for (const warning of status.warnings) console.warn(`⚠️  ${warning}`);
    console.warn("Vault is not operational. Skipping deposit and withdrawal.");
    process.exitCode = 1;
    return;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
