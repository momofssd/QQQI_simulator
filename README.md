# QQQI DCA Simulator

A specialized tool designed to simulate Dollar Cost Averaging (DCA) into **QQQI (NEOS Nasdaq-100 High Income ETF)**, with a specific focus on its unique Return of Capital (ROC) tax treatment and reinvestment logic.

## What is QQQI?

QQQI is an ETF that seeks to provide high income through an options strategy on the Nasdaq-100 index. A significant portion of its distributions is often classified as **Return of Capital (ROC)**.

### QQQI Tax Efficiency (The "Deferral Rule")

Unlike traditional dividends which are taxed in the year they are received, QQQI's ROC distributions follow a specific tax deferral path:

1.  **Basis Reduction**: When you receive ROC, it is not immediately taxable. Instead, it reduces your **cost basis** for that specific "lot" of shares.
2.  **Tax Deferral**: Taxes are deferred until you sell the shares or until your cost basis reaches **$0**.
3.  **Section 1256 Treatment**: Once the cost basis of a lot is reduced to $0, any additional ROC received for that lot is taxed as a capital gain. This gain follows the **60/40 rule** (60% long-term, 40% short-term capital gains rates), which often results in a lower "blended" tax rate than ordinary income.

## Simulator Logic

This simulator calculates the long-term growth of a QQQI position by modeling the following:

### 1. Market Simulation

- **Volatility & Trends**: Uses a randomized or trend-based monthly return generator.
- **QQQI Beta**: QQQI typically exhibits lower volatility than the raw Nasdaq-100. The simulator applies a beta (default 0.88) to QQQI's price movement relative to market trends.

### 2. Share Tracking (FIFO Method)

- The simulator tracks every purchase (Initial investment, monthly DCA, and ROC reinvestments) as individual **Investment Lots**.
- This is crucial because each lot has its own unique cost basis that is reduced independently by ROC distributions.

### 3. ROC and Reinvestment

- **Monthly Distribution**: Calculated based on the annual ROC rate set by the user.
- **Reinvestment**: If enabled (before target age), the full ROC amount is used to purchase new shares at the current market price, creating a new investment lot.
- **Compounding**: Reinvested ROC increases the total share count, which in turn increases future ROC distributions.

### 4. Taxation Engine (`taxation.js`)

- **Step-by-Step Deferral**: For every month, the simulator calculates the distribution per share. It then iterates through all lots using **FIFO (First-In, First-Out)** logic.
- **Cost Basis Tracking**: It reduces the `costBasisPerShare` for each lot.
- **Excess ROC**: If a lot's basis is already $0, the simulator calculates the tax due on that month's distribution using a blended Section 1256 rate.
- **Final Sale Tax**: Upon the "Sell Age," the simulator calculates the final capital gains tax on the remaining balance minus the remaining total cost basis.

## How to Use

1.  **Initial Setup**: Enter your starting balance and current QQQI price.
2.  **Timeline**: Set your current age, target age (when DCA and reinvestment stops), and sell age (for final liquidation calculation).
3.  **Market Assumptions**: Choose a market trend and expected annual ROC percentage.
4.  **Calculate**: View the monthly breakdown of share growth, tax deferral amounts, and the impact of the $0 cost basis "cliff."

## Technical Implementation

- **Frontend**: Vanilla JavaScript, HTML5, CSS3.
- **Charts**: Chart.js for visualizing balance growth and income.
- **Modules**: Modular JS architecture for market logic, taxation, and UI updates.

---

_Disclaimer: This simulator is for educational purposes only and does not constitute financial or tax advice. Always consult with a qualified tax professional regarding Section 1256 and ROC tax treatments._
