# Lombard Vault Challenge

The Lombard BTC DeFi Vault puts deposited Bitcoin to work in DeFi strategies, and the yield shows up as a rising share price.
It accepts LBTC (Lombard's staked BTC) for both deposits and withdrawals, and issues LBTCv vault shares in return.
This codebase shows the vault's live metadata, then runs a full yield cycle against it: deposit, balance check and withdrawal.

> [!IMPORTANT]
> **Runs on a forked mainnet, not a live network.** The repo uses a local fork of Ethereum mainnet to ease testing and run the flow end to end:
>
> 1. The Lombard BTC vault has no testnet deployment, so a fork is an easy way to test against real tokens and contracts without spending real gas.
> 2. On mainnet a withdrawal is not instant: the request has to reach maturity and is then paid out by Lombard's keeper. To run the full yield cycle end to end, the script advances the fork's clock past maturity and solves the request as the keeper on the fork, bypassing the wait.

## Setup

**Prerequisites**

- Node.js 20.3 or later (developed on Node 24)
- [Foundry](https://getfoundry.sh), which provides `anvil` for the local fork:

  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```

- Optional: an Ethereum mainnet RPC URL for Anvil to fork from (e.g. Alchemy or Infura). Without one, the fork uses a free public RPC.

**Install and configure**

```bash
npm install
cp .env.example .env
```

That's enough to run. Optionally set `FORK_RPC_URL` in `.env` to your own mainnet RPC URL; the other values already point at the local fork:

| Variable | Purpose |
|---|---|
| `FORK_RPC_URL` | Mainnet RPC that Anvil forks from. Defaults to the public `https://ethereum-rpc.publicnode.com` when empty. |
| `RPC_URL` | Where the script sends its calls: the local fork, `http://127.0.0.1:8545` |
| `PRIVATE_KEY` | Anvil's default account #0, a public test key. Never use it on a real network. |

## Run

```bash
# Terminal 1: start a local mainnet fork on port 8545
npm run fork

# Terminal 2
npm run fund    # gives the test wallet 0.01 LBTC on the fork
npm start       # metadata, deposit, balance check, withdraw
```

- `npm run fork` forks from the latest block. Set `FORK_BLOCK_NUMBER` to pin a block for reproducible runs.
- With the default public RPC, keep the fork unpinned and restart it if it starts erroring after a while: public RPCs only serve recent state and rate-limit requests. Pinning an old block needs an archive RPC (e.g. Alchemy).
- `npm run fund` sends LBTC to the test wallet from a large LBTC holder that it impersonates on the fork.
- `npm start` refuses to send any transaction unless `RPC_URL` is an Anvil node, so it can't touch a real network by mistake.
- `npm run typecheck` type-checks the project.

Example output:

```
Vault: Lombard DeFi Vault
APY (7d, BTC): 1.21%
APY (30d, BTC): 1.39%
TVL: $71,019,437.79
Deposit token: LBTC (8 decimals)
Share token: LBTCv (8 decimals)

Wallet: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Balance before (LBTCv): 0.000000
Depositing...
Balance after (LBTCv): 0.000001
Withdrawing...
  - Withdraw request queued, matures in 1h 0m
  - [anvil] Advanced time by 1h 0m
  - Keeper solver solving...
Balance final (LBTCv): 0.000000
✅ Complete!
```

## Yield Flow

1. **Fork:** Anvil forks Ethereum mainnet locally, so Lombard's real contracts, balances and permissions are available.
2. **Fund (fork only):** `npm run fund` impersonates an LBTC holder and sends 0.01 LBTC to the test wallet.
3. **Metadata:** APY (7-day and 30-day) and TVL come from Lombard's vault history API. The vault name comes from the config, and the token symbols and decimals are read on-chain.
4. **Status checks:** the script confirms the Teller, Accountant and withdraw queue aren't paused, that LBTC deposits and withdrawals are enabled, and that new shares aren't locked. If any check fails, it prints a warning and stops before sending a transaction.
5. **Deposit:** it approves the vault to spend the LBTC (the vault pulls the tokens), then calls `teller.deposit(LBTC, amount, minimumMint)`. The vault mints LBTCv shares at the Accountant's current rate.
6. **Balance check:** it reads the wallet's LBTCv balance.
7. **Withdraw request:** it approves the queue to take the shares, then calls `queue.requestOnChainWithdraw`. The queue takes the shares immediately and fixes the LBTC payout. The request is read back from its `OnChainWithdrawRequested` event.
8. **Maturity (fork only):** the request can only be paid after 1 hour. The script advances the fork's clock past maturity.
9. **Solve (fork only):** only Lombard's keeper can trigger the payout, so the script impersonates the keeper and calls the vault's solver (`boringRedeemSolve`). The solver redeems the shares at the Teller and sends the user their fixed LBTC payout.
10. **Final balance:** the wallet's LBTCv balance is back to 0, and the LBTC has been returned.

## Why LBTC and not WBTC

The vault's base asset (its unit of account) is WBTC, but users can't deposit or withdraw WBTC any more:

- Lombard turned off WBTC deposits on the Teller on 2026-05-05. A WBTC deposit now reverts with `TellerWithMultiAssetSupport__AssetNotSupported()`.
- The withdraw queue stopped paying out WBTC on 2026-03-06.

So the script deposits and withdraws LBTC. Only Lombard's solvers can still redeem shares into WBTC.

## Why the APY is in BTC

The APY is labelled `BTC` because the vault prices its shares in WBTC, its unit of account. The APY is the growth of that share price, annualized.

LBTC itself grows in value against BTC (about 0.74% a year), and the share price includes that growth. So the APY shown is the total yield in BTC terms: LBTC's own growth plus the vault's strategy yield.

Counted in LBTC tokens the gain is smaller, because each LBTC is also worth more BTC. On 2026-10-30:

| Window | APY in BTC (shown) | Gain in LBTC tokens |
|---|---|---|
| 7 days | 1.21% | 0.37% |
| 30 days | 1.39% | 0.65% |

## Known Limitations

- **Rounding:** depositing 0.000001 LBTC mints 0.00000097 LBTCv, which pays back 0.00000099 LBTC. The vault contracts round down in the vault's favour on both deposit and withdrawal, so a round trip loses a sat or two whatever the amount. It isn't a fee.
- **Real payout timing:** the 1-hour maturity is only the minimum. On mainnet, Lombard's keeper batches payouts, and real requests have taken days to be paid. Requests must be paid within 20 days of maturity.
- **Hardcoded fork addresses:** the keeper (`solverKeeper` in `src/config/opportunities.ts`) and the LBTC holder used for funding (`LBTC_HOLDER` in `src/scripts/fund-wallet.ts`) were checked on 2026-10-30. If Lombard rotates the keeper, the solve reverts with an auth error. If the holder's LBTC balance drops, `npm run fund` says so. Either way, the address needs updating.

## Contracts

All on Ethereum mainnet, as configured in `src/config/opportunities.ts`.

| Contract | Role | Address |
|---|---|---|
| BoringVault (LBTCv) | Holds the assets and is the share token | [`0x5401…D57c`](https://etherscan.io/address/0x5401b8620E5FB570064CA9114fd1e135fd77D57c) |
| Teller | Takes deposits and mints shares | [`0x4E8f…9bab`](https://etherscan.io/address/0x4E8f5128F473C6948127f9Cbca474a6700F99bab) |
| Accountant | Stores the share price (exchange rate) | [`0x2863…3dCE`](https://etherscan.io/address/0x28634D0c5edC67CF2450E74deA49B90a4FF93dCE) |
| BoringOnChainQueue | Takes withdraw requests and fixes the payout | [`0x4a20…88cB`](https://etherscan.io/address/0x4a20F4948c435fDA923399F89800CdC373de88cB) |
| BoringSolver | Pays out matured withdraw requests | [`0x6300…Fb9f`](https://etherscan.io/address/0x6300F657a332ec803DB9Fd08d7D9C30470BdFb9f) |
| Solver keeper | Lombard's keeper, the only caller allowed to trigger the solver | [`0xD230…6CA2`](https://etherscan.io/address/0xD23086C4e450cAAF55704EbC03875A04B4716CA2) |
| RolesAuthority | Permissions for all of the above | [`0xF3E0…bdF4`](https://etherscan.io/address/0xF3E03eF7df97511a52f31ea7a22329619db2bdF4) |
| LBTC | Deposit and withdraw token | [`0x8236…4494`](https://etherscan.io/address/0x8236a87084f8B84306f72007F36F2618A5634494) |
| WBTC | The vault's base asset (unit of account) | [`0x2260…C599`](https://etherscan.io/address/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599) |

## Project Structure

```
scripts/
  start-fork.sh                 # npm run fork: starts the Anvil mainnet fork
src/
  main.ts                       # npm start: metadata, status checks, deposit, withdraw
  config/
    opportunities.ts            # vault config: contract and token addresses
  modules/vaults/
    index.ts                    # vault registry: getVault(id)
    interfaces/vault.interface.ts   # YieldVault interface and shared types
    lbtcv-yield-vault.ts        # LBTCv vault: APY/TVL, status checks, deposit, withdraw request and solve
  common/
    abis/                       # minimal ABIs: ERC-20 and BoringVault contracts
    helpers/                    # provider, signer, Anvil, API, formatting, transaction and error helpers
    types/web3-primitives.ts    # Address type
  scripts/
    fund-wallet.ts              # npm run fund: sends LBTC to the test wallet on the fork
```

> [!WARNING]
> **Note for the challenge authors:** the Veda DeFi vault docs link on the challenge's Notion page appears to be invalid or expired. I used other relevant Veda and Lombard documentation to implement the yield flow instead. Mentioning it so the link can be fixed in the challenge.
