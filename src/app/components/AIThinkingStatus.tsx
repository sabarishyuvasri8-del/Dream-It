import React, { useState, useEffect } from "react";
import { Sparkles, Brain, Cpu, Compass, Layers, Zap } from "lucide-react";

interface AIThinkingStatusProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const THINKING_STAGES = [
  { text: "Thinking", icon: Sparkles },
  { text: "Analyzing", icon: Brain },
  { text: "Working", icon: Cpu },
  { text: "Triangulating", icon: Compass },
  { text: "Deep thinking", icon: Layers },
  { text: "Synthesizing logic", icon: Zap },
  { text: "Formulating solution", icon: Brain },
  { text: "Reasoning through concepts", icon: Sparkles },
  { text: "Fact-checking accuracy", icon: Cpu },
  { text: "Crafting response", icon: Zap },
];

export const AIThinkingStatus: React.FC<AIThinkingStatusProps> = ({
  size = "md",
  className = "",
}) => {
  const [stageIndex, setStageIndex] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isFading, setIsFading] = useState(false);

  // Timer for seconds elapsed (ChatGPT o1 & Claude style)
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cycle thinking phrases every 1.7 seconds with smooth crossfade
  useEffect(() => {
    const stageTimer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setStageIndex((prev) => (prev + 1) % THINKING_STAGES.length);
        setIsFading(false);
      }, 200);
    }, 1700);
    return () => clearInterval(stageTimer);
  }, []);

  const currentStage = THINKING_STAGES[stageIndex];
  const IconComponent = currentStage.icon;

  const isSmall = size === "sm";

  return (
    <div
      className={`inline-flex items-center gap-2.5 py-0.5 select-none ${className}`}
    >
      {/* Pulsing & Rotating Shimmer Icon */}
      <div className="relative flex items-center justify-center">
        <span className="absolute size-4 sm:size-5 rounded-full bg-indigo-500/20 dark:bg-indigo-400/25 animate-ping opacity-75" />
        <div
          className={`relative rounded-lg grid place-items-center transition-transform duration-300 ${
            isSmall ? "size-5 p-0.5" : "size-6 p-1"
          }`}
          style={{
            backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
            color: "var(--m-primary)",
          }}
        >
          <IconComponent
            size={isSmall ? 13 : 15}
            className="animate-spin [animation-duration:3s]"
          />
        </div>
      </div>

      {/* Dynamic Cycling Text with Claude/ChatGPT elapsed seconds */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`font-semibold tracking-tight transition-opacity duration-200 ${
            isFading ? "opacity-30" : "opacity-100"
          } ${isSmall ? "text-[11.5px]" : "text-xs sm:text-sm"}`}
          style={{ color: "var(--m-text-heading)" }}
        >
          {currentStage.text}
        </span>

        {/* Elapsed Timer Pill (Claude/ChatGPT style) */}
        {secondsElapsed > 0 && (
          <span
            className="font-mono text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-md font-medium opacity-75"
            style={{
              backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)",
              color: "var(--m-primary)",
            }}
          >
            {secondsElapsed}s
          </span>
        )}

        {/* Triple Fluid Wave Dots */}
        <span className="inline-flex items-center gap-0.5 ml-0.5">
          <span
            className="size-1 rounded-full animate-bounce [animation-delay:0ms]"
            style={{ backgroundColor: "var(--m-primary)" }}
          />
          <span
            className="size-1 rounded-full animate-bounce [animation-delay:150ms]"
            style={{ backgroundColor: "var(--m-primary)" }}
          />
          <span
            className="size-1 rounded-full animate-bounce [animation-delay:300ms]"
            style={{ backgroundColor: "var(--m-primary)" }}
          />
        </span>
      </div>
    </div>
  );
};

export default AIThinkingStatus;
