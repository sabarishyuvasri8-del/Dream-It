import React, { useState } from "react";
import { useTheme } from "../../lib/ThemeContext";
import type { FinanceData } from "../../lib/finance-types";
import { LayoutDashboard, Wallet, Target, CreditCard, Banknote, List, PiggyBank, ArrowRightLeft, Sparkles, Bot } from "lucide-react";

import FinanceDashboard from "./FinanceDashboard";
import FinanceTransactions from "./FinanceTransactions";
import FinanceIncome from "./FinanceIncome";
import FinanceBudgets from "./FinanceBudgets";
import FinanceGoals from "./FinanceGoals";
import FinanceAccounts from "./FinanceAccounts";
import FinanceSimulator from "./FinanceSimulator";
import FinanceCoach from "./FinanceCoach";

interface FinanceAppProps {
  financeData?: FinanceData;
  onUpdateFinance: (data: FinanceData) => void;
}

type FinanceNav = "Overview" | "Transactions" | "Income" | "Budgets" | "Goals" | "Accounts" | "Simulator" | "Coach";

export default function FinanceApp({ financeData, onUpdateFinance }: FinanceAppProps) {
  const { themeConfig } = useTheme();
  const [activeNav, setActiveNav] = useState<FinanceNav>("Overview");

  // Ensure default structure if missing
  const data: FinanceData = {
    profile: financeData?.profile || { mode: "student", currency: "INR", setupComplete: false },
    accounts: financeData?.accounts || [],
    transactions: financeData?.transactions || [],
    categories: financeData?.categories || [],
    budgets: financeData?.budgets || [],
    goals: financeData?.goals || [],
    wealthScenarios: financeData?.wealthScenarios || [],
  };

  const handleUpdate = (newData: Partial<FinanceData>) => {
    onUpdateFinance({ ...data, ...newData });
  };

  const navItems: { id: FinanceNav; label: string; icon: any }[] = [
    { id: "Overview", label: "Overview", icon: LayoutDashboard },
    { id: "Transactions", label: "Transactions", icon: ArrowRightLeft },
    { id: "Income", label: "Income", icon: Banknote },
    { id: "Budgets", label: "Budgets", icon: Target },
    { id: "Goals", label: "Goals", icon: PiggyBank },
    { id: "Accounts", label: "Accounts", icon: Wallet },
    { id: "Simulator", label: "Simulator", icon: Sparkles },
    { id: "Coach", label: "AI Coach", icon: Bot },
  ];

  return (
    <div className="flex flex-col lg:flex-row w-full font-[DM_Sans] min-h-[60vh]">
      {/* Finance Sub-Sidebar */}
      <div 
        className="lg:w-56 flex-shrink-0 border-b lg:border-b-0 lg:border-r p-4 space-y-2 lg:sticky lg:top-0 lg:self-start" 
        style={{ borderColor: "var(--m-border-light)", backgroundColor: "var(--m-surface)" }}
      >
        <div className="mb-4 px-2 pt-1">
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
            Dream It Money
          </h2>
        </div>
        
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap"
              style={{
                backgroundColor: activeNav === item.id ? "var(--m-primary)" : "transparent",
                color: activeNav === item.id ? "var(--m-primary-text)" : "var(--m-text-sub)",
                fontWeight: activeNav === item.id ? 600 : 500,
              }}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Area — flows naturally, no internal scroll trap */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8" style={{ backgroundColor: "var(--m-bg)" }}>
        <div className="mx-auto max-w-5xl">
          {activeNav === "Overview" && <FinanceDashboard data={data} onUpdate={handleUpdate} />}
          {activeNav === "Transactions" && <FinanceTransactions data={data} onUpdate={handleUpdate} />}
          {activeNav === "Income" && <FinanceIncome data={data} onUpdate={handleUpdate} />}
          {activeNav === "Budgets" && <FinanceBudgets data={data} onUpdate={handleUpdate} />}
          {activeNav === "Goals" && <FinanceGoals data={data} onUpdate={handleUpdate} />}
          {activeNav === "Accounts" && <FinanceAccounts data={data} onUpdate={handleUpdate} />}
          {activeNav === "Simulator" && <FinanceSimulator data={data} onUpdate={handleUpdate} />}
          {activeNav === "Coach" && <FinanceCoach data={data} />}
        </div>
      </div>
    </div>
  );
}

