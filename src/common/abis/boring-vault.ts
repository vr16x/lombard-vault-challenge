export const TELLER_ABI = [
  "function isPaused() view returns (bool)",
  "function assetData(address asset) view returns (bool allowDeposits, bool allowWithdraws, uint16 sharePremium)",
  "function deposit(address depositAsset, uint256 depositAmount, uint256 minimumMint) payable returns (uint256 shares)",
  "function shareLockPeriod() view returns (uint64)",
] as const;

export const ACCOUNTANT_ABI = [
  "function getRateInQuoteSafe(address quote) view returns (uint256 rateInQuote)",
  "function accountantState() view returns (address payoutAddress, uint96 highwaterMark, uint128 feesOwedInBase, uint128 totalSharesLastUpdate, uint96 exchangeRate, uint16 allowedExchangeRateChangeUpper, uint16 allowedExchangeRateChangeLower, uint64 lastUpdateTimestamp, bool isPaused, uint24 minimumUpdateDelayInSeconds, uint16 platformFee, uint16 performanceFee)",
] as const;

export const QUEUE_ABI = [
  "function isPaused() view returns (bool)",
  "function withdrawAssets(address asset) view returns (bool allowWithdraws, uint24 secondsToMaturity, uint24 minimumSecondsToDeadline, uint16 minDiscount, uint16 maxDiscount, uint96 minimumShares)",
  "function requestOnChainWithdraw(address assetOut, uint128 amountOfShares, uint16 discount, uint24 secondsToDeadline) returns (bytes32 requestId)",
  "event OnChainWithdrawRequested(bytes32 indexed requestId, address indexed user, address indexed assetOut, uint96 nonce, uint128 amountOfShares, uint128 amountOfAssets, uint40 creationTime, uint24 secondsToMaturity, uint24 secondsToDeadline)",
] as const;

/** BoringSolver: pays out matured queue requests by redeeming their shares through a Teller. */
export const SOLVER_ABI = [
  "function boringRedeemSolve((uint96 nonce, address user, address assetOut, uint128 amountOfShares, uint128 amountOfAssets, uint40 creationTime, uint24 secondsToMaturity, uint24 secondsToDeadline)[] requests, address teller, bool coverDeficit)",
] as const;
