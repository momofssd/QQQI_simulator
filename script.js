let rocChart = null;
let lastMonthlyData = []; // Store data for CSV export

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function setCardValue(elementId, value) {
  const element = document.getElementById(elementId);
  const formattedValue = formatCurrency(value);
  element.textContent = formattedValue;

  // Apply negative class for red coloring if value is below zero
  if (value < 0) {
    element.classList.add("negative");
  } else {
    element.classList.remove("negative");
  }

  // Dynamically adjust font size based on length
  element.classList.remove("small", "xsmall");
  if (formattedValue.length > 11) {
    element.classList.add("xsmall");
  } else if (formattedValue.length > 8) {
    element.classList.add("small");
  }
}

function generateMarketTrends(months, trendType, initialPrice = 50) {
  const trends = [];
  const years = Math.ceil(months / 12);
  let simulatedPrice = initialPrice;

  for (let y = 0; y < years; y++) {
    let annualTarget;

    if (trendType === "bullish") {
      // Bullish Bias: 90% growth (5% to 15%), 10% retreat (-10% to -20%)
      if (Math.random() < 0.1) {
        annualTarget = -(Math.random() * 0.1 + 0.1); // -10% to -20%
      } else {
        annualTarget = Math.random() * 0.1 + 0.05; // 5% to 15%
      }
    } else if (trendType === "bearish") {
      // Bearish Bias: 80% decline (0% to -14%), 20% recovery (+10% to +20%)
      if (Math.random() < 0.2) {
        annualTarget = Math.random() * 0.1 + 0.1; // +10% to +20%
      } else {
        annualTarget = -(Math.random() * 0.14); // 0% to -14%
      }
    } else if (trendType === "random") {
      // Mean-Reverting Random: Fluctuates but returns to initial price
      // If price is above initial, bias towards negative; if below, bias towards positive.
      const deviation = (simulatedPrice - initialPrice) / initialPrice;
      const meanReversionStrength = 0.3; // How strongly it pulls back
      const randomVolatility = Math.random() * 0.3 - 0.15; // ±15% natural annual volatility

      annualTarget = randomVolatility - deviation * meanReversionStrength;
    } else {
      annualTarget = 0;
    }

    // Distribute annual target into 12 months with noise
    const monthlyBase = annualTarget / 12;
    for (let m = 0; m < 12; m++) {
      if (trends.length < months) {
        // For Neutral trend, no noise, price stays exactly the same
        const noise = trendType === "neutral" ? 0 : Math.random() * 0.04 - 0.02;
        const monthlyVolatility = monthlyBase + noise;
        trends.push(monthlyVolatility);
        simulatedPrice *= 1 + monthlyVolatility;
      }
    }
  }
  return trends;
}

function calculate() {
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

  // Internal target ROC is based on historical QQQI averages (~1% per month)
  const targetMonthlyROC = 0.01166; // approx 14% annual

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

    // Calculate monthly ROC distribution - ALWAYS PAID regardless of age
    // Reflected as an option selling strategy (VRP model):
    // ROC = Premium Collected (based on Implied Vol) - Option Payouts (based on Realized Vol)
    const balance = totalShares * currentSharePrice;

    // 1. Simulate Implied Volatility (IV) for the month
    // IV is typically higher than realized vol (VRP)
    const monthlyIV = targetMonthlyROC * (1 + (Math.random() * 0.6 - 0.2));

    // 2. Realized Volatility (RV) is the absolute monthly price change
    const monthlyRV = Math.abs(monthlyVolatility);

    // 3. ROC Amount is the Premium minus any losses from the move exceeding IV
    // Payout on ITM options reduces distributions (VRP model)
    const netPremiumFactor = Math.max(
      0.001,
      monthlyIV - Math.max(0, monthlyRV - monthlyIV) * 0.4,
    );

    // Scale to match the user's targeted annual ROC rate on average
    const rocAmount = balance * netPremiumFactor;
    const rocPerShare = rocAmount / totalShares;
    totalROCReceived += rocAmount;

    let rocReinvested = 0;
    let taxDeferred = 0;
    let taxesPaid = 0;

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
        if (
          lot.costBasisPerShare === 0 &&
          rocPerShare > basisReductionPerShare
        ) {
          const excessROCPerShare = rocPerShare - basisReductionPerShare;
          const taxableGain = excessROCPerShare * lot.shares;

          // Section 1256 treatment: 60% long-term (15%), 40% short-term (24%)
          const longTermRate = 0.15;
          const shortTermRate = 0.24;
          const blendedRate = 0.6 * longTermRate + 0.4 * shortTermRate;

          taxesPaid += taxableGain * blendedRate;
        }
      } else {
        // Cost basis already at zero - all ROC for this lot is taxable
        const taxableGain = lotROC;

        // Section 1256 treatment: 60% long-term (15%), 40% short-term (24%)
        const longTermRate = 0.15;
        const shortTermRate = 0.24;
        const blendedRate = 0.6 * longTermRate + 0.4 * shortTermRate;

        taxesPaid += taxableGain * blendedRate;
      }
    }

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

  // Calculate the average of the last 12 months of ROC
  const last12Months = monthlyData.slice(-12);
  const last12MonthROCAvg =
    last12Months.length > 0
      ? last12Months.reduce((sum, data) => sum + data.monthlyROC, 0) /
        last12Months.length
      : 0;

  // Use the sum of monthly data for Total ROC Received to ensure absolute consistency
  const totalROC = monthlyData.reduce((sum, data) => sum + data.monthlyROC, 0);

  // Calculate capital gains tax on selling all shares
  const capitalGain = finalBalance - finalCostBasis; // Sale proceeds minus adjusted cost basis
  const longTermCapitalGainsRate = 0.2; // 20% for high earners (can be 15% or 0% based on income)
  const capitalGainsTax =
    capitalGain > 0 ? capitalGain * longTermCapitalGainsRate : 0;

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
  setCardValue("last12MonthROCAvg", last12MonthROCAvg);
  setCardValue("totalTaxDeferred", totalTaxDeferred);
  setCardValue("totalROCTaxesPaid", totalTaxesPaid);
  setCardValue("capitalGainsTax", capitalGainsTax);
  setCardValue("totalTaxesPaid", totalAllTaxes);
  setCardValue("finalCostBasis", finalCostBasis);

  document.getElementById("targetYearDisplay").textContent = targetYearCalc;

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
}

function downloadCSV() {
  if (!lastMonthlyData || lastMonthlyData.length === 0) return;

  const headers = [
    "Month",
    "Year",
    "Age",
    "Shares",
    "Share Price",
    "Total Invested (Prin)",
    "Total Balance",
    "Monthly ROC",
    "Total ROC (Cumul.)",
    "Tax Deferred",
    "Taxes Paid",
    "Cost Basis",
    "Market Trend",
  ];

  const csvRows = [headers.join(",")];

  lastMonthlyData.forEach((data) => {
    const row = [
      data.month,
      data.year,
      data.age,
      data.shares.toFixed(2),
      data.sharePrice.toFixed(2),
      data.totalInvested.toFixed(2),
      data.balance.toFixed(2),
      data.monthlyROC.toFixed(2),
      data.rocReinvested.toFixed(2),
      data.taxDeferred.toFixed(2),
      data.taxesPaid.toFixed(2),
      data.costBasis.toFixed(2),
      (data.trend * 100).toFixed(2) + "%",
    ];
    csvRows.push(row.join(","));
  });

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "QQQI_Simulation_Results.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function updateChart(yearlyData) {
  const ctx = document.getElementById("rocChart").getContext("2d");

  if (rocChart) {
    rocChart.destroy();
  }

  rocChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: yearlyData.map((d) => d.year),
      datasets: [
        {
          label: "Total Balance",
          data: yearlyData.map((d) => d.endBalance),
          borderColor: "#00683d",
          backgroundColor: "rgba(0, 104, 61, 0.1)",
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Annual ROC",
          data: yearlyData.map((d) => d.rocReceived),
          borderColor: "#6cae4f",
          backgroundColor: "rgba(108, 174, 79, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Share Price",
          data: yearlyData.map((d) => d.sharePrice),
          borderColor: "#c8102e",
          borderDash: [5, 5],
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            font: {
              size: 13,
              weight: "600",
              family: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            },
            padding: 15,
            color: "#333",
          },
        },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleFont: {
            size: 14,
            weight: "600",
          },
          bodyFont: {
            size: 13,
          },
          padding: 12,
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (context.dataset.yAxisID === "y1") {
                label += new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 2,
                }).format(context.parsed.y);
              } else {
                label += formatCurrency(context.parsed.y);
              }
              return label;
            },
          },
        },
      },
      scales: {
        y: {
          type: "linear",
          display: true,
          position: "left",
          beginAtZero: true,
          title: {
            display: true,
            text: "Balance / ROC ($)",
          },
          ticks: {
            callback: function (value) {
              return formatCurrency(value);
            },
            font: {
              size: 11,
            },
            color: "#666",
          },
          grid: {
            color: "rgba(0, 0, 0, 0.06)",
            drawBorder: false,
          },
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          beginAtZero: false,
          title: {
            display: true,
            text: "Share Price ($)",
          },
          ticks: {
            callback: function (value) {
              return "$" + value.toFixed(2);
            },
            font: {
              size: 11,
            },
            color: "#c8102e",
          },
          grid: {
            drawOnChartArea: false,
          },
        },
        x: {
          ticks: {
            font: {
              size: 11,
            },
            maxRotation: 45,
            minRotation: 45,
            color: "#666",
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function reset() {
  document.getElementById("initialBalance").value = "0";
  document.getElementById("qqqiPrice").value = "50";
  document.getElementById("monthlyDcaAmount").value = "400";
  document.getElementById("currentAge").value = "39";
  document.getElementById("targetAge").value = "50";
  document.getElementById("sellAge").value = "60";
  document.getElementById("marketTrend").value = "random";
  document.getElementById("results").classList.remove("show");

  if (rocChart) {
    rocChart.destroy();
    rocChart = null;
  }
}
