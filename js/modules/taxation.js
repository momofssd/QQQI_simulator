export function applyROCTaxation({
  investmentLots,
  rocPerShare,
  blendedTaxRate = 0.6 * 0.15 + 0.4 * 0.24,
}) {
  let taxDeferred = 0;
  let taxesPaid = 0;

  // Process ROC against ALL shares for tax calculation (FIFO basis)
  // Each share receives rocPerShare in ROC distribution
  for (let i = 0; i < investmentLots.length; i++) {
    const lot = investmentLots[i];
    const lotROC = rocPerShare * lot.shares;

    if (lot.costBasisPerShare > 0) {
      // ROC reduces cost basis per share
      const basisReductionPerShare = Math.min(
        rocPerShare,
        lot.costBasisPerShare,
      );
      lot.costBasisPerShare -= basisReductionPerShare;
      lot.totalCostBasis = lot.shares * lot.costBasisPerShare;

      const taxDeferredForLot = basisReductionPerShare * lot.shares;
      taxDeferred += taxDeferredForLot;

      // If this lot's cost basis is now zero, any remaining ROC to this lot is taxable
      if (lot.costBasisPerShare === 0 && rocPerShare > basisReductionPerShare) {
        const excessROCPerShare = rocPerShare - basisReductionPerShare;
        const taxableGain = excessROCPerShare * lot.shares;
        taxesPaid += taxableGain * blendedTaxRate;
      }
    } else {
      // Cost basis already at zero - all ROC for this lot is taxable
      const taxableGain = lotROC;
      taxesPaid += taxableGain * blendedTaxRate;
    }
  }

  return { taxDeferred, taxesPaid };
}

export function calculateCapitalGainsTax(balance, costBasis, rate = 0.2) {
  const capitalGain = balance - costBasis;
  return capitalGain > 0 ? capitalGain * rate : 0;
}
