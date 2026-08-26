import React, { useState } from "react";
import type { FinanceData, FinanceTransaction } from "../../../lib/finance-types";
import { toPaisa } from "../../../lib/finance-calculations";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../../../lib/finance-defaults";
import { X } from "lucide-react";

export function TransactionModal({ 
  data, 
  onClose, 
  onSave, 
  defaultType = "expense" 
}: { 
  data: FinanceData, 
  onClose: () => void, 
  onSave: (t: FinanceTransaction) => void,
  defaultType?: "expense" | "income"
}) {
  const [type, setType] = useState<"expense" | "income">(defaultType);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const allCategories = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...(data.categories || [])];
  const activeCategories = allCategories.filter((c) => c.type === type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    onSave({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      accountId: data.accounts?.[0]?.id || "default",
      type,
      amount: toPaisa(numAmount),
      categoryId,
      merchant,
      date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
        <button onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full hover:bg-black/5 transition-colors">
          <X size={16} />
        </button>
        <h2 className="text-xl font-[Roboto_Slab] font-bold mb-5" style={{ color: "var(--m-text-heading)" }}>
          {type === "income" ? "Add Income" : "Add Expense"}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex rounded-xl p-1 mb-6" style={{ backgroundColor: "var(--m-surface-alt)" }}>
            <button type="button" onClick={() => setType("expense")} className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${type === "expense" ? "shadow-sm" : "opacity-60"}`} style={type === "expense" ? { backgroundColor: "var(--m-surface)", color: "var(--m-text-heading)" } : { color: "var(--m-text-sub)" }}>Expense</button>
            <button type="button" onClick={() => setType("income")} className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${type === "income" ? "shadow-sm" : "opacity-60"}`} style={type === "income" ? { backgroundColor: "var(--m-surface)", color: "var(--m-text-heading)" } : { color: "var(--m-text-sub)" }}>Income</button>
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Amount (₹)</label>
            <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border px-3 py-2.5 text-base outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>{type === "expense" ? "Merchant / Title" : "Source / Title"}</label>
            <input type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder={type === "expense" ? "e.g. Swiggy, Amazon" : "e.g. Salary, Client"} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Category</label>
              <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }}>
                <option value="">Select...</option>
                {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
            </div>
          </div>

          <button type="submit" className="w-full rounded-xl py-3 mt-6 text-sm font-bold shadow-md transition hover:opacity-90" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
            Save {type === "income" ? "Income" : "Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}
