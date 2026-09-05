import React, { memo, useMemo, Component, ErrorInfo, ReactNode } from "react";
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

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackText: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class MarkdownErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[MarkdownRenderer] Parser error safely handled:", error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.fallbackText !== this.props.fallbackText && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-xs font-mono p-3 rounded-xl whitespace-pre-wrap leading-relaxed opacity-80" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)" }}>
          {this.props.fallbackText}
        </div>
      );
    }
    return this.props.children;
  }
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

  const remarkPlugins = useMemo(() => {
    return hasMath ? [remarkGfm, remarkMath] : [remarkGfm];
  }, [hasMath]);

  const rehypePlugins = useMemo(() => {
    return hasMath
      ? [[rehypeKatex, { throwOnError: false, strict: false, errorColor: "#ef4444" }]]
      : [];
  }, [hasMath]);

  return (
    <MarkdownErrorBoundary fallbackText={content}>
      <div className={`space-y-2 text-xs leading-relaxed font-[DM_Sans] ${className}`}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins as any}
          rehypePlugins={rehypePlugins as any}
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
              <ul className="ml-4 list-disc space-y-1" style={{ color: "var(--m-text)" }} {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="ml-4 list-decimal space-y-1" style={{ color: "var(--m-text)" }} {...props} />
            ),
            li: ({ node, ...props }) => <li className="my-0.5" {...props} />,
            blockquote: ({ node, ...props }) => (
              <blockquote
                className="border-l-3 pl-3 italic my-2 py-1.5 rounded-r-lg"
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
                className="text-blue-500 hover:underline cursor-pointer"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),
            img: ({ node, alt, ...props }) => (
              <img
                alt={alt || "Illustration"}
                className="rounded-xl max-h-72 object-contain my-2.5 border border-black/10 dark:border-white/10 shadow-sm cursor-pointer hover:opacity-95 transition"
                onClick={() => {
                  const src = (props as any).src;
                  if (src) window.open(src, "_blank");
                }}
                loading="lazy"
                {...props}
              />
            ),
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-3 rounded-xl border border-black/10 dark:border-white/10 shadow-xs">
                <table className="w-full text-left text-xs border-collapse" {...props} />
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 font-bold" {...props} />
            ),
            th: ({ node, ...props }) => (
              <th className="p-2.5 font-bold" style={{ color: "var(--m-text-heading)" }} {...props} />
            ),
            td: ({ node, ...props }) => (
              <td className="p-2.5 border-t border-black/5 dark:border-white/5" style={{ color: "var(--m-text)" }} {...props} />
            ),
            input: ({ node, ...props }) => (
              <input
                type="checkbox"
                disabled
                className="mr-2 rounded accent-[var(--m-primary)] align-middle cursor-default"
                {...props}
              />
            ),
            pre: ({ node, ...props }) => (
              <pre
                className="bg-[#1e1e1e] text-white p-3.5 rounded-xl overflow-x-auto text-[11px] mt-2 mb-2 custom-scrollbar shadow-sm"
                {...props}
              />
            ),
            code: ({ node, className, children, ...props }: any) => {
              const isInline = !className && !String(children).includes("\n");
              if (isInline) {
                return (
                  <code
                    className={`${className || ""} bg-black/5 dark:bg-white/10 rounded-md px-1.5 py-0.5 text-[10.5px] font-mono`}
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code className={`${className || ""} text-[10.5px] font-mono`} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererBase);
export default MarkdownRenderer;
