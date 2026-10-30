import type { Address } from "../common/types/web3-primitives";

export interface Opportunity {
  id: string;
  name: string;
  chainId: number;
  vault: Address;
  teller: Address;
  accountant: Address;
  queue: Address;
  /** BoringSolver that pays out matured queue requests. */
  solver: Address;
  /**
   * Lombard's keeper, the only caller allowed to trigger the solver; impersonated on the fork.
   * If Lombard rotates it, the solve reverts with an auth error.
   */
  solverKeeper: Address;
  rolesAuthority: Address;
  depositToken: Address;
  withdrawToken: Address;
  baseAsset: Address;
}

export const LBTCV_YIELD_VAULT_ID = "lbtcv-yield-vault";

export const opportunities: Opportunity[] = [
  {
    id: LBTCV_YIELD_VAULT_ID,
    name: "Lombard DeFi Vault",
    chainId: 1,
    vault: "0x5401b8620E5FB570064CA9114fd1e135fd77D57c",
    teller: "0x4E8f5128F473C6948127f9Cbca474a6700F99bab",
    accountant: "0x28634D0c5edC67CF2450E74deA49B90a4FF93dCE",
    queue: "0x4a20F4948c435fDA923399F89800CdC373de88cB",
    solver: "0x6300F657a332ec803DB9Fd08d7D9C30470BdFb9f",
    solverKeeper: "0xD23086C4e450cAAF55704EbC03875A04B4716CA2",
    rolesAuthority: "0xF3E03eF7df97511a52f31ea7a22329619db2bdF4",
    depositToken: "0x8236a87084f8B84306f72007F36F2618A5634494", // LBTC
    withdrawToken: "0x8236a87084f8B84306f72007F36F2618A5634494", // LBTC
    baseAsset: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
  },
];

export function getOpportunity(id: string): Opportunity {
  const opportunity = opportunities.find((o) => o.id === id);
  if (!opportunity) throw new Error(`No opportunity configured with id "${id}"`);
  return opportunity;
}
