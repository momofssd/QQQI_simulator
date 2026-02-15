import { destroyChart, updateChart } from "./js/modules/chart.js";
import { generateMarketTrends } from "./js/modules/market.js";
import { calculateMonthlyROC } from "./js/modules/payout.js";
import {
  applyROCTaxation,
  calculateCapitalGainsTax,
} from "./js/modules/taxation.js";
import { formatCurrency, setCardValue } from "./js/modules/ui.js";
import { downloadCSV as downloadCSVUtil } from "./js/modules/utils.js";

let lastMonthlyData = [];

window.calculate = function calculate() {
  const initialBalance = parseFloat(
    document.getElementById("initialBalance").value,
  );
  const qqqiPrice = parseFloat(document.getElementById("qqqiPrice").value);
  const monthlyDcaAmount = parseFloat(
    document.getElementById("monthlyDcaAmount").value,
  );
  const currentAge = parseInt(document.getElementById("currentAge").value);
  const targetAge = parseInt(document.getElementById("targetAge").value);
  const sellAge = parseInt(document.getElementById("sellAge").value);
  const marketTrend = document.getElementById("marketTrend").value;

  if (targetAge <= currentAge) {
    alert("Target age must be greater than current age");
    return;
  }

  if (sellAge < targetAge) {
    alert("Sell age must be greater than or equal to target age");
    return;
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Calculate projection periods
  const yearsToDCAStop = targetAge - currentAge;
  const totalProjectionYears = sellAge - currentAge; // Project to sell age
  const totalMonths = totalProjectionYears * 12;

  // Use the annual ROC rate from the user input
  const annualROC =
    parseFloat(document.getElementById("annualROC").value) / 100;
  const targetMonthlyROC = annualROC / 12;

  // Generate market trends (Monthly)
  const monthlyTrends = generateMarketTrends(
    totalMonths,
    marketTrend,
    qqqiPrice,
  );

  // Initialize share tracking
  let totalShares = initialBalance / qqqiPrice;
  let currentSharePrice = qqqiPrice;
  let totalPrincipal = initialBalance; // Out-of-pocket cash
  let totalROCReceived = 0;
  let totalROCReinvested = 0;
  let totalTaxDeferred = 0;
  let totalTaxesPaid = 0;

  // Track investment lots with FIFO (First In First Out)
  const investmentLots = [
    {
      shares: totalShares,
      costBasisPerShare: qqqiPrice,
      totalCostBasis: initialBalance,
      monthAdded: 0,
    },
  ];

  const monthlyData = [];
  const chartData = [];

  let yearlyAggregate = {
    year: currentYear,
    endBalance: 0,
    rocReceived: 0,
  };

  // Simulate month by month
  for (let month = 0; month < totalMonths; month++) {
    const yearIndex = Math.floor(month / 12);
    const monthInYear = ((currentMonth + month - 1) % 12) + 1;
    const year = currentYear + Math.floor((currentMonth + month - 1) / 12);
    const age = currentAge + yearIndex;

    // Update share price based on market trend
    // Monthly trends are now generated as direct monthly factors
    const monthlyVolatility = monthlyTrends[month];
    currentSharePrice = currentSharePrice * (1 + monthlyVolatility);

    // Add Monthly DCA only until target age
    if (age < targetAge) {
      const sharesAdded = monthlyDcaAmount / currentSharePrice;
      totalShares += sharesAdded;
      totalPrincipal += monthlyDcaAmount;

      // Add new investment lot
      investmentLots.push({
        shares: sharesAdded,
        costBasisPerShare: currentSharePrice,
        totalCostBasis: monthlyDcaAmount,
        monthAdded: month,
      });
    }

    // Calculate monthly ROC distribution
    const balance = totalShares * currentSharePrice;
    const { rocAmount, rocPerShare } = calculateMonthlyROC({
      balance,
      targetMonthlyROC,
      monthlyVolatility,
      totalShares,
    });

    totalROCReceived += rocAmount;

    let rocReinvested = 0;

    // Reinvest ROC only until target age
    if (age < targetAge) {
      const sharesFromROC = rocAmount / currentSharePrice;
      totalShares += sharesFromROC;
      rocReinvested = rocAmount;
      totalROCReinvested += rocAmount;

      // Reinvestment is treated like a new DCA contribution for cost basis purposes
      // It creates a new lot with the current share price as the cost basis
      investmentLots.push({
        shares: sharesFromROC,
        costBasisPerShare: currentSharePrice,
        totalCostBasis: rocAmount,
        monthAdded: month,
      });
    }

    // Process ROC taxation
    const { taxDeferred, taxesPaid } = applyROCTaxation({
      investmentLots,
      rocPerShare,
    });

    totalTaxDeferred += taxDeferred;
    totalTaxesPaid += taxesPaid;

    // Calculate total remaining cost basis
    const totalCostBasis = investmentLots.reduce(
      (sum, lot) => sum + lot.totalCostBasis,
      0,
    );

    monthlyData.push({
      month: monthInYear,
      year: year,
      age: age,
      shares: totalShares,
      sharePrice: currentSharePrice,
      totalInvested: totalPrincipal,
      balance: balance,
      monthlyROC: rocAmount,
      rocReinvested: totalROCReceived,
      taxDeferred: taxDeferred,
      taxesPaid: taxesPaid,
      costBasis: totalCostBasis,
      trend: monthlyTrends[month],
    });

    // Aggregate for chart (yearly basis)
    yearlyAggregate.endBalance = balance;
    yearlyAggregate.rocReceived += rocAmount;
    yearlyAggregate.sharePrice = currentSharePrice; // Take price at end of year

    if ((month + 1) % 12 === 0 || month === totalMonths - 1) {
      chartData.push({
        year: year,
        endBalance: yearlyAggregate.endBalance,
        rocReceived: yearlyAggregate.rocReceived,
        sharePrice: yearlyAggregate.sharePrice,
      });
      yearlyAggregate = {
        year: year + 1,
        endBalance: 0,
        rocReceived: 0,
      };
    }
  }

  const finalBalance =
    monthlyData.length > 0
      ? monthlyData[monthlyData.length - 1].balance
      : totalShares * currentSharePrice;

  const finalCostBasis = investmentLots.reduce(
    (sum, lot) => sum + lot.totalCostBasis,
    0,
  );
  const targetYearCalc = currentYear + yearsToDCAStop;

  // Calculate the sum of the last 12 months of ROC
  const last12Months = monthlyData.slice(-12);
  const latestAnnualROC =
    last12Months.length > 0
      ? last12Months.reduce((sum, data) => sum + data.monthlyROC, 0)
      : 0;

  // Use the sum of monthly data for Total ROC Received to ensure absolute consistency
  const totalROC = monthlyData.reduce((sum, data) => sum + data.monthlyROC, 0);

  // Calculate capital gains tax on selling all shares
  const capitalGainsTax = calculateCapitalGainsTax(
    finalBalance,
    finalCostBasis,
  );

  // Add capital gains tax to the last month's tax
  if (monthlyData.length > 0) {
    monthlyData[monthlyData.length - 1].taxesPaid += capitalGainsTax;
    monthlyData[monthlyData.length - 1].capitalGainsTax = capitalGainsTax;
  }

  const totalAllTaxes = totalTaxesPaid + capitalGainsTax;

  // Total Invested = Out-of-pocket Principal + Reinvested ROC
  const totalInvested = totalPrincipal + totalROCReinvested;

  // Display results with dynamic font sizing
  setCardValue("totalPrincipal", totalPrincipal);
  setCardValue("totalInvested", totalInvested);
  setCardValue("totalGain", finalBalance - totalInvested + totalROC);
  setCardValue("finalBalance", finalBalance);
  setCardValue("totalROC", totalROC);
  setCardValue("latestAnnualROC", latestAnnualROC);
  setCardValue("totalTaxDeferred", totalTaxDeferred);
  setCardValue("totalROCTaxesPaid", totalTaxesPaid);
  setCardValue("capitalGainsTax", capitalGainsTax);
  setCardValue("totalTaxesPaid", totalAllTaxes);
  setCardValue("finalCostBasis", finalCostBasis);

  document.getElementById("targetYearDisplay").textContent = targetYearCalc;

  // Calculate market growth statistics
  const initialMarketPrice = qqqiPrice;
  const finalMarketPrice = currentSharePrice;
  const totalMarketGrowthPct =
    ((finalMarketPrice - initialMarketPrice) / initialMarketPrice) * 100;
  const avgAnnualMarketGrowthPct =
    (Math.pow(finalMarketPrice / initialMarketPrice, 1 / totalProjectionYears) -
      1) *
    100;

  const avgGrowthEl = document.getElementById("avgMarketGrowth");
  const totalGrowthEl = document.getElementById("totalMarketGrowth");

  avgGrowthEl.textContent = avgAnnualMarketGrowthPct.toFixed(2) + "%";
  totalGrowthEl.textContent = totalMarketGrowthPct.toFixed(2) + "%";

  if (avgAnnualMarketGrowthPct < 0) {
    avgGrowthEl.classList.add("negative");
  } else {
    avgGrowthEl.classList.remove("negative");
  }

  if (totalMarketGrowthPct < 0) {
    totalGrowthEl.classList.add("negative");
  } else {
    totalGrowthEl.classList.remove("negative");
  }

  // Update table
  const tbody = document.getElementById("yearTableBody");
  tbody.innerHTML = "";
  monthlyData.forEach((data, index) => {
    const row = tbody.insertRow();
    const isLastRow = index === monthlyData.length - 1;

    if (data.age === targetAge && data.month === 12) {
      row.classList.add("highlight");
    }
    if (data.age === sellAge && data.month === 12) {
      row.style.backgroundColor = "#e8f5e9";
      row.style.borderLeft = "3px solid #00683d";
      row.style.fontWeight = "bold";
    }
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Highlight rows where taxes were paid
    if (data.taxesPaid > 0 && data.age !== sellAge) {
      row.style.backgroundColor = "#fff5f5";
      row.style.borderLeft = "3px solid #c8102e";
    }

    // Format tax paid cell - show breakdown for last row
    let taxPaidCell = "";
    if (isLastRow && data.capitalGainsTax) {
      const rocTax = data.taxesPaid - data.capitalGainsTax;
      taxPaidCell = `<strong style="color: #c8102e;">${formatCurrency(data.taxesPaid)}</strong><br><small style="color: #666;">(ROC: ${formatCurrency(rocTax)}<br>Sale: ${formatCurrency(data.capitalGainsTax)})</small>`;
    } else if (data.taxesPaid > 0) {
      taxPaidCell = `<strong style="color: #c8102e;">${formatCurrency(data.taxesPaid)}</strong>`;
    } else {
      taxPaidCell = formatCurrency(data.taxesPaid);
    }

    row.innerHTML = `
                    <td>${monthNames[data.month - 1]}</td>
                    <td>${data.year}</td>
                    <td>${data.age}</td>
                    <td>${data.shares.toFixed(2)}</td>
                    <td>$${data.sharePrice.toFixed(2)}</td>
                    <td>${formatCurrency(data.totalInvested)}</td>
                    <td>${formatCurrency(data.balance)}</td>
                    <td>${formatCurrency(data.monthlyROC)}</td>
                    <td>${formatCurrency(data.rocReinvested)}</td>
                    <td>${formatCurrency(data.taxDeferred)}</td>
                    <td>${taxPaidCell}</td>
                    <td>${formatCurrency(data.costBasis)}</td>
                    <td>${data.trend >= 0 ? "+" : ""}${(data.trend * 100).toFixed(2)}%</td>
                `;
  });

  // Update chart with yearly data
  updateChart(chartData);

  // Store data for download
  lastMonthlyData = monthlyData;

  // Show results
  document.getElementById("results").classList.add("show");
  document
    .getElementById("results")
    .scrollIntoView({ behavior: "smooth", block: "nearest" });
};

window.downloadCSV = function downloadCSV() {
  downloadCSVUtil(lastMonthlyData);
};

window.reset = function reset() {
  document.getElementById("initialBalance").value = "0";
  document.getElementById("qqqiPrice").value = "50";
  document.getElementById("monthlyDcaAmount").value = "400";
  document.getElementById("currentAge").value = "39";
  document.getElementById("targetAge").value = "50";
  document.getElementById("sellAge").value = "60";
  document.getElementById("marketTrend").value = "random";
  document.getElementById("results").classList.remove("show");

  destroyChart();
};
