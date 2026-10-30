export const TELLER_ABI = [
  "function isPaused() view returns (bool)",
  "function assetData(address asset) view returns (bool allowDeposits, bool allowWithdraws, uint16 sharePremium)",
  "function deposit(address depositAsset, uint256 depositAmount, uint256 minimumMint) payable returns (uint256 shares)",
] as const;

export const ACCOUNTANT_ABI = [
  "function getRateInQuoteSafe(address quote) view returns (uint256 rateInQuote)",
  "function accountantState() view returns (address payoutAddress, uint96 highwaterMark, uint128 feesOwedInBase, uint128 totalSharesLastUpdate, uint96 exchangeRate, uint16 allowedExchangeRateChangeUpper, uint16 allowedExchangeRateChangeLower, uint64 lastUpdateTimestamp, bool isPaused, uint24 minimumUpdateDelayInSeconds, uint16 platformFee, uint16 performanceFee)",
] as const;

export const QUEUE_ABI = [
  "function isPaused() view returns (bool)",
  "function withdrawAssets(address asset) view returns (bool allowWithdraws, uint24 secondsToMaturity, uint24 minimumSecondsToDeadline, uint16 minDiscount, uint16 maxDiscount, uint96 minimumShares)",
] as const;
