import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  emptyMessage?: string;
  className?: string;
}

function MarkdownRendererBase({
  content,
  emptyMessage = "Nothing written yet. Switch to Edit mode to write your note!",
  className = "",
}: MarkdownRendererProps) {
  if (!content || !content.trim()) {
    return (
      <p className="text-xs italic py-8 text-center opacity-60">
        {emptyMessage}
      </p>
    );
  }

  const hasMath = content.includes("$");
  const remarkPlugins = hasMath ? [remarkGfm, remarkMath] : [remarkGfm];
  const rehypePlugins = hasMath ? [rehypeKatex] : [];

  return (
    <div className={`space-y-2 text-xs leading-relaxed font-[DM_Sans] ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          h1: ({ node, ...props }) => (
            <h1
              className="font-[Roboto_Slab] text-xl font-bold mt-4 mb-2 pb-1 border-b"
              style={{
                borderColor: "var(--m-border-light)",
                color: "var(--m-text-heading)",
              }}
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="font-[Roboto_Slab] text-lg font-semibold mt-3 mb-1"
              style={{ color: "var(--m-text-heading)" }}
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              className="font-[Roboto_Slab] text-sm font-bold mt-2"
              style={{ color: "var(--m-text-heading)" }}
              {...props}
            />
          ),
          ul: ({ node, ...props }) => (
            <ul className="ml-4 list-disc" style={{ color: "var(--m-text)" }} {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="ml-4 list-decimal" style={{ color: "var(--m-text)" }} {...props} />
          ),
          li: ({ node, ...props }) => <li className="" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-3 pl-3 italic my-2 py-1 rounded-r-lg"
              style={{
                borderColor: "var(--m-primary)",
                backgroundColor: "var(--m-surface-alt)",
                color: "var(--m-text-sub)",
              }}
              {...props}
            />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-4" style={{ borderColor: "var(--m-border-light)" }} {...props} />
          ),
          p: ({ node, ...props }) => <p style={{ color: "var(--m-text)" }} {...props} />,
          a: ({ node, ...props }) => (
            <a
              className="text-blue-500 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          img: ({ node, ...props }) => (
            <img
              className="rounded-xl max-h-72 object-contain my-2.5 border border-black/10 dark:border-white/10 shadow-sm cursor-pointer hover:opacity-95 transition"
              onClick={() => {
                const src = (props as any).src;
                if (src) window.open(src, "_blank");
              }}
              loading="lazy"
              {...props}
            />
          ),
          pre: ({ node, ...props }) => (
            <pre
              className="bg-[#1e1e1e] text-white p-3 rounded-lg overflow-x-auto text-[11px] mt-2 mb-2 custom-scrollbar shadow-sm"
              {...props}
            />
          ),
          code: ({ node, className, ...props }: any) => (
            <code
              className={`${className || ""} bg-black/5 dark:bg-white/10 rounded-md px-1.5 py-0.5 text-[10.5px] font-mono`}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererBase);
export default MarkdownRenderer;
