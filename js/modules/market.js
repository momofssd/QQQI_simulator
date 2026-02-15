export function generateMarketTrends(months, trendType, initialPrice = 50) {
  const trends = [];

  // QQQ statistics (QQQI has 0.8 beta, so multiply volatility by 0.88)
  // QQQ historical: ~13% annual return, ~20% annualized volatility
  const qqqBeta = 0.1;
  const qqqAnnualReturn = 0.13;
  const qqqAnnualVolatility = 0.2; // Standard deviation

  // Convert to monthly parameters
  // Monthly return = annual / 12 (simplified)
  // Monthly volatility = annual / sqrt(12)
  const qqqMonthlyReturn = qqqAnnualReturn / 12;
  const qqqMonthlyVolatility = qqqAnnualVolatility / Math.sqrt(12); // ~5.77% monthly

  // Apply QQQI's 0.88 beta
  const baseMonthlyReturn = qqqMonthlyReturn * qqqBeta;
  const baseMonthlyVol = qqqMonthlyVolatility * qqqBeta; // ~5.08% monthly std dev

  // Adjust base return by trend type
  let trendMultiplier = 1.0;
  let volatilityMultiplier = 1.0;

  if (trendType === "bullish") {
    // Bullish case: 3% annual growth mean with randomness
    // 3% annual return = ~0.25% monthly return
    trendMultiplier = 0.03 / 12 / baseMonthlyReturn;
    volatilityMultiplier = 1.0;
  } else if (trendType === "bearish") {
    trendMultiplier = -2.0; // Negative returns (bear market)
    volatilityMultiplier = 1.5; // Higher volatility in bear market
  } else if (trendType === "neutral") {
    trendMultiplier = 0; // No drift
    volatilityMultiplier = 0; // No volatility
  } else if (trendType === "random") {
    trendMultiplier = 1.0; // Normal long-term average
    volatilityMultiplier = 1.0; // Normal volatility
  }

  // Generate monthly returns using random walk with drift
  for (let month = 0; month < months; month++) {
    if (trendType === "neutral") {
      trends.push(0);
    } else {
      // Drift component (expected monthly return)
      const drift = baseMonthlyReturn * trendMultiplier;

      // Random component (volatility shock)
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const normalRandom =
        Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const volatilityShock =
        normalRandom * baseMonthlyVol * volatilityMultiplier;

      // Monthly return = drift + random shock
      const monthlyReturn = drift + volatilityShock;

      trends.push(monthlyReturn);
    }
  }

  return trends;
}
