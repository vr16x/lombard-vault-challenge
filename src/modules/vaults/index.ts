import { getProvider } from "../../common/helpers/provider";
import { opportunities, type Opportunity } from "../../config/opportunities";
import type { YieldVault } from "./interfaces/vault.interface";
import { LbtcvYieldVault } from "./lbtcv-yield-vault";

function opportunityById(id: string): Opportunity {
  const opportunity = opportunities.find((o) => o.id === id);
  if (!opportunity) throw new Error(`No opportunity configured with id "${id}"`);
  return opportunity;
}

const LBTCV_YIELD_VAULT_ID = "lbtcv-yield-vault";

/** Vault factories keyed by opportunity id; nothing is built until first requested. */
const vaultFactories = new Map<string, () => YieldVault>([
  [LBTCV_YIELD_VAULT_ID, () => new LbtcvYieldVault(opportunityById(LBTCV_YIELD_VAULT_ID), getProvider())],
]);

const vaults = new Map<string, YieldVault>();

export function getVault(id: string): YieldVault {
  let vault = vaults.get(id);
  if (!vault) {
    const create = vaultFactories.get(id);
    if (!create) throw new Error(`No vault registered with id "${id}"`);
    vault = create();
    vaults.set(id, vault);
  }
  return vault;
}
