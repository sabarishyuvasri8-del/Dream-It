import React, { useState } from "react";
import type { FinanceData, FinanceBudget } from "../../lib/finance-types";
import { formatCurrency, toPaisa, calculateBudgetProgress } from "../../lib/finance-calculations";
import { DEFAULT_EXPENSE_CATEGORIES } from "../../lib/finance-defaults";
import { Plus, Target, X, AlertCircle } from "lucide-react";

export default function FinanceBudgets({ data, onUpdate }: { data: FinanceData, onUpdate: (d: Partial<FinanceData>) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const budgets = data.budgets || [];
  const transactions = data.transactions || [];
  const categories = [...DEFAULT_EXPENSE_CATEGORIES, ...(data.categories || [])];

  const handleDelete = (id: string) => {
    if (confirm("Delete this budget?")) {
      onUpdate({ budgets: budgets.filter((b) => b.id !== id) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[Roboto_Slab] text-2xl font-bold" style={{ color: "var(--m-text-heading)" }}>Budgets</h1>
          <p className="text-sm" style={{ color: "var(--m-text-sub)" }}>Control your spending with monthly budgets.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition hover:scale-105 w-max"
          style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
        >
          <Plus size={16} /> Create Budget
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => {
          const category = categories.find(c => c.id === budget.categoryId);
          const { spent, remaining, percentage, status } = calculateBudgetProgress(budget, transactions);
          
          let progressColor = "var(--m-success)";
          if (status === "near") progressColor = "var(--m-warning)";
          if (status === "over") progressColor = "var(--m-danger)";

          return (
            <div key={budget.id} className="rounded-2xl p-5 group relative transition-all duration-300 hover:shadow-md feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
              <button onClick={() => handleDelete(budget.id)} className="absolute top-3 right-3 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/5 transition-all" style={{ color: "var(--m-danger)" }}>
                <X size={14} />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl text-lg shadow-xs" style={{ backgroundColor: category?.color ? `${category.color}20` : "var(--m-surface-alt)", color: category?.color || "var(--m-text)" }}>
                  {category?.icon || "📊"}
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ color: "var(--m-text-heading)" }}>{category?.name || "Unknown Category"}</h3>
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--m-text-sub)" }}>{budget.period} Budget</p>
                </div>
              </div>

              <div className="mb-2">
                 <span className="font-[Roboto_Slab] font-bold text-2xl" style={{ color: "var(--m-text-heading)" }}>{formatCurrency(spent)}</span>
                 <span className="text-sm ml-1" style={{ color: "var(--m-text-sub)" }}>/ {formatCurrency(budget.amount)}</span>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full mb-3" style={{ backgroundColor: "var(--m-surface-alt)" }}>
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: progressColor }} />
              </div>

              <div className="flex items-center justify-between text-xs font-bold">
                 <span style={{ color: "var(--m-text-sub)" }}>{percentage.toFixed(0)}% used</span>
                 {status === "over" ? (
                     <span className="flex items-center gap-1" style={{ color: "var(--m-danger)" }}><AlertCircle size={12}/> Over by {formatCurrency(Math.abs(remaining))}</span>
                 ) : (
                     <span style={{ color: progressColor }}>{formatCurrency(remaining)} left</span>
                 )}
              </div>
            </div>
          );
        })}

        {budgets.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 py-16 text-center rounded-2xl minimal-surface" style={{ backgroundColor: "var(--m-surface)", border: "1px border-dashed var(--m-border)" }}>
            <Target size={32} className="mx-auto mb-3 opacity-40" style={{ color: "var(--m-text)" }} />
            <p className="font-semibold text-lg" style={{ color: "var(--m-text-heading)" }}>No budgets created</p>
            <p className="text-sm mt-1 mb-5" style={{ color: "var(--m-text-sub)" }}>Set limits on your spending categories to save more money.</p>
            <button onClick={() => setIsAdding(true)} className="text-sm font-bold underline" style={{ color: "var(--m-primary)" }}>Create your first budget</button>
          </div>
        )}
      </div>

      {isAdding && (
        <BudgetModal
          data={data}
          onClose={() => setIsAdding(false)}
          onSave={(b) => {
            onUpdate({ budgets: [...budgets, b] });
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
}

function BudgetModal({ data, onClose, onSave }: { data: FinanceData, onClose: () => void, onSave: (b: FinanceBudget) => void }) {
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<FinanceBudget["period"]>("monthly");

  const categories = [...DEFAULT_EXPENSE_CATEGORIES, ...(data.categories || [])].filter(c => c.type === "expense");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    onSave({
      id: `bud_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      categoryId,
      amount: toPaisa(numAmount),
      period,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
        <button onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full hover:bg-black/5 transition-colors">
          <X size={16} />
        </button>
        <h2 className="text-xl font-[Roboto_Slab] font-bold mb-5" style={{ color: "var(--m-text-heading)" }}>Create Budget</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Category</label>
            <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }}>
              <option value="">Select category...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Budget Amount (₹)</label>
            <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border px-3 py-2.5 text-base outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Period</label>
            <select required value={period} onChange={(e) => setPeriod(e.target.value as any)} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <button type="submit" className="w-full rounded-xl py-3 mt-6 text-sm font-bold shadow-md transition hover:opacity-90" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
            Save Budget
          </button>
        </form>
      </div>
    </div>
  );
}
