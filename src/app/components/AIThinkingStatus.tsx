import React from "react";

interface AIThinkingStatusProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const AIThinkingStatus: React.FC<AIThinkingStatusProps> = ({
  size = "md",
  className = "",
}) => {
  const isSmall = size === "sm";
  const dotClass = isSmall ? "size-1.5" : "size-2";

  return (
    <div
      className={`inline-flex items-center gap-1.5 py-1 px-1.5 select-none ${className}`}
      aria-label="Thinking..."
    >
      <span
        className={`${dotClass} rounded-full animate-bounce [animation-duration:900ms] [animation-delay:0ms]`}
        style={{ backgroundColor: "var(--m-primary)" }}
      />
      <span
        className={`${dotClass} rounded-full animate-bounce [animation-duration:900ms] [animation-delay:200ms]`}
        style={{ backgroundColor: "var(--m-primary)" }}
      />
      <span
        className={`${dotClass} rounded-full animate-bounce [animation-duration:900ms] [animation-delay:400ms]`}
        style={{ backgroundColor: "var(--m-primary)" }}
      />
    </div>
  );
};

export default AIThinkingStatus;
