import React, { useState } from "react";
import type { FinanceData, FinanceAccount } from "../../lib/finance-types";
import { formatCurrency, calculateTotalBalance, calculateNetWorth } from "../../lib/finance-calculations";
import { Plus, Wallet, Landmark, CreditCard, PiggyBank, Briefcase, ChevronRight, X } from "lucide-react";

export default function FinanceAccounts({ data, onUpdate }: { data: FinanceData, onUpdate: (d: Partial<FinanceData>) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const accounts = data.accounts || [];

  const totalBalance = calculateTotalBalance(accounts);
  const netWorth = calculateNetWorth(accounts);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "savings": return <PiggyBank size={20} />;
      case "current": return <Landmark size={20} />;
      case "credit-card": return <CreditCard size={20} />;
      case "investment": return <Briefcase size={20} />;
      case "wallet": return <Wallet size={20} />;
      default: return <Wallet size={20} />;
    }
  };

  const getAccountColor = (type: string) => {
    switch (type) {
      case "savings": return "#3b82f6";
      case "current": return "#10b981";
      case "credit-card": return "#f43f5e";
      case "investment": return "#8b5cf6";
      case "wallet": return "#f59e0b";
      default: return "#64748b";
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this account? Associated transactions will not be deleted, but may show as orphaned.")) {
      onUpdate({ accounts: accounts.filter((a) => a.id !== id) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[Roboto_Slab] text-2xl font-bold" style={{ color: "var(--m-text-heading)" }}>Accounts</h1>
          <p className="text-sm" style={{ color: "var(--m-text-sub)" }}>Manage your bank accounts, wallets, and cards.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition hover:scale-105 w-max"
          style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
        >
          <Plus size={16} /> Add Account
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 minimal-surface" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-muted)" }}>Total Balance (Cash & Bank)</p>
          <h2 className="font-[Roboto_Slab] text-3xl font-bold" style={{ color: "var(--m-text-heading)" }}>{formatCurrency(totalBalance)}</h2>
        </div>
        <div className="rounded-2xl p-5 minimal-surface" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-muted)" }}>Net Worth</p>
          <h2 className="font-[Roboto_Slab] text-3xl font-bold" style={{ color: "var(--m-text-heading)" }}>{formatCurrency(netWorth)}</h2>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => {
          const color = account.color || getAccountColor(account.type);
          return (
            <div key={account.id} className="rounded-2xl p-5 group relative transition-all duration-300 hover:shadow-md feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
              <button onClick={() => handleDelete(account.id)} className="absolute top-3 right-3 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/5 transition-all" style={{ color: "var(--m-danger)" }}>
                <X size={14} />
              </button>
              
              <div className="grid size-12 place-items-center rounded-xl mb-4 text-white shadow-sm" style={{ backgroundColor: color }}>
                {getAccountIcon(account.type)}
              </div>
              
              <h3 className="font-bold text-lg mb-1" style={{ color: "var(--m-text-heading)" }}>{account.name}</h3>
              <p className="text-xs uppercase tracking-wide font-medium mb-4" style={{ color: "var(--m-text-muted)" }}>{account.type.replace("-", " ")}</p>
              
              <div className="flex items-center justify-between">
                <span className="font-[Roboto_Slab] font-bold text-xl" style={{ color: account.type === "credit-card" && account.balance > 0 ? "var(--m-danger)" : "var(--m-text-heading)" }}>
                  {formatCurrency(account.balance, account.currency)}
                </span>
                <ChevronRight size={16} className="opacity-50" style={{ color: "var(--m-text)" }} />
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 py-12 text-center rounded-2xl minimal-surface" style={{ backgroundColor: "var(--m-surface)", border: "1px border-dashed var(--m-border)" }}>
            <Wallet size={32} className="mx-auto mb-3 opacity-40" style={{ color: "var(--m-text)" }} />
            <p className="font-semibold" style={{ color: "var(--m-text-heading)" }}>No accounts added yet</p>
            <p className="text-sm mt-1 mb-4" style={{ color: "var(--m-text-sub)" }}>Add your bank accounts, wallets, or credit cards to track balances.</p>
            <button onClick={() => setIsAdding(true)} className="text-sm font-bold underline" style={{ color: "var(--m-primary)" }}>Add your first account</button>
          </div>
        )}
      </div>

      {isAdding && (
        <AccountModal
          onClose={() => setIsAdding(false)}
          onSave={(acc) => {
            onUpdate({ accounts: [...accounts, acc] });
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
}

function AccountModal({ onClose, onSave }: { onClose: () => void, onSave: (acc: FinanceAccount) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FinanceAccount["type"]>("savings");
  const [balance, setBalance] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;
    const numBalance = parseFloat(balance);
    if (isNaN(numBalance)) return;

    onSave({
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name,
      type,
      balance: Math.round(numBalance * 100), // to paisa
      currency: "INR",
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
        <h2 className="text-xl font-[Roboto_Slab] font-bold mb-5" style={{ color: "var(--m-text-heading)" }}>Add Account</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Account Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Checking" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Account Type</label>
            <select required value={type} onChange={(e) => setType(e.target.value as any)} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }}>
              <option value="savings">Savings</option>
              <option value="current">Current</option>
              <option value="cash">Cash</option>
              <option value="wallet">Digital Wallet (PayTM, etc)</option>
              <option value="credit-card">Credit Card</option>
              <option value="investment">Investment / Brokerage</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Current Balance (₹)</label>
            <input type="number" step="0.01" required value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" className="w-full rounded-xl border px-3 py-2.5 text-base outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
            {type === "credit-card" && <p className="text-[10px] mt-1" style={{ color: "var(--m-text-muted)" }}>Enter the amount you owe as a positive number.</p>}
          </div>

          <button type="submit" className="w-full rounded-xl py-3 mt-6 text-sm font-bold shadow-md transition hover:opacity-90" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
            Save Account
          </button>
        </form>
      </div>
    </div>
  );
}
