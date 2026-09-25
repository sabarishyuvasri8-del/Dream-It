import React from "react";
import { extractUrls } from "../utils/linkPreview";
import LinkPreviewCard from "./LinkPreviewCard";

interface ChatMessageContentProps {
  content: string;
  isMe: boolean;
  createdAt?: string;
}

export default function ChatMessageContent({
  content,
  isMe,
  createdAt,
}: ChatMessageContentProps) {
  if (!content) return null;

  const urls = extractUrls(content);
  const primaryUrl = urls[0];

  // Helper to format timestamp (e.g., "6:46 PM")
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const formattedTime = formatTime(createdAt);

  // If no URL is present in the message
  if (urls.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <span>{content}</span>
        {formattedTime && (
          <div
            className={`text-[10px] self-end mt-0.5 opacity-60 font-medium select-none`}
          >
            {formattedTime}
          </div>
        )}
      </div>
    );
  }

  // If message has URLs:
  // Render text with clickable links
  const renderFormattedText = () => {
    const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
    const parts = content.split(urlRegex);

    return parts.map((part, index) => {
      if (urls.includes(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`font-semibold underline underline-offset-3 hover:opacity-85 transition break-all ${
              isMe ? "text-white/95" : "text-blue-500 dark:text-blue-400"
            }`}
          >
            {part}
          </a>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-[340px] sm:max-w-[400px]">
      {/* Rich Link Preview Cover Card (WhatsApp style: cover at top) */}
      {primaryUrl && (
        <div className="w-full">
          <LinkPreviewCard url={primaryUrl} isMe={isMe} />
        </div>
      )}

      {/* Message Text with clickable link */}
      <div className="flex flex-col">
        <div className="break-words leading-relaxed text-sm">
          {renderFormattedText()}
        </div>

        {formattedTime && (
          <div
            className={`text-[10px] self-end mt-1 opacity-60 font-medium select-none`}
          >
            {formattedTime}
          </div>
        )}
      </div>
    </div>
  );
}
