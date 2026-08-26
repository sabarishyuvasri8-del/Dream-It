import React, { useState, useMemo, useCallback } from "react";
import type { FinanceData, WealthScenario } from "../../lib/finance-types";
import {
  formatCurrency,
  toPaisa,
  toRupees,
  convertToMonthlyAmount,
  convertToAnnualAmount,
  calculateFutureValue,
  generateWealthProjectionData,
  calculateCategorySpending,
} from "../../lib/finance-calculations";
import { DEFAULT_EXPENSE_CATEGORIES } from "../../lib/finance-defaults";
import {
  Sparkles,
  TrendingUp,
  Zap,
  Target,
  ChevronRight,
  Save,
  Trash2,
  Info,
  Lightbulb,
  Shuffle,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Presets ───────────────────────────────────────────────────────
type Frequency = "daily" | "weekly" | "monthly" | "yearly" | "one-time";

interface Preset {
  icon: string;
  label: string;
  amount: number; // in rupees (display unit)
  frequency: Frequency;
}

const BUILT_IN_PRESETS: Preset[] = [
  { icon: "☕", label: "Coffee", amount: 200, frequency: "daily" },
  { icon: "🍔", label: "Takeout", amount: 500, frequency: "daily" },
  { icon: "🚗", label: "Rides", amount: 800, frequency: "daily" },
  { icon: "🥤", label: "Snacks", amount: 100, frequency: "daily" },
  { icon: "🎮", label: "Gaming", amount: 150, frequency: "daily" },
  { icon: "🛍️", label: "Shopping", amount: 5000, frequency: "monthly" },
  { icon: "📺", label: "Subscriptions", amount: 2000, frequency: "monthly" },
];

const RETURN_PRESETS = [
  { label: "Savings", rate: 4, tag: "Low risk" },
  { label: "Conservative", rate: 6, tag: "Debt funds" },
  { label: "Moderate", rate: 8, tag: "Balanced" },
  { label: "Growth", rate: 10, tag: "Equity" },
  { label: "Aggressive", rate: 12, tag: "High equity" },
  { label: "High-growth", rate: 15, tag: "Scenario" },
];

const FREQ_LABELS: Record<Frequency, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
  "one-time": "one-time",
};

// ─── Component ─────────────────────────────────────────────────────
export default function FinanceSimulator({
  data,
  onUpdate,
}: {
  data: FinanceData;
  onUpdate: (d: Partial<FinanceData>) => void;
}) {
  // Simulator state
  const [amount, setAmount] = useState(200);
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [annualReturn, setAnnualReturn] = useState(8);
  const [timeHorizon, setTimeHorizon] = useState(10);
  const [reductionPct, setReductionPct] = useState(100);
  const [expenseName, setExpenseName] = useState("Coffee");

  // Saved scenarios
  const savedScenarios = data.wealthScenarios || [];

  // ─── Derived calculations ────────────────────────────────────────
  const redirectedAmount = amount * (reductionPct / 100);

  const annualEquivalent = convertToAnnualAmount(redirectedAmount, frequency);
  const monthlyEquivalent = convertToMonthlyAmount(redirectedAmount, frequency);

  const result = useMemo(
    () => calculateFutureValue(redirectedAmount, frequency, annualReturn, timeHorizon),
    [redirectedAmount, frequency, annualReturn, timeHorizon]
  );

  const chartData = useMemo(
    () => generateWealthProjectionData(redirectedAmount, frequency, annualReturn, timeHorizon),
    [redirectedAmount, frequency, annualReturn, timeHorizon]
  );

  const multiplier =
    result.totalInvested > 0
      ? (result.futureValue / result.totalInvested).toFixed(1)
      : "0.0";

  const contributionPct =
    result.futureValue > 0
      ? Math.round((result.totalInvested / result.futureValue) * 100)
      : 100;

  // ─── Crossover insight ───────────────────────────────────────────
  const crossoverYear = useMemo(() => {
    if (annualReturn <= 0) return null;
    for (const pt of chartData) {
      if (pt.year > 0 && pt.wealth > pt.invested * 1.5) return pt.year;
    }
    return null;
  }, [chartData, annualReturn]);

  // ─── Goal connection ────────────────────────────────────────────
  const goalInsight = useMemo(() => {
    const goals = data.goals || [];
    if (goals.length === 0 || monthlyEquivalent <= 0) return null;
    const goal = goals.find((g) => g.currentAmount < g.targetAmount);
    if (!goal) return null;
    const remaining = toRupees(goal.targetAmount - goal.currentAmount);
    const monthsToGoal = Math.ceil(remaining / monthlyEquivalent);
    if (monthsToGoal <= 0 || monthsToGoal > 120) return null;
    return { name: goal.name, icon: goal.icon, months: monthsToGoal };
  }, [data.goals, monthlyEquivalent]);

  // ─── User spending presets (from transaction history) ────────────
  const userSpendingPresets = useMemo(() => {
    const txns = data.transactions || [];
    if (txns.length === 0) return [];
    const now = new Date();
    const monthStr = now.toISOString().slice(0, 7);
    const breakdown = calculateCategorySpending(txns, monthStr);
    const allCats = [...DEFAULT_EXPENSE_CATEGORIES, ...(data.categories || [])];
    return Object.entries(breakdown)
      .map(([catId, totalPaisa]) => {
        const cat = allCats.find((c) => c.id === catId);
        return {
          icon: cat?.icon || "💸",
          label: cat?.name || catId,
          amount: Math.round(toRupees(totalPaisa)),
          frequency: "monthly" as Frequency,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [data.transactions, data.categories]);

  // ─── Handlers ────────────────────────────────────────────────────
  const applyPreset = useCallback((p: Preset) => {
    setAmount(p.amount);
    setFrequency(p.frequency);
    setExpenseName(p.label);
    setReductionPct(100);
  }, []);

  const handleSaveScenario = () => {
    const scenario: WealthScenario = {
      id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: expenseName || "Untitled",
      expenseAmount: toPaisa(amount),
      frequency,
      annualReturn,
      timeHorizon,
      reductionPercentage: reductionPct,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onUpdate({ wealthScenarios: [...savedScenarios, scenario] });
  };

  const handleDeleteScenario = (id: string) => {
    onUpdate({ wealthScenarios: savedScenarios.filter((s) => s.id !== id) });
  };

  const handleLoadScenario = (s: WealthScenario) => {
    setAmount(toRupees(s.expenseAmount));
    setFrequency(s.frequency);
    setAnnualReturn(s.annualReturn);
    setTimeHorizon(s.timeHorizon);
    setReductionPct(s.reductionPercentage);
    setExpenseName(s.name);
  };

  const handleSurpriseMe = () => {
    if (userSpendingPresets.length > 0) {
      const random = userSpendingPresets[Math.floor(Math.random() * userSpendingPresets.length)];
      applyPreset(random);
      setReductionPct(25);
    } else {
      const random = BUILT_IN_PRESETS[Math.floor(Math.random() * BUILT_IN_PRESETS.length)];
      applyPreset(random);
    }
  };

  // ─── Chart tooltip ──────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const invested = payload.find((p: any) => p.dataKey === "invested")?.value || 0;
    const wealth = payload.find((p: any) => p.dataKey === "wealth")?.value || 0;
    return (
      <div
        className="rounded-xl p-3 text-xs shadow-lg border"
        style={{
          backgroundColor: "var(--m-surface)",
          borderColor: "var(--m-border)",
          color: "var(--m-text-heading)",
        }}
      >
        <p className="font-bold mb-1.5">Year {label}</p>
        <p style={{ color: "var(--m-text-sub)" }}>
          Money Spent:{" "}
          <span className="font-semibold" style={{ color: "var(--m-text-heading)" }}>
            {formatCurrency(invested)}
          </span>
        </p>
        <p style={{ color: "var(--m-text-sub)" }}>
          Potential Wealth:{" "}
          <span className="font-semibold" style={{ color: "var(--m-success)" }}>
            {formatCurrency(wealth)}
          </span>
        </p>
        {wealth > invested && (
          <p className="mt-1 font-medium" style={{ color: "var(--m-primary)" }}>
            +{formatCurrency(wealth - invested)} est. growth
          </p>
        )}
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div
            className="grid size-10 place-items-center rounded-xl"
            style={{
              backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
              color: "var(--m-primary)",
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h1
              className="font-[Roboto_Slab] text-2xl font-bold"
              style={{ color: "var(--m-text-heading)" }}
            >
              What-If Wealth Simulator
            </h1>
            <p className="text-sm" style={{ color: "var(--m-text-sub)" }}>
              See what small financial decisions could become over time.
            </p>
          </div>
        </div>
      </div>

      {/* ── Preset Chips ─────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--m-text-muted)" }}>
          Quick Scenarios
        </p>
        <div className="flex flex-wrap gap-2">
          {BUILT_IN_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold border transition-all hover:scale-105"
              style={{
                borderColor:
                  expenseName === p.label && amount === p.amount
                    ? "var(--m-primary)"
                    : "var(--m-border)",
                backgroundColor:
                  expenseName === p.label && amount === p.amount
                    ? "color-mix(in srgb, var(--m-primary) 12%, transparent)"
                    : "var(--m-surface)",
                color: "var(--m-text-heading)",
              }}
            >
              <span>{p.icon}</span>
              <span>₹{p.amount.toLocaleString("en-IN")}/{FREQ_LABELS[p.frequency]}</span>
            </button>
          ))}
          <button
            onClick={handleSurpriseMe}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold border transition-all hover:scale-105"
            style={{
              borderColor: "var(--m-border)",
              backgroundColor: "var(--m-surface)",
              color: "var(--m-primary)",
            }}
          >
            <Shuffle size={12} /> Surprise Me
          </button>
        </div>
      </div>

      {/* ── User Spending Presets ─────────────────────────────────── */}
      {userSpendingPresets.length > 0 && (
        <div
          className="rounded-2xl p-5 border"
          style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--m-text-muted)" }}>
            <Lightbulb size={12} /> Based on Your Spending
          </p>
          <div className="flex flex-wrap gap-2">
            {userSpendingPresets.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  applyPreset(p);
                  setReductionPct(25);
                }}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold border transition-all hover:shadow-sm"
                style={{
                  borderColor: "var(--m-border)",
                  backgroundColor: "var(--m-surface-alt)",
                  color: "var(--m-text-heading)",
                }}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
                <span className="opacity-60">₹{p.amount.toLocaleString("en-IN")}/mo</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] mt-2 italic" style={{ color: "var(--m-text-muted)" }}>
            What if you redirected 25% of this spending?
          </p>
        </div>
      )}

      {/* ── Control Panel ────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 border space-y-6"
        style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}
      >
        {/* Expense Input Row */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>
              Expense Name
            </label>
            <input
              type="text"
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              placeholder="e.g. Coffee"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--m-input-bg)",
                borderColor: "var(--m-border)",
                color: "var(--m-text-heading)",
              }}
            />
          </div>
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>
              Amount (₹)
            </label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--m-input-bg)",
                borderColor: "var(--m-border)",
                color: "var(--m-text-heading)",
              }}
            />
          </div>
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--m-input-bg)",
                borderColor: "var(--m-border)",
                color: "var(--m-text-heading)",
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="one-time">One-time</option>
            </select>
          </div>
        </div>

        {/* Equivalence display */}
        {frequency !== "one-time" && (
          <div
            className="flex flex-wrap gap-4 text-xs font-medium rounded-xl px-4 py-3"
            style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text-sub)" }}
          >
            <span>
              ₹{redirectedAmount.toLocaleString("en-IN")}/{FREQ_LABELS[frequency]}
            </span>
            <span style={{ color: "var(--m-text-muted)" }}>≈</span>
            <span>₹{Math.round(monthlyEquivalent).toLocaleString("en-IN")}/month</span>
            <span style={{ color: "var(--m-text-muted)" }}>≈</span>
            <span>₹{Math.round(annualEquivalent).toLocaleString("en-IN")}/year</span>
          </div>
        )}

        {/* Reduction slider (only for recurring) */}
        {frequency !== "one-time" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold" style={{ color: "var(--m-text-sub)" }}>
                Redirect to Investment
              </label>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: "var(--m-primary)" }}
              >
                {reductionPct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={reductionPct}
              onChange={(e) => setReductionPct(Number(e.target.value))}
              className="w-full accent-[var(--m-primary)] h-2 rounded-full"
              style={{ accentColor: "var(--m-primary)" }}
            />
            <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--m-text-muted)" }}>
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Annual return */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold" style={{ color: "var(--m-text-sub)" }}>
              Estimated Annual Return
            </label>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--m-primary)" }}
            >
              {annualReturn}%
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={annualReturn}
            onChange={(e) => setAnnualReturn(Number(e.target.value))}
            className="w-full h-2 rounded-full"
            style={{ accentColor: "var(--m-primary)" }}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {RETURN_PRESETS.map((rp) => (
              <button
                key={rp.rate}
                onClick={() => setAnnualReturn(rp.rate)}
                className="rounded-lg px-2.5 py-1 text-[10px] font-bold border transition-all"
                style={{
                  borderColor:
                    annualReturn === rp.rate ? "var(--m-primary)" : "var(--m-border)",
                  backgroundColor:
                    annualReturn === rp.rate
                      ? "color-mix(in srgb, var(--m-primary) 12%, transparent)"
                      : "transparent",
                  color:
                    annualReturn === rp.rate ? "var(--m-primary)" : "var(--m-text-muted)",
                }}
              >
                {rp.rate}%
              </button>
            ))}
          </div>
        </div>

        {/* Time horizon */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold" style={{ color: "var(--m-text-sub)" }}>
              Time Horizon
            </label>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--m-primary)" }}
            >
              {timeHorizon} {timeHorizon === 1 ? "Year" : "Years"}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={40}
            step={1}
            value={timeHorizon}
            onChange={(e) => setTimeHorizon(Number(e.target.value))}
            className="w-full h-2 rounded-full"
            style={{ accentColor: "var(--m-primary)" }}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[1, 5, 10, 15, 20, 30, 40].map((y) => (
              <button
                key={y}
                onClick={() => setTimeHorizon(y)}
                className="rounded-lg px-2.5 py-1 text-[10px] font-bold border transition-all"
                style={{
                  borderColor:
                    timeHorizon === y ? "var(--m-primary)" : "var(--m-border)",
                  backgroundColor:
                    timeHorizon === y
                      ? "color-mix(in srgb, var(--m-primary) 12%, transparent)"
                      : "transparent",
                  color:
                    timeHorizon === y ? "var(--m-primary)" : "var(--m-text-muted)",
                }}
              >
                {y}Y
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Primary Results ──────────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Total Cash Spent */}
        <div
          className="rounded-2xl p-5 border transition-all"
          style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-muted)" }}>
            Total Cash Spent
          </p>
          <h2
            className="font-[Roboto_Slab] text-2xl font-bold tabular-nums"
            style={{ color: "var(--m-text-heading)" }}
          >
            {formatCurrency(Math.round(result.totalInvested))}
          </h2>
          <p className="text-[11px] mt-1" style={{ color: "var(--m-text-sub)" }}>
            Direct out-of-pocket cost over {timeHorizon} {timeHorizon === 1 ? "year" : "years"}
          </p>
        </div>

        {/* Potential Wealth */}
        <div
          className="rounded-2xl p-5 border transition-all"
          style={{
            backgroundColor: "var(--m-surface)",
            borderColor: "var(--m-primary)",
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--m-primary) 20%, transparent)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-primary)" }}>
            Potential Wealth
          </p>
          <h2
            className="font-[Roboto_Slab] text-2xl font-bold tabular-nums"
            style={{ color: "var(--m-success)" }}
          >
            {formatCurrency(Math.round(result.futureValue))}
          </h2>
          <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--m-primary)" }}>
            +{formatCurrency(Math.round(result.estimatedGrowth))} estimated compound growth
          </p>
        </div>

        {/* Wealth Multiplier */}
        <div
          className="rounded-2xl p-5 border transition-all"
          style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-muted)" }}>
            Wealth Multiplier
          </p>
          <h2
            className="font-[Roboto_Slab] text-2xl font-bold tabular-nums"
            style={{ color: "var(--m-text-heading)" }}
          >
            {multiplier}×
          </h2>
          <p className="text-[11px] mt-1" style={{ color: "var(--m-text-sub)" }}>
            Potential wealth vs direct spending
          </p>
        </div>
      </div>

      {/* ── Compound Interest Breakdown ──────────────────────────── */}
      <div
        className="rounded-2xl p-5 border"
        style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}
      >
        <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "var(--m-text-muted)" }}>
          Compound Interest Breakdown
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-[11px] mb-1" style={{ color: "var(--m-text-sub)" }}>Your Contributions</p>
            <p className="font-[Roboto_Slab] font-bold text-lg tabular-nums" style={{ color: "var(--m-text-heading)" }}>
              {formatCurrency(Math.round(result.totalInvested))}
            </p>
          </div>
          <div>
            <p className="text-[11px] mb-1" style={{ color: "var(--m-text-sub)" }}>Estimated Growth</p>
            <p className="font-[Roboto_Slab] font-bold text-lg tabular-nums" style={{ color: "var(--m-success)" }}>
              {formatCurrency(Math.round(result.estimatedGrowth))}
            </p>
          </div>
          <div>
            <p className="text-[11px] mb-1" style={{ color: "var(--m-text-sub)" }}>Potential Future Value</p>
            <p className="font-[Roboto_Slab] font-bold text-lg tabular-nums" style={{ color: "var(--m-primary)" }}>
              {formatCurrency(Math.round(result.futureValue))}
            </p>
          </div>
        </div>
        {/* Visual bar */}
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: "var(--m-text-sub)" }}>
              <span>Contributed</span>
              <span>{contributionPct}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--m-surface-alt)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${contributionPct}%`,
                  backgroundColor: "var(--m-primary)",
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: "var(--m-text-sub)" }}>
              <span>Growth</span>
              <span>{100 - contributionPct}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--m-surface-alt)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${100 - contributionPct}%`,
                  backgroundColor: "var(--m-success)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Growth Projection Chart ──────────────────────────────── */}
      <div
        className="rounded-2xl p-5 border"
        style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-[Roboto_Slab] text-lg font-bold" style={{ color: "var(--m-text-heading)" }}>
            📈 Growth Projection
          </h3>
          <button
            onClick={handleSaveScenario}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold border transition-all hover:scale-105"
            style={{
              borderColor: "var(--m-border)",
              color: "var(--m-primary)",
              backgroundColor: "var(--m-surface-alt)",
            }}
          >
            <Save size={11} /> Save Scenario
          </button>
        </div>
        <p className="text-[11px] mb-5" style={{ color: "var(--m-text-sub)" }}>
          Money spent vs. potential wealth if invested
        </p>

        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--m-success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--m-success)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--m-text-muted)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--m-text-muted)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--m-border)" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 10, fill: "var(--m-text-muted)" }}
                tickFormatter={(v: number) => `Yr ${v}`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--m-text-muted)" }}
                tickFormatter={(v: number) => `₹${(v / 100).toLocaleString("en-IN")}`}
                width={70}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={30}
                formatter={(value: string) =>
                  value === "invested" ? "Money Spent" : "Potential Wealth"
                }
              />
              <Area
                type="monotone"
                dataKey="invested"
                stroke="var(--m-text-muted)"
                strokeWidth={2}
                fill="url(#investedGrad)"
                name="invested"
                animationDuration={800}
              />
              <Area
                type="monotone"
                dataKey="wealth"
                stroke="var(--m-success)"
                strokeWidth={2}
                fill="url(#wealthGrad)"
                name="wealth"
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Insights ─────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Crossover insight */}
        {crossoverYear && (
          <div
            className="rounded-2xl p-5 border"
            style={{
              backgroundColor: "color-mix(in srgb, var(--m-primary) 5%, var(--m-surface))",
              borderColor: "color-mix(in srgb, var(--m-primary) 30%, var(--m-border))",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} style={{ color: "var(--m-primary)" }} />
              <p className="text-xs font-bold" style={{ color: "var(--m-primary)" }}>
                Compounding Insight
              </p>
            </div>
            <p className="text-sm" style={{ color: "var(--m-text-heading)" }}>
              After approximately <strong>{crossoverYear} years</strong>, the estimated invested
              value begins significantly exceeding the money you would have spent.
            </p>
          </div>
        )}

        {/* Goal connection */}
        {goalInsight && (
          <div
            className="rounded-2xl p-5 border"
            style={{
              backgroundColor: "color-mix(in srgb, var(--m-success) 5%, var(--m-surface))",
              borderColor: "color-mix(in srgb, var(--m-success) 30%, var(--m-border))",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} style={{ color: "var(--m-success)" }} />
              <p className="text-xs font-bold" style={{ color: "var(--m-success)" }}>
                Goal Connection
              </p>
            </div>
            <p className="text-sm" style={{ color: "var(--m-text-heading)" }}>
              Redirecting ₹{Math.round(monthlyEquivalent).toLocaleString("en-IN")}/month could
              help you reach your{" "}
              <strong>
                {goalInsight.icon} {goalInsight.name}
              </strong>{" "}
              goal in approximately <strong>{goalInsight.months} months</strong>.
            </p>
          </div>
        )}
      </div>

      {/* ── Saved Scenarios ──────────────────────────────────────── */}
      {savedScenarios.length > 0 && (
        <div
          className="rounded-2xl p-5 border"
          style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "var(--m-text-muted)" }}>
            Saved Scenarios
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedScenarios.map((s) => {
              const sResult = calculateFutureValue(
                toRupees(s.expenseAmount) * (s.reductionPercentage / 100),
                s.frequency,
                s.annualReturn,
                s.timeHorizon
              );
              return (
                <div
                  key={s.id}
                  className="rounded-xl p-4 border group relative cursor-pointer transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: "var(--m-surface-alt)",
                    borderColor: "var(--m-border)",
                  }}
                  onClick={() => handleLoadScenario(s)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteScenario(s.id);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--m-danger)" }}
                  >
                    <Trash2 size={12} />
                  </button>
                  <p className="font-bold text-sm mb-1" style={{ color: "var(--m-text-heading)" }}>
                    {s.name}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--m-text-sub)" }}>
                    ₹{toRupees(s.expenseAmount).toLocaleString("en-IN")}/{FREQ_LABELS[s.frequency]} · {s.annualReturn}% · {s.timeHorizon}Y
                  </p>
                  <p className="text-xs font-bold mt-2" style={{ color: "var(--m-success)" }}>
                    → {formatCurrency(Math.round(sResult.futureValue))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3 text-[11px]"
        style={{
          backgroundColor: "color-mix(in srgb, var(--m-warning) 8%, var(--m-surface))",
          color: "var(--m-text-sub)",
          border: "1px solid color-mix(in srgb, var(--m-warning) 25%, var(--m-border))",
        }}
      >
        <Info size={14} className="shrink-0 mt-0.5" style={{ color: "var(--m-warning)" }} />
        <p>
          <strong>Estimated scenario — not a guarantee of investment returns.</strong> All values
          are hypothetical projections based on assumed annual returns with monthly compounding.
          Actual investments can lose value. This tool is for educational and planning purposes
          only — it does not constitute financial advice.
        </p>
      </div>
    </div>
  );
}
