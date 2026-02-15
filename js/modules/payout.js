export function calculateMonthlyROC({
  balance,
  targetMonthlyROC,
  monthlyVolatility,
  totalShares,
}) {
  // Base monthly premium collection rate (~1.2% monthly for ~14% annual)
  // This represents the option premiums collected from selling covered calls
  const basePremiumRate = targetMonthlyROC * 1.03; // Slightly higher than target to account for reductions

  // Realized Volatility (RV) is the absolute monthly price change
  const monthlyRV = Math.abs(monthlyVolatility);

  // Estimate typical monthly volatility (approx 1.5% = ~18% annualized)
  const typicalMonthlyVol = 0.015;

  // Calculate base premium collected (relatively stable)
  let premiumCollected = balance * basePremiumRate;

  // When market moves sharply, sold calls go ITM and reduce net income
  // VRP exists because Implied Vol > Realized Vol on average, but large moves can reverse this
  const excessMove = Math.max(0, monthlyRV - typicalMonthlyVol);

  // Option payouts reduce net income when realized vol exceeds typical vol
  // Using 50% haircut on excess moves (conservative estimate)
  const optionPayout = excessMove * balance * 0.5;

  // Net ROC = Premium Collected - Option Payouts
  // Add small random variation (±5%) to simulate month-to-month variation in option market conditions
  const randomVariation = 1 + (Math.random() * 0.1 - 0.05);
  const rocAmount = Math.max(
    balance * 0.002, // Minimum floor of 0.2% monthly (even in worst months)
    (premiumCollected - optionPayout) * randomVariation,
  );

  const rocPerShare = rocAmount / totalShares;

  return { rocAmount, rocPerShare };
}
