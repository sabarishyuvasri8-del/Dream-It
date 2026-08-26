import type { FinanceCategory } from "./finance-types";

export const DEFAULT_EXPENSE_CATEGORIES: FinanceCategory[] = [
  { id: "cat_food", name: "Food & Dining", icon: "🍔", type: "expense", color: "#f59e0b", isDefault: true },
  { id: "cat_transport", name: "Transport", icon: "🚗", type: "expense", color: "#3b82f6", isDefault: true },
  { id: "cat_shopping", name: "Shopping", icon: "🛍️", type: "expense", color: "#ec4899", isDefault: true },
  { id: "cat_bills", name: "Bills & Utilities", icon: "📄", type: "expense", color: "#8b5cf6", isDefault: true },
  { id: "cat_education", name: "Education", icon: "📚", type: "expense", color: "#10b981", isDefault: true },
  { id: "cat_entertainment", name: "Entertainment", icon: "🎬", type: "expense", color: "#f43f5e", isDefault: true },
  { id: "cat_health", name: "Health & Fitness", icon: "💊", type: "expense", color: "#14b8a6", isDefault: true },
  { id: "cat_housing", name: "Housing", icon: "🏠", type: "expense", color: "#6366f1", isDefault: true },
  { id: "cat_travel", name: "Travel", icon: "✈️", type: "expense", color: "#0ea5e9", isDefault: true },
  { id: "cat_personal", name: "Personal Care", icon: "💅", type: "expense", color: "#d946ef", isDefault: true },
  { id: "cat_investments", name: "Investments", icon: "📈", type: "expense", color: "#84cc16", isDefault: true },
  { id: "cat_other", name: "Other", icon: "📦", type: "expense", color: "#64748b", isDefault: true },
];

export const DEFAULT_INCOME_CATEGORIES: FinanceCategory[] = [
  { id: "cat_salary", name: "Salary", icon: "💼", type: "income", color: "#22c55e", isDefault: true },
  { id: "cat_freelance", name: "Freelance", icon: "💻", type: "income", color: "#8b5cf6", isDefault: true },
  { id: "cat_allowance", name: "Allowance", icon: "💵", type: "income", color: "#f59e0b", isDefault: true },
  { id: "cat_interest", name: "Interest", icon: "🏦", type: "income", color: "#3b82f6", isDefault: true },
  { id: "cat_business", name: "Business", icon: "🏢", type: "income", color: "#06b6d4", isDefault: true },
  { id: "cat_other_income", name: "Other", icon: "✨", type: "income", color: "#64748b", isDefault: true },
];
