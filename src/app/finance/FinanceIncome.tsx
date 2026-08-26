import React, { useMemo, useState } from "react";
import type { FinanceData, FinanceTransaction } from "../../lib/finance-types";
import { formatCurrency, calculateMonthlyIncome } from "../../lib/finance-calculations";
import { DEFAULT_INCOME_CATEGORIES } from "../../lib/finance-defaults";
import { Banknote, TrendingUp, X, ArrowRightLeft, Plus } from "lucide-react";
import { TransactionModal } from "./components/TransactionModal";

export default function FinanceIncome({ data, onUpdate }: { data: FinanceData, onUpdate: (d: Partial<FinanceData>) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const transactions = data.transactions || [];
  const incomeTransactions = useMemo(() => transactions.filter(t => t.type === "income").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [transactions]);
  const categories = [...DEFAULT_INCOME_CATEGORIES, ...(data.categories || [])];

  const currentMonth = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const thisMonthIncome = calculateMonthlyIncome(transactions, currentMonth);
  const lastMonthIncome = calculateMonthlyIncome(transactions, lastMonth);
  
  const trend = lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;

  const handleDelete = (id: string) => {
    if (confirm("Delete this income record?")) {
      onUpdate({ transactions: transactions.filter((t) => t.id !== id) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[Roboto_Slab] text-2xl font-bold" style={{ color: "var(--m-text-heading)" }}>Income</h1>
          <p className="text-sm" style={{ color: "var(--m-text-sub)" }}>Track your earnings and cash inflows.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition hover:scale-105 w-max"
          style={{ backgroundColor: "var(--m-success)", color: "#ffffff" }}
        >
          <Plus size={16} /> Add Income
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 minimal-surface flex items-center justify-between feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
           <div>
               <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-muted)" }}>This Month's Income</p>
               <h2 className="font-[Roboto_Slab] text-3xl font-bold" style={{ color: "var(--m-success)" }}>{formatCurrency(thisMonthIncome)}</h2>
               <p className="text-xs mt-2 font-medium flex items-center gap-1" style={{ color: trend >= 0 ? "var(--m-success)" : "var(--m-danger)" }}>
                 <TrendingUp size={12} className={trend < 0 ? "rotate-180" : ""} />
                 {trend > 0 ? "+" : ""}{trend.toFixed(1)}% vs last month
               </p>
           </div>
           <div className="grid size-12 place-items-center rounded-xl" style={{ backgroundColor: "color-mix(in srgb, var(--m-success) 15%, transparent)", color: "var(--m-success)" }}>
              <Banknote size={24} />
           </div>
        </div>
        <div className="rounded-2xl p-5 minimal-surface flex items-center justify-between feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
           <div>
               <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-muted)" }}>Last Month's Income</p>
               <h2 className="font-[Roboto_Slab] text-3xl font-bold opacity-80" style={{ color: "var(--m-text-heading)" }}>{formatCurrency(lastMonthIncome)}</h2>
           </div>
        </div>
      </div>

      <h2 className="font-[Roboto_Slab] text-xl font-bold mt-8" style={{ color: "var(--m-text-heading)" }}>Income History</h2>
      
      <div className="rounded-2xl border minimal-surface overflow-hidden shadow-sm" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}>
        {incomeTransactions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full mb-3" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text-muted)" }}>
              <ArrowRightLeft size={20} />
            </div>
            <p className="font-semibold text-lg" style={{ color: "var(--m-text-heading)" }}>No income recorded yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--m-text-sub)" }}>Go to the Transactions tab to add your first income.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--m-border-light)" }}>
            {incomeTransactions.map((t) => {
              const cat = categories.find((c) => c.id === t.categoryId);
              return (
                <div key={t.id} className="flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="grid size-10 place-items-center rounded-xl text-lg shrink-0 shadow-xs" style={{ backgroundColor: cat?.color ? `${cat.color}20` : "var(--m-surface-alt)", color: cat?.color || "var(--m-text)" }}>
                      {cat?.icon || "💵"}
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: "var(--m-text-heading)" }}>{t.merchant || t.description || cat?.name || "Income"}</p>
                      <p className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--m-text-sub)" }}>
                        <span>{cat?.name}</span>
                        <span className="size-1 rounded-full bg-current opacity-30" />
                        <span>{new Date(t.date).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--m-success)" }}>
                        +{formatCurrency(t.amount)}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-black/10 transition-all text-xs" style={{ color: "var(--m-danger)" }} title="Delete">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAdding && (
        <TransactionModal
          data={data}
          defaultType="income"
          onClose={() => setIsAdding(false)}
          onSave={(t) => {
            onUpdate({ transactions: [t, ...transactions] });
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
}
