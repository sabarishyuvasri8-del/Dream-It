import React, { useState, useRef, useEffect, useMemo, FormEvent } from "react";
import type { FinanceData } from "../../lib/finance-types";
import {
  formatCurrency,
  toRupees,
  calculateMonthlyIncome,
  calculateMonthlyExpenses,
  calculateCategorySpending,
  calculateNetWorth,
  calculateSavingsRate,
  calculateTotalBalance,
  convertToMonthlyAmount,
  calculateFutureValue,
} from "../../lib/finance-calculations";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../../lib/finance-defaults";
import { Bot, Send, Sparkles, Trash2, User } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import VoiceInputButton from "../components/VoiceInputButton";
import { fetchAI } from "../../lib/ai-client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "Where did I spend the most this month?",
  "How can I reduce my expenses?",
  "Can I afford a ₹70,000 laptop?",
  "How long will it take to reach my goal?",
  "What happens if I save ₹5,000 more every month?",
  "Show me my biggest financial problems.",
  "Which spending categories are growing fastest?",
  "How much am I spending on subscriptions?",
];

// ─── Build a financial context string from real user data ────────
function buildFinancialContext(data: FinanceData): string {
  const txns = data.transactions || [];
  const accounts = data.accounts || [];
  const goals = data.goals || [];
  const budgets = data.budgets || [];
  const allCats = [
    ...DEFAULT_EXPENSE_CATEGORIES,
    ...DEFAULT_INCOME_CATEGORIES,
    ...(data.categories || []),
  ];

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const thisMonthIncome = calculateMonthlyIncome(txns, now);
  const lastMonthIncome = calculateMonthlyIncome(txns, lastMonthDate);
  const thisMonthExpenses = calculateMonthlyExpenses(txns, now);
  const lastMonthExpenses = calculateMonthlyExpenses(txns, lastMonthDate);
  const savingsRate = calculateSavingsRate(thisMonthIncome, thisMonthExpenses);
  const netWorth = accounts.length > 0 ? calculateNetWorth(accounts) : null;
  const totalBalance = accounts.length > 0 ? calculateTotalBalance(accounts) : null;

  // Category breakdowns
  const thisMonthBreakdown = calculateCategorySpending(txns, thisMonth);
  const lastMonthBreakdown = calculateCategorySpending(txns, lastMonth);

  const categoryLines = Object.entries(thisMonthBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([catId, amount]) => {
      const cat = allCats.find((c) => c.id === catId);
      const lastAmt = lastMonthBreakdown[catId] || 0;
      const change = lastAmt > 0 ? ((amount - lastAmt) / lastAmt) * 100 : 0;
      const changeStr = lastAmt > 0 ? ` (${change > 0 ? "+" : ""}${change.toFixed(0)}% vs last month)` : "";
      return `  • ${cat?.icon || ""} ${cat?.name || catId}: ${formatCurrency(amount)}${changeStr}`;
    })
    .join("\n");

  // Accounts summary
  const accountLines = accounts
    .map((a) => `  • ${a.name} (${a.type}): ${formatCurrency(a.balance)}`)
    .join("\n");

  // Goals summary
  const goalLines = goals
    .map((g) => {
      const pct = g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(0) : "0";
      return `  • ${g.icon} ${g.name}: ${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)} (${pct}% complete)${g.deadline ? ` — Deadline: ${g.deadline}` : ""}`;
    })
    .join("\n");

  // Budget usage
  const budgetLines = budgets
    .map((b) => {
      const cat = allCats.find((c) => c.id === b.categoryId);
      const spent = txns
        .filter((t) => t.type === "expense" && t.categoryId === b.categoryId && t.date.startsWith(thisMonth))
        .reduce((s, t) => s + t.amount, 0);
      const pct = b.amount > 0 ? ((spent / b.amount) * 100).toFixed(0) : "0";
      return `  • ${cat?.name || b.categoryId}: ${formatCurrency(spent)} / ${formatCurrency(b.amount)} (${pct}% used)`;
    })
    .join("\n");

  // Recent transactions (last 15)
  const recentTxns = [...txns]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15)
    .map((t) => {
      const cat = allCats.find((c) => c.id === t.categoryId);
      return `  • ${t.date} | ${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)} | ${cat?.name || t.categoryId} | ${t.merchant || t.description || "—"}`;
    })
    .join("\n");

  const parts: string[] = [];
  parts.push("=== USER'S FINANCIAL SNAPSHOT ===");
  parts.push(`Date: ${now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
  parts.push("");

  parts.push("--- THIS MONTH ---");
  parts.push(`Income: ${formatCurrency(thisMonthIncome)}`);
  parts.push(`Expenses: ${formatCurrency(thisMonthExpenses)}`);
  parts.push(`Savings Rate: ${savingsRate.toFixed(1)}%`);
  if (thisMonthIncome > 0 || thisMonthExpenses > 0) {
    parts.push(`Net (Income - Expenses): ${formatCurrency(thisMonthIncome - thisMonthExpenses)}`);
  }
  parts.push("");

  parts.push("--- LAST MONTH ---");
  parts.push(`Income: ${formatCurrency(lastMonthIncome)}`);
  parts.push(`Expenses: ${formatCurrency(lastMonthExpenses)}`);
  parts.push("");

  if (netWorth !== null) {
    parts.push("--- ACCOUNTS ---");
    parts.push(`Net Worth: ${formatCurrency(netWorth)}`);
    parts.push(`Total Balance (Cash & Bank): ${formatCurrency(totalBalance || 0)}`);
    if (accountLines) parts.push(accountLines);
    parts.push("");
  }

  if (categoryLines) {
    parts.push("--- EXPENSE BREAKDOWN (THIS MONTH) ---");
    parts.push(categoryLines);
    parts.push("");
  }

  if (budgetLines) {
    parts.push("--- BUDGET USAGE (THIS MONTH) ---");
    parts.push(budgetLines);
    parts.push("");
  }

  if (goalLines) {
    parts.push("--- FINANCIAL GOALS ---");
    parts.push(goalLines);
    parts.push("");
  }

  if (recentTxns) {
    parts.push("--- RECENT TRANSACTIONS (LAST 15) ---");
    parts.push(recentTxns);
    parts.push("");
  }

  const totalTxnCount = txns.length;
  parts.push(`Total transactions on record: ${totalTxnCount}`);

  return parts.join("\n");
}

const SYSTEM_PROMPT_TEMPLATE = `You are **Dream It Money Coach**, an elite agentic AI financial advisor embedded inside the "Dream It" student productivity app. You operate as a highly intelligent, data-driven financial agent.

## YOUR AGENT CAPABILITIES:
1. **DATA READER**: You have FULL READ ACCESS to the user's complete financial snapshot below. You MUST reference actual numbers, accounts, categories, goals, and transactions.
2. **ANALYST**: You perform multi-step financial reasoning — compare months, calculate growth rates, project future values, identify spending anomalies, and detect patterns.
3. **ADVISOR**: You provide clear, actionable, step-by-step financial guidance tailored to the user's exact situation.
4. **SIMULATOR**: When asked "what if" questions, you run compound interest calculations (monthly compounding), savings projections, and affordability analyses using the user's real data.

## RESPONSE FORMAT (STRICT):
Structure EVERY response using this well-organized format:
- Start with a brief **one-sentence summary** of your answer
- Use **markdown headers** (##, ###, ####) to organize sections
- Use **bullet points** (•) for data breakdowns
- **Bold** all monetary values (e.g., **₹25,000**)
- Use emoji section headers for visual clarity (📊 📈 💡 ⚠️ ✅ 🎯 💰 🏦)
- End with a **💡 Key Takeaway** or **🎯 Action Item** section
- Keep tone: encouraging, smart, never condescending

## CRITICAL RULES:
1. All monetary values in the data below are in **paisa** (100 paisa = ₹1). ALWAYS convert to rupees (÷100) when displaying.
2. NEVER fabricate data. If information is missing, say so explicitly.
3. For "can I afford" questions: compare price vs current balance, monthly surplus, and impact on existing goals.
4. For goal timelines: calculate months = (remaining amount) / (monthly surplus).
5. For "what if" scenarios: use FV = PV × (1 + r/12)^(12×t) when relevant.
6. You are NOT a certified financial advisor. You are an educational AI coach.
7. Use ₹ symbol for all currency values.

## USER'S COMPLETE FINANCIAL DATA:
`;

// ─── Component ──────────────────────────────────────────────────

export default function FinanceCoach({ data }: { data: FinanceData }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const financialContext = useMemo(() => buildFinancialContext(data), [data]);

  const sendMessage = async (e?: FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const question = customQuery || draft.trim();
    if (!question || isAsking) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    if (!customQuery) setDraft("");
    setIsAsking(true);

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE + financialContext;
    const history = messages
      .filter((m) => !m.content.includes("temporarily unavailable") && !m.content.includes("Rate Limit Exceeded"))
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const response = await fetchAI({
        model: "gemini-3.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: question },
        ],
        max_tokens: 4096,
        temperature: 0.4,
        top_p: 0.9,
        onChunk: (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              last.content += chunk;
            }
            return updated;
          });
        }
      });

      if (response.error) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content = `⚠️ **AI Money Coach**: ${response.error}`;
          return updated;
        });
      }
    } catch (error) {
      console.warn("AI Money Coach fallback notice:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ **AI Money Coach**: An unexpected error occurred. Please try again." },
      ]);
    }
    setIsAsking(false);
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Rich markdown-ish renderer for coach responses
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      // Horizontal dividers
      if (line.trim() === "---" || line.trim() === "***") {
        return <hr key={i} className="my-2 border-t opacity-20" style={{ borderColor: "currentColor" }} />;
      }
      // Headings
      if (line.startsWith("### ")) {
        return <h4 key={i} className="font-bold text-base mt-2 mb-1" style={{ color: "var(--m-text-heading)" }}>{line.slice(4)}</h4>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={i} className="font-bold text-lg mt-2 mb-1" style={{ color: "var(--m-text-heading)" }}>{line.slice(3)}</h3>;
      }
      // Bold formatting
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Bullet points (*, -, •)
      if (processed.startsWith("• ") || processed.startsWith("- ") || processed.startsWith("* ")) {
        return (
          <p key={i} className="ml-3 mb-0.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: "• " + processed.slice(2) }} />
        );
      }
      if (processed.trim() === "") return <div key={i} className="h-1.5" />;
      return <p key={i} className="mb-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  return (
    <div className="flex flex-col" style={{ minHeight: "70vh" }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="grid size-10 place-items-center rounded-xl"
            style={{
              backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
              color: "var(--m-primary)",
            }}
          >
            <Bot size={20} />
          </div>
          <div>
            <h1 className="font-[Roboto_Slab] text-2xl font-bold" style={{ color: "var(--m-text-heading)" }}>
              AI Money Coach
            </h1>
            <p className="text-sm" style={{ color: "var(--m-text-sub)" }}>
              Ask anything about your finances — powered by your real data.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Prompts (show when no messages) */}
      {messages.length === 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--m-text-muted)" }}>
            Try asking
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(undefined, q)}
                className="text-left rounded-xl px-4 py-3 text-xs font-medium border transition-all hover:shadow-sm hover:scale-[1.01]"
                style={{
                  backgroundColor: "var(--m-surface)",
                  borderColor: "var(--m-border)",
                  color: "var(--m-text-heading)",
                }}
              >
                <span className="opacity-50 mr-1.5">💬</span> {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div
        className="flex-1 space-y-4 mb-4 overflow-y-auto custom-scrollbar pr-1"
        style={{ maxHeight: messages.length > 0 ? "55vh" : undefined }}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div
                className="grid size-8 shrink-0 place-items-center rounded-full mt-1"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                  color: "var(--m-primary)",
                }}
              >
                <Bot size={14} />
              </div>
            )}
            <div
              className="rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]"
              style={{
                backgroundColor:
                  msg.role === "user" ? "var(--m-primary)" : "var(--m-surface)",
                color:
                  msg.role === "user" ? "var(--m-primary-text)" : "var(--m-text-heading)",
                border: msg.role === "assistant" ? "1px solid var(--m-border)" : "none",
              }}
            >
              {renderContent(msg.content)}
            </div>
            {msg.role === "user" && (
              <div
                className="grid size-8 shrink-0 place-items-center rounded-full mt-1"
                style={{
                  backgroundColor: "var(--m-primary)",
                  color: "var(--m-primary-text)",
                }}
              >
                <User size={14} />
              </div>
            )}
          </div>
        ))}

        {isAsking && (
          <div className="flex gap-3 justify-start">
            <div
              className="grid size-8 shrink-0 place-items-center rounded-full mt-1"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <Bot size={14} />
            </div>
            <div
              className="rounded-2xl px-4 py-3 text-sm border"
              style={{
                backgroundColor: "var(--m-surface)",
                borderColor: "var(--m-border)",
                color: "var(--m-text-sub)",
              }}
            >
              <span className="inline-flex gap-1 items-center">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>●</span>
                <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>●</span>
                <span className="ml-2 text-xs">Analyzing your finances…</span>
              </span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div
        className="rounded-2xl border p-2 flex items-center gap-2"
        style={{
          backgroundColor: "var(--m-surface)",
          borderColor: "var(--m-border)",
        }}
      >
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center justify-center size-9 rounded-xl transition hover:opacity-70 shrink-0"
            style={{ color: "var(--m-text-muted)" }}
            title="Clear chat"
          >
            <Trash2 size={16} />
          </button>
        )}
        <form onSubmit={sendMessage} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about your finances..."
            disabled={isAsking}
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
            style={{ color: "var(--m-text-heading)" }}
          />
          <VoiceInputButton
            value={draft}
            onChange={setDraft}
            disabled={isAsking}
            size={15}
          />
          <button
            type="submit"
            disabled={isAsking || !draft.trim()}
            className="grid size-9 place-items-center rounded-xl transition-all hover:scale-105 disabled:opacity-40 shrink-0"
            style={{
              backgroundColor: "var(--m-primary)",
              color: "var(--m-primary-text)",
            }}
          >
            <Send size={15} />
          </button>
        </form>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-center mt-3" style={{ color: "var(--m-text-muted)" }}>
        AI Money Coach uses your app data for context. It does not provide certified financial advice.
      </p>
    </div>
  );
}
