import React, { useMemo, useState } from "react";
import type { FinanceData } from "../../lib/finance-types";
import {
  formatCurrency,
  calculateTotalBalance,
  calculateNetWorth,
  calculateMonthlyIncome,
  calculateMonthlyExpenses,
  calculateSavingsRate,
  calculateHealthScore,
  calculateCategorySpending,
  calculateAllTimeIncome,
  calculateAllTimeExpenses,
} from "../../lib/finance-calculations";
import { DEFAULT_EXPENSE_CATEGORIES } from "../../lib/finance-defaults";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Activity, PiggyBank, Calendar, Info, BarChart3, LineChart, Clock } from "lucide-react";

export default function FinanceDashboard({ data, onUpdate }: { data: FinanceData, onUpdate: (d: Partial<FinanceData>) => void }) {
  const accounts = data.accounts || [];
  const transactions = data.transactions || [];

  const currentMonth = new Date();
  const lastMonth = new Date();
  lastMonth.setDate(1); // prevent 31st overflow bug
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const currentMonthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

  const thisMonthIncome = calculateMonthlyIncome(transactions, currentMonth);
  const thisMonthExpenses = calculateMonthlyExpenses(transactions, currentMonth);
  const lastMonthIncome = calculateMonthlyIncome(transactions, lastMonth);
  const lastMonthExpenses = calculateMonthlyExpenses(transactions, lastMonth);
  const allTimeIncome = calculateAllTimeIncome(transactions);
  const allTimeExpenses = calculateAllTimeExpenses(transactions);

  // If this month has zero records but last month has records, default to last-month for better UX
  const hasThisMonthActivity = thisMonthIncome > 0 || thisMonthExpenses > 0;
  const hasLastMonthActivity = lastMonthIncome > 0 || lastMonthExpenses > 0;
  const initialPeriod = (!hasThisMonthActivity && hasLastMonthActivity) ? "last-month" : "this-month";

  const [period, setPeriod] = useState<"this-month" | "last-month" | "all-time">(initialPeriod);

  // Customizable Cash Flow Graph Granularity & Style
  type ChartTimeframe = "24h" | "7d" | "4w" | "6m" | "1y";
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>("6m");
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  // Active metrics based on selected period
  const activeIncome = period === "all-time"
    ? allTimeIncome
    : period === "last-month"
    ? lastMonthIncome
    : thisMonthIncome;

  const activeExpenses = period === "all-time"
    ? allTimeExpenses
    : period === "last-month"
    ? lastMonthExpenses
    : thisMonthExpenses;

  const activeSavingsRate = calculateSavingsRate(activeIncome, activeExpenses);

  // Net worth and balance (passes transactions so if account balance was unconfigured, cashflow is used)
  const netWorth = calculateNetWorth(accounts, transactions);
  const totalBalance = calculateTotalBalance(accounts, transactions);
  const { score: healthScore, status: healthStatus } = calculateHealthScore(activeIncome, activeExpenses, netWorth);

  // Period label for headings
  const periodLabel = period === "all-time"
    ? "All-Time Records"
    : period === "last-month"
    ? lastMonth.toLocaleString("default", { month: "long", year: "numeric" })
    : currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

  // Cash Flow Chart Data with fully customizable timeframes (24h, 7d, 4w, 6m, 1y)
  const cashFlowData = useMemo(() => {
    const now = new Date();
    const nowTime = now.getTime();

    if (chartTimeframe === "24h") {
      // 8 slices of 3 hours over the last 24 hours
      const points = [];
      const stepMs = 3 * 3600 * 1000;
      for (let i = 7; i >= 0; i--) {
        const start = nowTime - (i + 1) * stepMs;
        const end = nowTime - i * stepMs;
        const d = new Date(end);
        const name = d.toLocaleTimeString([], { hour: "numeric" });

        let inc = 0;
        let exp = 0;
        for (const t of transactions) {
          const tTime = t.createdAt ? new Date(t.createdAt).getTime() : new Date(t.date).getTime();
          if (tTime >= start && tTime < end) {
            if (t.type === "income") inc += (t.amount || 0);
            else if (t.type === "expense") exp += (t.amount || 0);
          }
        }
        points.push({ name, income: inc / 100, expenses: exp / 100 });
      }
      return points;
    }

    if (chartTimeframe === "7d") {
      // Last 7 days daily breakdown
      const points = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dayNum = String(d.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${dayNum}`;
        const name = i === 0 ? "Today" : d.toLocaleDateString([], { weekday: "short" });

        let inc = 0;
        let exp = 0;
        for (const t of transactions) {
          if (t.date && t.date.startsWith(dateStr)) {
            if (t.type === "income") inc += (t.amount || 0);
            else if (t.type === "expense") exp += (t.amount || 0);
          }
        }
        points.push({ name, income: inc / 100, expenses: exp / 100 });
      }
      return points;
    }

    if (chartTimeframe === "4w") {
      // Last 4 weeks breakdown
      const points = [];
      const weekMs = 7 * 24 * 3600 * 1000;
      for (let i = 3; i >= 0; i--) {
        const start = nowTime - (i + 1) * weekMs;
        const end = nowTime - i * weekMs;
        const startD = new Date(start);
        const name = `Wk ${4 - i} (${startD.getDate()} ${startD.toLocaleDateString([], { month: "short" })})`;

        let inc = 0;
        let exp = 0;
        for (const t of transactions) {
          const tTime = t.createdAt ? new Date(t.createdAt).getTime() : new Date(t.date).getTime();
          if (tTime >= start && tTime < end) {
            if (t.type === "income") inc += (t.amount || 0);
            else if (t.type === "expense") exp += (t.amount || 0);
          }
        }
        points.push({ name, income: inc / 100, expenses: exp / 100 });
      }
      return points;
    }

    if (chartTimeframe === "1y") {
      // Last 12 months breakdown
      const points = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const inc = calculateMonthlyIncome(transactions, d);
        const exp = calculateMonthlyExpenses(transactions, d);
        points.push({
          name: d.toLocaleString("default", { month: "short" }),
          income: inc / 100,
          expenses: exp / 100,
        });
      }
      return points;
    }

    // Default: "6m" (Last 6 Months)
    const points = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const inc = calculateMonthlyIncome(transactions, d);
      const exp = calculateMonthlyExpenses(transactions, d);
      points.push({
        name: d.toLocaleString("default", { month: "short" }),
        income: inc / 100,
        expenses: exp / 100,
      });
    }
    return points;
  }, [transactions, chartTimeframe]);

  const totalChartIncome = useMemo(() => cashFlowData.reduce((acc, p) => acc + p.income, 0), [cashFlowData]);
  const totalChartExpenses = useMemo(() => cashFlowData.reduce((acc, p) => acc + p.expenses, 0), [cashFlowData]);
  const netChartCashFlow = totalChartIncome - totalChartExpenses;

  // Spending Donut Data
  const donutData = useMemo(() => {
    const filterKey = period === "all-time" ? "all" : period === "last-month" ? lastMonthStr : currentMonthStr;
    const breakdown = calculateCategorySpending(transactions, filterKey);
    const allCategories = [...DEFAULT_EXPENSE_CATEGORIES, ...(data.categories || [])];
    
    return Object.entries(breakdown).map(([catId, amount]) => {
      const cat = allCategories.find((c) => c.id === catId);
      return {
        name: cat?.name || "Other",
        value: amount / 100,
        color: cat?.color || "#8884d8",
      };
    }).sort((a, b) => b.value - a.value).slice(0, 5); // top 5
  }, [transactions, data.categories, period, currentMonthStr, lastMonthStr]);

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-300">
      
      {/* ─── Header & Period Switcher ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[Roboto_Slab] text-2xl font-bold md:text-3xl" style={{ color: "var(--m-text-heading)" }}>Overview</h1>
          <p className="mt-1 text-sm flex items-center gap-1.5" style={{ color: "var(--m-text-sub)" }}>
            <Calendar size={14} className="opacity-70" />
            <span>Financial snapshot for <strong>{periodLabel}</strong></span>
          </p>
        </div>

        {/* Period Selector Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl w-max self-start sm:self-auto" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
          <button
            onClick={() => setPeriod("this-month")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              backgroundColor: period === "this-month" ? "var(--m-primary)" : "transparent",
              color: period === "this-month" ? "var(--m-primary-text)" : "var(--m-text-sub)",
            }}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriod("last-month")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative"
            style={{
              backgroundColor: period === "last-month" ? "var(--m-primary)" : "transparent",
              color: period === "last-month" ? "var(--m-primary-text)" : "var(--m-text-sub)",
            }}
          >
            Last Month
            {hasLastMonthActivity && !hasThisMonthActivity && (
              <span className="size-1.5 rounded-full bg-emerald-400 absolute top-1 right-1" />
            )}
          </button>
          <button
            onClick={() => setPeriod("all-time")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              backgroundColor: period === "all-time" ? "var(--m-primary)" : "transparent",
              color: period === "all-time" ? "var(--m-primary-text)" : "var(--m-text-sub)",
            }}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Helpful Banner when viewing last month because current month is empty */}
      {period === "last-month" && !hasThisMonthActivity && hasLastMonthActivity && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl text-xs" style={{ backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--m-primary) 25%, transparent)", color: "var(--m-text-heading)" }}>
          <Info size={16} className="shrink-0 text-emerald-500" />
          <span>
            You haven't logged expenses or income yet for this month. Currently displaying <strong>{lastMonth.toLocaleString("default", { month: "long", year: "numeric" })}</strong> records.
          </span>
        </div>
      )}

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Balance" value={formatCurrency(totalBalance)} icon={Wallet} subtitle="Cash & Accounts" />
        <SummaryCard 
          title={period === "all-time" ? "All-Time Income" : period === "last-month" ? "Last Month Income" : "Monthly Income"} 
          value={formatCurrency(activeIncome)} 
          icon={ArrowUpRight} 
        />
        <SummaryCard 
          title={period === "all-time" ? "All-Time Spending" : period === "last-month" ? "Last Month Spending" : "Monthly Spending"} 
          value={formatCurrency(activeExpenses)} 
          icon={ArrowDownRight} 
        />
        <SummaryCard title="Savings Rate" value={`${activeSavingsRate.toFixed(1)}%`} icon={PiggyBank} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* ─── Cash Flow Chart ─── */}
        <div className="lg:col-span-2 rounded-2xl p-5 minimal-surface flex flex-col justify-between" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="font-bold font-[Roboto_Slab] text-lg" style={{ color: "var(--m-text-heading)" }}>
                  Cash Flow Analytics
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--m-text-sub)" }}>
                  {chartTimeframe === "24h" && "Hourly breakdown over the last 24 hours"}
                  {chartTimeframe === "7d" && "Daily breakdown over the last 7 days"}
                  {chartTimeframe === "4w" && "Weekly breakdown over the last 4 weeks"}
                  {chartTimeframe === "6m" && "Monthly breakdown over the last 6 months"}
                  {chartTimeframe === "1y" && "Monthly breakdown over the last 12 months"}
                </p>
              </div>

              {/* Granularity & View Controls */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {/* Granularity Pills */}
                <div className="flex items-center gap-1 p-0.5 rounded-xl border text-xs" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}>
                  {(
                    [
                      { id: "24h", label: "24h" },
                      { id: "7d", label: "7d" },
                      { id: "4w", label: "4w" },
                      { id: "6m", label: "6m" },
                      { id: "1y", label: "1y" },
                    ] as const
                  ).map((tf) => (
                    <button
                      key={tf.id}
                      onClick={() => setChartTimeframe(tf.id)}
                      className="px-2.5 py-1 rounded-lg font-semibold text-xs transition-all whitespace-nowrap"
                      style={{
                        backgroundColor: chartTimeframe === tf.id ? "var(--m-primary)" : "transparent",
                        color: chartTimeframe === tf.id ? "var(--m-primary-text)" : "var(--m-text-sub)",
                      }}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                {/* Chart Style (Area vs Bar) */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-xl border text-xs" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}>
                  <button
                    onClick={() => setChartType("area")}
                    className="p-1.5 rounded-lg transition-all"
                    style={{
                      backgroundColor: chartType === "area" ? "var(--m-surface)" : "transparent",
                      color: chartType === "area" ? "var(--m-primary)" : "var(--m-text-sub)",
                    }}
                    title="Smooth Area Line Chart"
                  >
                    <LineChart size={15} />
                  </button>
                  <button
                    onClick={() => setChartType("bar")}
                    className="p-1.5 rounded-lg transition-all"
                    style={{
                      backgroundColor: chartType === "bar" ? "var(--m-surface)" : "transparent",
                      color: chartType === "bar" ? "var(--m-primary)" : "var(--m-text-sub)",
                    }}
                    title="Grouped Bar Chart"
                  >
                    <BarChart3 size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Range Metrics Summary Strip */}
            <div className="flex flex-wrap items-center gap-3 py-2 px-3 mb-4 rounded-xl text-xs" style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: "var(--m-success)" }} />
                <span style={{ color: "var(--m-text-sub)" }}>Inflow:</span>
                <strong style={{ color: "var(--m-success)" }}>₹{totalChartIncome.toLocaleString()}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: "var(--m-danger)" }} />
                <span style={{ color: "var(--m-text-sub)" }}>Outflow:</span>
                <strong style={{ color: "var(--m-danger)" }}>₹{totalChartExpenses.toLocaleString()}</strong>
              </div>
              <div className="flex items-center gap-1.5 sm:ml-auto">
                <span style={{ color: "var(--m-text-sub)" }}>Net Flow:</span>
                <strong style={{ color: netChartCashFlow >= 0 ? "var(--m-success)" : "var(--m-danger)" }}>
                  {netChartCashFlow >= 0 ? "+" : ""}₹{netChartCashFlow.toLocaleString()}
                </strong>
              </div>
            </div>
          </div>

          {/* Chart Canvas */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "area" ? (
                <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--m-success)" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="var(--m-success)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--m-danger)" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="var(--m-danger)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--m-text-sub)" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--m-text-sub)" }} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "var(--m-surface-solid)", borderColor: "var(--m-border)", borderRadius: "12px", fontSize: "12px" }}
                    itemStyle={{ color: "var(--m-text-heading)", fontWeight: "bold" }}
                    formatter={(val: number) => [`₹${val.toLocaleString()}`, undefined]}
                  />
                  <Area type="monotone" dataKey="income" name="Income" stroke="var(--m-success)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="var(--m-danger)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              ) : (
                <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--m-text-sub)" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--m-text-sub)" }} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "var(--m-surface-solid)", borderColor: "var(--m-border)", borderRadius: "12px", fontSize: "12px" }}
                    itemStyle={{ color: "var(--m-text-heading)", fontWeight: "bold" }}
                    formatter={(val: number) => [`₹${val.toLocaleString()}`, undefined]}
                  />
                  <Bar dataKey="income" name="Income" fill="var(--m-success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="var(--m-danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
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
            <p className="text-xs mb-4" style={{ color: "var(--m-text-sub)" }}>{periodLabel} categories</p>
            
            {donutData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs opacity-50">No expenses in this period</div>
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
