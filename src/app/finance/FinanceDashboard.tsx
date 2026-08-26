import React, { useMemo } from "react";
import type { FinanceData } from "../../lib/finance-types";
import { formatCurrency, calculateTotalBalance, calculateNetWorth, calculateMonthlyIncome, calculateMonthlyExpenses, calculateSavingsRate, calculateHealthScore, calculateCategorySpending } from "../../lib/finance-calculations";
import { DEFAULT_EXPENSE_CATEGORIES } from "../../lib/finance-defaults";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Activity, PiggyBank } from "lucide-react";

export default function FinanceDashboard({ data, onUpdate }: { data: FinanceData, onUpdate: (d: Partial<FinanceData>) => void }) {
  const accounts = data.accounts || [];
  const transactions = data.transactions || [];
  const currentMonth = new Date();

  // Summary Cards Data
  const netWorth = calculateNetWorth(accounts);
  const totalBalance = calculateTotalBalance(accounts);
  const monthlyIncome = calculateMonthlyIncome(transactions, currentMonth);
  const monthlyExpenses = calculateMonthlyExpenses(transactions, currentMonth);
  const savingsRate = calculateSavingsRate(monthlyIncome, monthlyExpenses);
  const { score: healthScore, status: healthStatus } = calculateHealthScore(monthlyIncome, monthlyExpenses, netWorth);

  // Cash Flow Chart Data (Last 6 Months)
  const cashFlowData = useMemo(() => {
    const dataPoints = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7);
      const income = calculateMonthlyIncome(transactions, d);
      const expenses = calculateMonthlyExpenses(transactions, d);
      dataPoints.push({
        name: d.toLocaleString("default", { month: "short" }),
        income: income / 100, // convert paisa to display units for chart
        expenses: expenses / 100,
      });
    }
    return dataPoints;
  }, [transactions]);

  // Spending Donut Data
  const donutData = useMemo(() => {
    const monthStr = currentMonth.toISOString().slice(0, 7);
    const breakdown = calculateCategorySpending(transactions, monthStr);
    const allCategories = [...DEFAULT_EXPENSE_CATEGORIES, ...(data.categories || [])];
    
    return Object.entries(breakdown).map(([catId, amount]) => {
      const cat = allCategories.find((c) => c.id === catId);
      return {
        name: cat?.name || "Unknown",
        value: amount / 100,
        color: cat?.color || "#8884d8",
      };
    }).sort((a, b) => b.value - a.value).slice(0, 5); // top 5
  }, [transactions, data.categories]);

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-300">
      
      {/* ─── Header ─── */}
      <div>
        <h1 className="font-[Roboto_Slab] text-2xl font-bold md:text-3xl" style={{ color: "var(--m-text-heading)" }}>Overview</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--m-text-sub)" }}>Your financial snapshot for {currentMonth.toLocaleString("default", { month: "long", year: "numeric" })}.</p>
      </div>

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Net Worth" value={formatCurrency(netWorth)} icon={Wallet} trend="+2.4%" positive />
        <SummaryCard title="Monthly Income" value={formatCurrency(monthlyIncome)} icon={ArrowUpRight} />
        <SummaryCard title="Monthly Spending" value={formatCurrency(monthlyExpenses)} icon={ArrowDownRight} trend="-1.2%" positive />
        <SummaryCard title="Savings Rate" value={`${savingsRate.toFixed(1)}%`} icon={PiggyBank} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* ─── Cash Flow Chart ─── */}
        <div className="lg:col-span-2 rounded-2xl p-5 minimal-surface" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
          <div className="mb-4">
            <h2 className="font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>Cash Flow Analytics</h2>
            <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>Income vs Expenses over the last 6 months</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--m-success)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--m-success)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--m-danger)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--m-danger)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--m-text-sub)" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--m-text-sub)" }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--m-surface-solid)", borderColor: "var(--m-border)", borderRadius: "12px", fontSize: "12px" }}
                  itemStyle={{ color: "var(--m-text-heading)", fontWeight: "bold" }}
                  formatter={(val: number) => [`₹${val.toLocaleString()}`, undefined]}
                />
                <Area type="monotone" dataKey="income" name="Income" stroke="var(--m-success)" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="var(--m-danger)" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── Sidebar Cards ─── */}
        <div className="space-y-6">
          
          {/* Health Score */}
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
            <div className="absolute top-0 right-0 p-4 opacity-10" style={{ color: "var(--m-primary)" }}>
              <Activity size={80} />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-muted)" }}>Financial Health</p>
            <div className="flex items-end gap-2">
              <h3 className="font-[Roboto_Slab] text-4xl font-bold" style={{ color: "var(--m-text-heading)" }}>{healthScore}</h3>
              <span className="text-sm pb-1" style={{ color: "var(--m-text-sub)" }}>/ 100</span>
            </div>
            <p className="mt-2 text-sm font-medium flex items-center gap-1.5" style={{ color: healthScore >= 80 ? "var(--m-success)" : healthScore >= 60 ? "var(--m-primary)" : "var(--m-warning)" }}>
              <span className="size-2 rounded-full bg-current" /> {healthStatus}
            </p>
          </div>

          {/* Spending Breakdown Donut */}
          <div className="rounded-2xl p-5 minimal-surface" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
            <h2 className="font-bold font-[Roboto_Slab] mb-1" style={{ color: "var(--m-text-heading)" }}>Top Spending</h2>
            <p className="text-xs mb-4" style={{ color: "var(--m-text-sub)" }}>This month's categories</p>
            
            {donutData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs opacity-50">No expenses this month</div>
            ) : (
              <div className="relative h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: number) => [`₹${val.toLocaleString()}`, undefined]}
                      contentStyle={{ backgroundColor: "var(--m-surface-solid)", borderColor: "var(--m-border)", borderRadius: "8px", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text for donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs" style={{ color: "var(--m-text-sub)" }}>Total</span>
                  <span className="font-bold text-sm" style={{ color: "var(--m-text-heading)" }}>₹{(donutData.reduce((a, b) => a + b.value, 0)).toLocaleString()}</span>
                </div>
              </div>
            )}
            
            <div className="mt-4 space-y-2">
              {donutData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shadow-xs" style={{ backgroundColor: d.color }} />
                    <span style={{ color: "var(--m-text-sub)" }}>{d.name}</span>
                  </div>
                  <span className="font-bold" style={{ color: "var(--m-text-heading)" }}>₹{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, trend, positive }: { title: string, value: string, icon: any, trend?: string, positive?: boolean }) {
  return (
    <div className="rounded-2xl p-5 minimal-surface transition-all duration-300 hover:shadow-md feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>{title}</p>
        <div className="grid size-8 place-items-center rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)", color: "var(--m-primary)" }}>
          <Icon size={16} />
        </div>
      </div>
      <h3 className="font-[Roboto_Slab] text-2xl font-bold truncate" style={{ color: "var(--m-text-heading)" }}>{value}</h3>
      {trend && (
        <p className="mt-2 text-[10px] font-bold flex items-center gap-1" style={{ color: positive ? "var(--m-success)" : "var(--m-danger)" }}>
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{trend}</span>
          <span className="font-normal opacity-70" style={{ color: "var(--m-text-sub)" }}>vs last month</span>
        </p>
      )}
    </div>
  );
}
