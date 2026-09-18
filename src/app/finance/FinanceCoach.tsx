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
import { Bot, Send, Sparkles, Trash2, User, Paperclip, FileText, UploadCloud, X, Loader2 } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import VoiceInputButton from "../components/VoiceInputButton";
import { fetchAI } from "../../lib/ai-client";
import MarkdownRenderer from "../components/MarkdownRenderer";

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  // ─── File Attachment & Drag-and-Drop ───
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    type: string;
    content: string;
    isImage?: boolean;
    isPdf?: boolean;
    pageCount?: number;
    base64?: string;
    dataUrl?: string;
  } | null>(null);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processAndAttachFile = async (file: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert("File too large for AI Money Coach (max 25MB)");
      return;
    }

    const isImage = Boolean(file.type.startsWith("image/") || file.name.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i));
    const isPDF = Boolean(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));

    try {
      setIsExtractingFile(true);
      let contentText = "";
      let base64 = "";
      let dataUrl = "";
      let pageCount: number | undefined;

      if (isImage) {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
        contentText = `[IMAGE RECEIPT / INVOICE: ${file.name} (${formatFileSize(file.size)})]`;
      } else if (isPDF) {
        const { extractTextFromFile } = await import("../flashcards/pdfExtractor");
        const extracted = await extractTextFromFile(file);
        contentText = extracted.text || `[PDF DOCUMENT: ${file.name} (${formatFileSize(file.size)})]`;
        pageCount = extracted.pageCount;
      } else {
        contentText = await file.text().catch(() => `[Attachment: ${file.name}]`);
      }

      setAttachedFile({
        name: file.name,
        size: file.size,
        type: file.type || (isImage ? "image/jpeg" : isPDF ? "application/pdf" : "application/octet-stream"),
        content: contentText,
        isImage,
        isPdf: isPDF,
        pageCount,
        base64,
        dataUrl,
      });
    } catch (err: any) {
      console.error("[FinanceCoach] File processing error:", err);
    } finally {
      setIsExtractingFile(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAndAttachFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processAndAttachFile(e.target.files[0]);
      e.target.value = "";
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const financialContext = useMemo(() => buildFinancialContext(data), [data]);

  const sendMessage = async (e?: FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const rawQuestion = customQuery || draft.trim();
    if (!rawQuestion && !attachedFile && !isAsking) return;

    const question = rawQuestion || (attachedFile ? (attachedFile.isImage ? "Please analyze this financial receipt/bill in detail and extract the transaction." : `Please analyze this financial document: ${attachedFile.name}`) : "");
    const attachedBackup = attachedFile;

    const displayContent = attachedBackup
      ? (attachedBackup.isImage && attachedBackup.dataUrl
          ? `![${attachedBackup.name}](${attachedBackup.dataUrl})\n\n📎 **${attachedBackup.name}** (${formatFileSize(attachedBackup.size)})\n\n${question}`
          : attachedBackup.isPdf
            ? `📄 **${attachedBackup.name}** (${attachedBackup.pageCount ? `${attachedBackup.pageCount} pages, ` : ""}${formatFileSize(attachedBackup.size)})\n\n${question}`
            : `📎 **${attachedBackup.name}** (${formatFileSize(attachedBackup.size)})\n\n${question}`)
      : question;

    const promptForAI = attachedBackup
      ? (attachedBackup.isImage
          ? question
          : `[ATTACHED FINANCIAL STATEMENT / RECEIPT: ${attachedBackup.name} (${attachedBackup.pageCount ? `${attachedBackup.pageCount} pages, ` : ""}${formatFileSize(attachedBackup.size)})]\n--- DOCUMENT CONTENT START ---\n${attachedBackup.content.slice(0, 25000)}\n--- DOCUMENT CONTENT END ---\n\nUser Question: ${question}`)
      : question;

    setMessages((prev) => [...prev, { role: "user", content: displayContent }]);
    if (!customQuery) setDraft("");
    setAttachedFile(null);
    setIsAsking(true);

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE + financialContext;
    const history = messages
      .filter((m) => !m.content.includes("temporarily unavailable") && !m.content.includes("Rate Limit Exceeded"))
      .slice(-8)
      .map((m) => ({
        role: m.role,
        content: m.content.replace(/!\[(.*?)\]\(data:image\/[^;]+;base64,[^)]+\)/g, "[Attached Image: $1]"),
      }));

    try {
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const response = await fetchAI({
        model: "gemini-3.1-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: promptForAI },
        ],
        image: attachedBackup?.isImage && attachedBackup.base64 ? {
          name: attachedBackup.name,
          mimeType: attachedBackup.type,
          base64Data: attachedBackup.base64,
          dataUrl: attachedBackup.dataUrl,
        } : undefined,
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

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col relative"
      style={{ minHeight: "70vh" }}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 text-center bg-black/85 backdrop-blur-md border-4 border-dashed border-emerald-500 rounded-3xl animate-in fade-in duration-150 pointer-events-none">
          <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 mb-3 shadow-lg ring-1 ring-emerald-400/40 animate-bounce">
            <UploadCloud size={40} />
          </div>
          <h3 className="text-lg font-bold text-white tracking-wide font-[Roboto_Slab]">Drop Receipt, Invoice, or Bank Statement</h3>
          <p className="text-xs text-emerald-200/80 mt-1 max-w-sm">
            Release to analyze with AI Money Coach. Reads PDF statements and processes receipt images with Gemini vision!
          </p>
        </div>
      )}

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
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <MarkdownRenderer content={msg.content} />
              )}
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

      {/* Attached File Preview Pill */}
      {isExtractingFile && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium mb-2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 animate-pulse">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span>Extracting financial document data...</span>
        </div>
      )}
      {attachedFile && !isExtractingFile && (
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium mb-2 border"
          style={{
            backgroundColor: "var(--m-surface-alt)",
            borderColor: "var(--m-border)",
            color: "var(--m-primary)",
          }}
        >
          <span className="flex items-center gap-2 truncate">
            {attachedFile.isImage && attachedFile.dataUrl ? (
              <img
                src={attachedFile.dataUrl}
                alt={attachedFile.name}
                className="size-7 object-cover rounded-md border border-black/10 shrink-0"
              />
            ) : attachedFile.isPdf ? (
              <span className="flex items-center gap-1.5 shrink-0 text-rose-400">
                <FileText size={15} />
                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/15 font-bold uppercase tracking-wider">PDF</span>
              </span>
            ) : (
              <Paperclip size={14} />
            )}
            <span className="truncate">{attachedFile.name}</span>
            <span className="text-[10px] opacity-75 font-mono">
              ({attachedFile.pageCount ? `${attachedFile.pageCount} pgs • ` : ""}{formatFileSize(attachedFile.size)})
            </span>
          </span>
          <button
            type="button"
            onClick={() => setAttachedFile(null)}
            className="p-1 rounded-md transition hover:opacity-75"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div
        className="rounded-2xl border p-2 flex items-center gap-2"
        style={{
          backgroundColor: "var(--m-surface)",
          borderColor: "var(--m-border)",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.csv,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center size-9 rounded-xl transition hover:opacity-70 shrink-0"
          style={{ color: "var(--m-text-sub)" }}
          title="Attach receipt, invoice or bank statement (PDF, JPG, PNG)"
        >
          <Paperclip size={16} />
        </button>
        <form onSubmit={sendMessage} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about finances or drop receipt/statement..."
            disabled={isAsking}
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
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
            disabled={isAsking || (!draft.trim() && !attachedFile)}
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
