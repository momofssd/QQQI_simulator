export function downloadCSV(data) {
  if (!data || data.length === 0) return;

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

  data.forEach((d) => {
    const row = [
      d.month,
      d.year,
      d.age,
      d.shares.toFixed(2),
      d.sharePrice.toFixed(2),
      d.totalInvested.toFixed(2),
      d.balance.toFixed(2),
      d.monthlyROC.toFixed(2),
      d.rocReinvested.toFixed(2),
      d.taxDeferred.toFixed(2),
      d.taxesPaid.toFixed(2),
      d.costBasis.toFixed(2),
      (d.trend * 100).toFixed(2) + "%",
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
