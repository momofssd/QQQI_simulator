export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function setCardValue(elementId, value) {
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
