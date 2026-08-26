import React, { useState } from "react";
import type { FinanceData, FinanceGoal } from "../../lib/finance-types";
import { formatCurrency, toPaisa } from "../../lib/finance-calculations";
import { Plus, Target, X, Edit2, CheckCircle2 } from "lucide-react";

export default function FinanceGoals({ data, onUpdate }: { data: FinanceData, onUpdate: (d: Partial<FinanceData>) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const goals = data.goals || [];

  const handleDelete = (id: string) => {
    if (confirm("Delete this goal?")) {
      onUpdate({ goals: goals.filter((g) => g.id !== id) });
    }
  };

  const handleUpdateAmount = (id: string, amountToAdd: number) => {
    const updatedGoals = goals.map(g => {
        if (g.id === id) {
            return {
                ...g,
                currentAmount: Math.min(g.targetAmount, g.currentAmount + toPaisa(amountToAdd)),
                updatedAt: new Date().toISOString()
            };
        }
        return g;
    });
    onUpdate({ goals: updatedGoals });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[Roboto_Slab] text-2xl font-bold" style={{ color: "var(--m-text-heading)" }}>Financial Goals</h1>
          <p className="text-sm" style={{ color: "var(--m-text-sub)" }}>Set targets for savings, purchases, or debt payoff.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition hover:scale-105 w-max"
          style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
        >
          <Plus size={16} /> Create Goal
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {goals.map((goal) => {
          const percentage = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
          const isComplete = percentage >= 100;

          return (
            <div key={goal.id} className="rounded-2xl p-5 group relative transition-all duration-300 hover:shadow-md feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
              <button onClick={() => handleDelete(goal.id)} className="absolute top-3 right-3 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/5 transition-all" style={{ color: "var(--m-danger)" }}>
                <X size={14} />
              </button>
              
              <div className="flex items-start gap-4 mb-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl text-2xl shadow-xs" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)" }}>
                  {goal.icon || "🎯"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate" style={{ color: "var(--m-text-heading)" }}>{goal.name}</h3>
                  {goal.deadline && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--m-text-sub)" }}>
                      Target: {new Date(goal.deadline).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-2 flex items-end justify-between">
                <div>
                  <span className="font-[Roboto_Slab] font-bold text-xl" style={{ color: "var(--m-text-heading)" }}>{formatCurrency(goal.currentAmount)}</span>
                  <span className="text-sm ml-1" style={{ color: "var(--m-text-sub)" }}>/ {formatCurrency(goal.targetAmount)}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: isComplete ? "var(--m-success)" : "var(--m-primary)" }}>
                  {percentage.toFixed(0)}%
                </span>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full mb-5" style={{ backgroundColor: "var(--m-surface-alt)" }}>
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%`, backgroundColor: isComplete ? "var(--m-success)" : "var(--m-primary)" }} />
              </div>

              {!isComplete ? (
                <div className="flex gap-2">
                    <button onClick={() => {
                        const amt = prompt("Amount to add (₹):");
                        if (amt && !isNaN(parseFloat(amt))) handleUpdateAmount(goal.id, parseFloat(amt));
                    }} className="flex-1 rounded-lg py-2 text-xs font-bold transition hover:opacity-80" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                        Add Funds
                    </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold" style={{ backgroundColor: "color-mix(in srgb, var(--m-success) 15%, transparent)", color: "var(--m-success)" }}>
                    <CheckCircle2 size={14} /> Goal Achieved!
                </div>
              )}
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="md:col-span-2 py-16 text-center rounded-2xl minimal-surface" style={{ backgroundColor: "var(--m-surface)", border: "1px border-dashed var(--m-border)" }}>
            <Target size={32} className="mx-auto mb-3 opacity-40" style={{ color: "var(--m-text)" }} />
            <p className="font-semibold text-lg" style={{ color: "var(--m-text-heading)" }}>No goals set</p>
            <p className="text-sm mt-1 mb-5" style={{ color: "var(--m-text-sub)" }}>Setting financial goals helps you save faster and stay motivated.</p>
            <button onClick={() => setIsAdding(true)} className="text-sm font-bold underline" style={{ color: "var(--m-primary)" }}>Create a goal</button>
          </div>
        )}
      </div>

      {isAdding && (
        <GoalModal
          onClose={() => setIsAdding(false)}
          onSave={(g) => {
            onUpdate({ goals: [...goals, g] });
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
}

function GoalModal({ onClose, onSave }: { onClose: () => void, onSave: (g: FinanceGoal) => void }) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [deadline, setDeadline] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount) return;
    const numTarget = parseFloat(targetAmount);
    const numCurrent = parseFloat(currentAmount || "0");
    if (isNaN(numTarget)) return;

    onSave({
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name,
      icon,
      targetAmount: Math.round(numTarget * 100),
      currentAmount: Math.round(numCurrent * 100),
      deadline: deadline || undefined,
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
        <h2 className="text-xl font-[Roboto_Slab] font-bold mb-5" style={{ color: "var(--m-text-heading)" }}>Create Goal</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
             <div className="w-16">
                <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Icon</label>
                <input type="text" required value={icon} onChange={(e) => setIcon(e.target.value)} className="w-full rounded-xl border px-2 py-2.5 text-center text-lg outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} maxLength={2} />
             </div>
             <div className="flex-1">
                <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Goal Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Macbook Pro, Emergency Fund" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
             </div>
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Target Amount (₹)</label>
            <input type="number" step="0.01" required value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border px-3 py-2.5 text-base outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Already Saved (₹)</label>
                <input type="number" step="0.01" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
             </div>
             <div>
                <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--m-text-sub)" }}>Target Date (Optional)</label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--m-input-bg)", borderColor: "var(--m-border)", color: "var(--m-text-heading)" }} />
             </div>
          </div>

          <button type="submit" className="w-full rounded-xl py-3 mt-6 text-sm font-bold shadow-md transition hover:opacity-90" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
            Save Goal
          </button>
        </form>
      </div>
    </div>
  );
}
