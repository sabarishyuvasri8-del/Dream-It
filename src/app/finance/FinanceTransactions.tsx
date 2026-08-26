import React, { useState, useMemo } from "react";
import type { FinanceData, FinanceTransaction, FinanceCategory } from "../../lib/finance-types";
import { formatCurrency, toPaisa } from "../../lib/finance-calculations";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../../lib/finance-defaults";
import { Plus, Search, Calendar, Filter, MoreHorizontal, ArrowDownCircle, ArrowUpCircle, X, ArrowRightLeft } from "lucide-react";
import { TransactionModal } from "./components/TransactionModal";

export default function FinanceTransactions({ data, onUpdate }: { data: FinanceData, onUpdate: (d: Partial<FinanceData>) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");

  const transactions = data.transactions || [];
  const categories = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...(data.categories || [])];

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => typeFilter === "all" || t.type === typeFilter)
      .filter((t) => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        const cat = categories.find((c) => c.id === t.categoryId)?.name || "";
        return (
          t.merchant?.toLowerCase().includes(s) ||
          t.description?.toLowerCase().includes(s) ||
          cat.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, typeFilter, searchTerm, categories]);

  const handleDelete = (id: string) => {
    if (confirm("Delete this transaction?")) {
      onUpdate({ transactions: transactions.filter((t) => t.id !== id) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[Roboto_Slab] text-2xl font-bold" style={{ color: "var(--m-text-heading)" }}>Transactions</h1>
          <p className="text-sm" style={{ color: "var(--m-text-sub)" }}>Track and manage your expenses and income.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition hover:scale-105 w-max"
          style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
        >
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={{ color: "var(--m-text)" }} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border py-2 pl-9 pr-4 text-sm outline-none"
            style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text)" }}
          />
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text)" }}
          >
            <option value="all">All Types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border minimal-surface overflow-hidden shadow-sm" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}>
        {filteredTransactions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full mb-3" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text-muted)" }}>
              <ArrowRightLeft size={20} />
            </div>
            <p className="font-semibold text-lg" style={{ color: "var(--m-text-heading)" }}>No transactions found</p>
            <p className="text-sm mt-1" style={{ color: "var(--m-text-sub)" }}>Start tracking your spending by adding a transaction.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--m-border-light)" }}>
            {filteredTransactions.map((t) => {
              const cat = categories.find((c) => c.id === t.categoryId);
              const isIncome = t.type === "income";
              return (
                <div key={t.id} className="flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="grid size-10 place-items-center rounded-xl text-lg shrink-0 shadow-xs" style={{ backgroundColor: cat?.color ? `${cat.color}20` : "var(--m-surface-alt)", color: cat?.color || "var(--m-text)" }}>
                      {cat?.icon || "💰"}
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: "var(--m-text-heading)" }}>{t.merchant || t.description || cat?.name || "Transaction"}</p>
                      <p className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--m-text-sub)" }}>
                        <span>{cat?.name}</span>
                        <span className="size-1 rounded-full bg-current opacity-30" />
                        <span>{new Date(t.date).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: isIncome ? "var(--m-success)" : "var(--m-text-heading)" }}>
                        {isIncome ? "+" : "-"}{formatCurrency(t.amount)}
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
