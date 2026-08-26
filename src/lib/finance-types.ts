export interface FinanceAccount {
  id: string;
  name: string;
  type: "savings" | "current" | "cash" | "wallet" | "credit-card" | "investment" | "other";
  balance: number;        // stored as integer paisa (₹1 = 100 paisa)
  currency: string;       // default "INR"
  icon?: string;
  color?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransaction {
  id: string;
  accountId: string;
  type: "income" | "expense" | "transfer";
  amount: number;         // integer paisa
  categoryId: string;
  subcategory?: string;
  merchant?: string;
  description?: string;
  date: string;           // ISO date
  paymentMethod?: string;
  isRecurring?: boolean;
  recurringRule?: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  icon: string;
  type: "income" | "expense";
  color: string;
  isDefault?: boolean;
}

export interface FinanceBudget {
  id: string;
  categoryId: string;
  amount: number;         // integer paisa
  period: "weekly" | "monthly" | "custom";
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface FinanceGoal {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;   // integer paisa
  currentAmount: number;  // integer paisa
  deadline?: string;
  linkedAccountId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceProfile {
  mode: "student" | "professional" | "general";
  currency: string;       // default "INR"
  monthlyIncome?: number; // paisa
  setupComplete: boolean;
}

export interface WealthScenario {
  id: string;
  name: string;
  expenseAmount: number; // integer paisa
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "one-time";
  annualReturn: number; // percentage (e.g. 8 for 8%)
  timeHorizon: number; // years
  reductionPercentage: number; // 0 to 100
  createdAt: string;
  updatedAt: string;
}

export interface FinanceData {
  profile?: FinanceProfile;
  accounts?: FinanceAccount[];
  transactions?: FinanceTransaction[];
  categories?: FinanceCategory[];
  budgets?: FinanceBudget[];
  goals?: FinanceGoal[];
  wealthScenarios?: WealthScenario[];
}
