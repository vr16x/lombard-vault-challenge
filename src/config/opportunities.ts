import type { Address } from "../common/types/web3-primitives";

export interface Opportunity {
  id: string;
  name: string;
  chainId: number;
  vault: Address;
  teller: Address;
  accountant: Address;
  queue: Address;
  rolesAuthority: Address;
  depositToken: Address;
  withdrawToken: Address;
  baseAsset: Address;
}

export const opportunities: Opportunity[] = [
  {
    id: "lbtcv-yield-vault",
    name: "Lombard DeFi Vault",
    chainId: 1,
    vault: "0x5401b8620E5FB570064CA9114fd1e135fd77D57c",
    teller: "0x4E8f5128F473C6948127f9Cbca474a6700F99bab",
    accountant: "0x28634D0c5edC67CF2450E74deA49B90a4FF93dCE",
    queue: "0x4a20F4948c435fDA923399F89800CdC373de88cB",
    rolesAuthority: "0xF3E03eF7df97511a52f31ea7a22329619db2bdF4",
    depositToken: "0x8236a87084f8B84306f72007F36F2618A5634494", // LBTC
    withdrawToken: "0x8236a87084f8B84306f72007F36F2618A5634494", // LBTC
    baseAsset: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
  },
];
