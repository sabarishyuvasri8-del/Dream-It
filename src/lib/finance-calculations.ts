import type { FinanceAccount, FinanceTransaction, FinanceBudget, FinanceGoal } from "./finance-types";

export function toPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toRupees(paisa: number): number {
  return paisa / 100;
}

export function formatCurrency(paisa: number, currency: string = "INR"): string {
  const rupees = toRupees(paisa);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function calculateAllTimeIncome(transactions: FinanceTransaction[]): number {
  return (transactions || [])
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + (t.amount || 0), 0);
}

export function calculateAllTimeExpenses(transactions: FinanceTransaction[]): number {
  return (transactions || [])
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + (t.amount || 0), 0);
}

export function calculateNetWorth(accounts: FinanceAccount[], transactions: FinanceTransaction[] = []): number {
  const accountSum = (accounts || []).reduce((acc, account) => {
    if (account.type === "credit-card") {
      return acc - Math.abs(account.balance || 0);
    }
    return acc + (account.balance || 0);
  }, 0);

  // If user hasn't explicitly entered account balances, use net transaction cashflow
  if (accountSum === 0 && transactions && transactions.length > 0) {
    const netTx = calculateAllTimeIncome(transactions) - calculateAllTimeExpenses(transactions);
    return Math.max(0, netTx);
  }
  return accountSum;
}

export function calculateTotalBalance(accounts: FinanceAccount[], transactions: FinanceTransaction[] = []): number {
  const accountBalance = (accounts || []).reduce((acc, account) => {
    if (account.type !== "credit-card" && account.type !== "other") {
      return acc + (account.balance || 0);
    }
    return acc;
  }, 0);

  if (accountBalance === 0 && transactions && transactions.length > 0) {
    const netTx = calculateAllTimeIncome(transactions) - calculateAllTimeExpenses(transactions);
    return Math.max(0, netTx);
  }
  return accountBalance;
}

export function calculateMonthlyIncome(transactions: FinanceTransaction[], month: Date): number {
  const d = new Date(month.getTime());
  const year = d.getFullYear();
  const monthNum = String(d.getMonth() + 1).padStart(2, "0");
  const monthStr = `${year}-${monthNum}`; // Reliable YYYY-MM
  return (transactions || [])
    .filter((t) => t.type === "income" && t.date && t.date.startsWith(monthStr))
    .reduce((acc, t) => acc + (t.amount || 0), 0);
}

export function calculateMonthlyExpenses(transactions: FinanceTransaction[], month: Date): number {
  const d = new Date(month.getTime());
  const year = d.getFullYear();
  const monthNum = String(d.getMonth() + 1).padStart(2, "0");
  const monthStr = `${year}-${monthNum}`; // Reliable YYYY-MM
  return (transactions || [])
    .filter((t) => t.type === "expense" && t.date && t.date.startsWith(monthStr))
    .reduce((acc, t) => acc + (t.amount || 0), 0);
}

export function calculatePeriodIncome(transactions: FinanceTransaction[], period: "all" | string): number {
  if (period === "all") return calculateAllTimeIncome(transactions);
  return (transactions || [])
    .filter((t) => t.type === "income" && t.date && t.date.startsWith(period))
    .reduce((acc, t) => acc + (t.amount || 0), 0);
}

export function calculatePeriodExpenses(transactions: FinanceTransaction[], period: "all" | string): number {
  if (period === "all") return calculateAllTimeExpenses(transactions);
  return (transactions || [])
    .filter((t) => t.type === "expense" && t.date && t.date.startsWith(period))
    .reduce((acc, t) => acc + (t.amount || 0), 0);
}

export function calculateSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  const savings = income - expenses;
  if (savings <= 0) return 0;
  return (savings / income) * 100;
}

export function calculateCategorySpending(transactions: FinanceTransaction[], monthOrPeriod: string) {
  const expenses = (transactions || []).filter((t) => {
    if (t.type !== "expense") return false;
    if (!monthOrPeriod || monthOrPeriod === "all") return true;
    return t.date && t.date.startsWith(monthOrPeriod);
  });
  const breakdown: Record<string, number> = {};
  expenses.forEach((t) => {
    breakdown[t.categoryId] = (breakdown[t.categoryId] || 0) + (t.amount || 0);
  });
  return breakdown;
}

export function calculateBudgetProgress(budget: FinanceBudget, transactions: FinanceTransaction[]) {
    // Basic implementation: only monthly budgets currently handled for simplicity
    const currentMonth = new Date().toISOString().slice(0, 7);
    const spent = transactions
        .filter((t) => t.type === "expense" && t.categoryId === budget.categoryId && t.date.startsWith(currentMonth))
        .reduce((acc, t) => acc + t.amount, 0);
    
    const remaining = budget.amount - spent;
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
    
    let status: "under" | "near" | "over" = "under";
    if (percentage > 100) status = "over";
    else if (percentage > 85) status = "near";
    
    return { spent, remaining, percentage, status };
}

export function calculateHealthScore(income: number, expenses: number, netWorth: number) {
    let score = 50; // base score
    
    // Savings rate contribution (up to 30 points)
    const savingsRate = calculateSavingsRate(income, expenses);
    score += Math.min(30, (savingsRate / 50) * 30);
    
    // Positive net worth contribution (up to 20 points)
    if (netWorth > 0) {
        score += 10;
        if (netWorth > income * 3) score += 10; // 3 months income saved
    }

    score = Math.min(100, Math.max(0, Math.round(score)));

    let status = "Needs Attention";
    if (score >= 80) status = "Excellent";
    else if (score >= 60) status = "Good";
    else if (score >= 40) status = "Fair";

    return { score, status };
}

// ============================================================================
// WHAT-IF WEALTH SIMULATOR CALCULATIONS
// ============================================================================

export function convertToMonthlyAmount(amount: number, frequency: "daily" | "weekly" | "monthly" | "yearly" | "one-time"): number {
    switch (frequency) {
        case "daily": return (amount * 365) / 12;
        case "weekly": return (amount * 52) / 12;
        case "monthly": return amount;
        case "yearly": return amount / 12;
        case "one-time": return amount; // For one-time, this is just the principal
        default: return amount;
    }
}

export function convertToAnnualAmount(amount: number, frequency: "daily" | "weekly" | "monthly" | "yearly" | "one-time"): number {
    switch (frequency) {
        case "daily": return amount * 365;
        case "weekly": return amount * 52;
        case "monthly": return amount * 12;
        case "yearly": return amount;
        case "one-time": return amount;
        default: return amount;
    }
}

export function calculateFutureValue(
    amount: number, 
    frequency: "daily" | "weekly" | "monthly" | "yearly" | "one-time",
    annualReturnRate: number, // e.g. 8 for 8%
    years: number
): { totalInvested: number; futureValue: number; estimatedGrowth: number } {
    const rate = annualReturnRate / 100;

    if (frequency === "one-time") {
        // FV = P * (1 + r)^n
        const futureValue = amount * Math.pow(1 + rate, years);
        return {
            totalInvested: amount,
            futureValue,
            estimatedGrowth: futureValue - amount
        };
    } else {
        // Future Value of an Annuity (monthly compounding assumption)
        const monthlyAmount = convertToMonthlyAmount(amount, frequency);
        const totalInvested = monthlyAmount * 12 * years;
        
        let futureValue = 0;
        if (rate === 0) {
            futureValue = totalInvested;
        } else {
            const monthlyRate = rate / 12;
            const months = years * 12;
            // FV = P * [((1 + r)^n - 1) / r]
            futureValue = monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
        }

        return {
            totalInvested,
            futureValue,
            estimatedGrowth: futureValue - totalInvested
        };
    }
}

export function generateWealthProjectionData(
    amount: number, 
    frequency: "daily" | "weekly" | "monthly" | "yearly" | "one-time",
    annualReturnRate: number, 
    years: number
) {
    const data = [];
    const monthlyAmount = frequency === "one-time" ? 0 : convertToMonthlyAmount(amount, frequency);
    const rate = annualReturnRate / 100;
    const monthlyRate = rate / 12;

    let currentWealth = frequency === "one-time" ? amount : 0;
    let currentInvested = frequency === "one-time" ? amount : 0;

    data.push({
        year: 0,
        invested: currentInvested,
        wealth: currentWealth
    });

    for (let y = 1; y <= years; y++) {
        if (frequency === "one-time") {
            currentWealth = amount * Math.pow(1 + rate, y);
        } else {
            const months = y * 12;
            currentInvested = monthlyAmount * months;
            if (rate === 0) {
                currentWealth = currentInvested;
            } else {
                currentWealth = monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
            }
        }

        data.push({
            year: y,
            invested: Math.round(currentInvested),
            wealth: Math.round(currentWealth)
        });
    }

    return data;
}
