import "dotenv/config";
import { Contract, parseEther, parseUnits, toBeHex } from "ethers";
import { ERC20_ABI } from "../common/abis/erc20";
import { exitWithError } from "../common/helpers/errors";
import { formatTokenAmount } from "../common/helpers/formatters";
import { getProvider } from "../common/helpers/provider";
import { assertLocalFork, getSigner } from "../common/helpers/signer";
import { waitForSuccess } from "../common/helpers/transaction";
import { getOpportunity, LBTCV_YIELD_VAULT_ID } from "../config/opportunities";

/** Large LBTC holder on mainnet, impersonated on the fork only. */
const LBTC_HOLDER = "0xb213531aa8113f455c626a305feaef82da605e08";
/** In deposit-token units (LBTC). */
const FUND_AMOUNT = "0.01";

async function main(): Promise<void> {
  await assertLocalFork();

  const provider = getProvider();
  const wallet = await getSigner().getAddress();
  const opportunity = getOpportunity(LBTCV_YIELD_VAULT_ID);
  const token = new Contract(opportunity.depositToken, ERC20_ABI, provider);
  const [symbol, decimals, holderBalance] = await Promise.all([token.symbol(), token.decimals(), token.balanceOf(LBTC_HOLDER)]);
  const amount = parseUnits(FUND_AMOUNT, decimals);
  if (holderBalance < amount) throw new Error(`${LBTC_HOLDER} only holds ${formatTokenAmount(holderBalance, Number(decimals))} ${symbol}; pick another holder`);

  // Gas money for the impersonated holder, then send the tokens as that holder.
  await provider.send("anvil_setBalance", [LBTC_HOLDER, toBeHex(parseEther("1"))]);
  await provider.send("anvil_impersonateAccount", [LBTC_HOLDER]);
  try {
    const holder = await provider.getSigner(LBTC_HOLDER);
    await waitForSuccess(await (token.connect(holder) as Contract).transfer(wallet, amount), "Funding transfer");
  } finally {
    await provider.send("anvil_stopImpersonatingAccount", [LBTC_HOLDER]);
  }

  console.log(`Funded ${wallet} with ${FUND_AMOUNT} ${symbol}; balance now ${formatTokenAmount(await token.balanceOf(wallet), Number(decimals), 8)} ${symbol}`);
}

main().catch(exitWithError);
