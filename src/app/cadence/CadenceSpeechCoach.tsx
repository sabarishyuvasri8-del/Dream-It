import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Bot, Send, X, Maximize2, Minimize2, Sparkles, User, Trash2 } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { chatWithSpeechCoach, CadenceResponse } from "./cadence-api";
import VoiceInputButton from "../components/VoiceInputButton";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CadenceSpeechCoachProps {
  report: CadenceResponse;
}

const SUGGESTED_QUESTIONS = [
  "How can I improve my speech?",
  "What words did I struggle with?",
  "Give me exercises for articulation",
  "How is my speaking pace?",
  "What should I practice daily?",
  "Why was my score low?",
];

export default function CadenceSpeechCoach({ report }: CadenceSpeechCoachProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant" as const,
      content: `Hi! I'm your **Speech Coach AI** 🎙️\n\nI've reviewed your screening results (Score: **${report.score}/100**). I can help you understand your performance and give you personalized exercises to improve.\n\nTry asking me anything about your speech analysis!`,
    },
  ]);
  
  const clearChat = () => {
    setMessages([
      {
        role: "assistant" as const,
        content: `Hi! I'm your **Speech Coach AI** 🎙️\n\nI've reviewed your screening results (Score: **${report.score}/100**). I can help you understand your performance and give you personalized exercises to improve.\n\nTry asking me anything about your speech analysis!`,
      },
    ]);
  };

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const history = messages
      .filter((m) => !m.content.includes("temporarily busy"))
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await chatWithSpeechCoach(text.trim(), report, history);
    setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-bold shadow-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-1"
        style={{
          backgroundColor: "var(--m-primary)",
          color: "var(--m-primary-text)",
          boxShadow: "0 8px 32px color-mix(in srgb, var(--m-primary) 40%, transparent)",
        }}
      >
        <Bot size={20} />
        Speech Coach AI
      </button>
    );
  }

  return (
    <div
      className={`fixed z-50 flex flex-col transition-all duration-300 shadow-2xl rounded-3xl overflow-hidden ${
        isWide
          ? "inset-4 sm:inset-8"
          : "bottom-4 right-4 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-2rem)]"
      }`}
      style={{
        backgroundColor: "var(--m-surface-solid)",
        border: "1px solid var(--m-border)",
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{
          background: "linear-gradient(135deg, var(--m-primary), color-mix(in srgb, var(--m-primary) 70%, #000))",
          color: "var(--m-primary-text)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm">Speech Coach AI</h3>
            <p className="text-[11px] opacity-80">Powered by Gemini</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsWide(!isWide)}
            className="p-2 rounded-xl hover:bg-white/15 transition"
            title={isWide ? "Minimize" : "Expand"}
          >
            {isWide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={() => { setIsOpen(false); setIsWide(false); }}
            className="p-2 rounded-xl hover:bg-white/15 transition"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarGutter: "stable" }}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div
                className="size-8 rounded-xl flex items-center justify-center shrink-0 mt-1"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                  color: "var(--m-primary)",
                }}
              >
                <Sparkles size={16} />
              </div>
            )}
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${
                msg.role === "user" ? "rounded-br-md" : "rounded-bl-md"
              }`}
              style={{
                backgroundColor:
                  msg.role === "user"
                    ? "var(--m-primary)"
                    : "var(--m-surface-alt)",
                color:
                  msg.role === "user"
                    ? "var(--m-primary-text)"
                    : "var(--m-text)",
                border: msg.role === "assistant" ? "1px solid var(--m-border-light)" : "none",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div
                className="size-8 rounded-xl flex items-center justify-center shrink-0 mt-1"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                  color: "var(--m-primary)",
                }}
              >
                <User size={16} />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div
              className="size-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <Sparkles size={16} />
            </div>
            <div
              className="rounded-2xl rounded-bl-md px-4 py-3"
              style={{
                backgroundColor: "var(--m-surface-alt)",
                border: "1px solid var(--m-border-light)",
              }}
            >
              <div className="flex gap-1.5">
                <span className="size-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--m-primary)", animationDelay: "0ms" }} />
                <span className="size-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--m-primary)", animationDelay: "150ms" }} />
                <span className="size-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--m-primary)", animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions (only show if few messages) */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {SUGGESTED_QUESTIONS.slice(0, isWide ? 6 : 3).map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition hover:scale-105"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)",
                color: "var(--m-primary)",
                border: "1px solid color-mix(in srgb, var(--m-primary) 25%, transparent)",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ borderTop: "1px solid var(--m-border)" }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your speech..."
          disabled={isLoading}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition"
          style={{
            backgroundColor: "var(--m-surface-alt)",
            color: "var(--m-text)",
            border: "1px solid var(--m-border)",
          }}
        />
        <VoiceInputButton
          value={input}
          onChange={setInput}
          disabled={isLoading}
          size={16}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="size-9 rounded-xl flex items-center justify-center transition hover:scale-105 disabled:opacity-40 shrink-0"
          style={{
            backgroundColor: "var(--m-primary)",
            color: "var(--m-primary-text)",
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
