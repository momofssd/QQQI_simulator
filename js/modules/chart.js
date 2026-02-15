import { formatCurrency } from "./ui.js";

let rocChart = null;

export function updateChart(yearlyData) {
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

export function destroyChart() {
  if (rocChart) {
    rocChart.destroy();
    rocChart = null;
  }
}
