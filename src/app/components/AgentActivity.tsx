import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Cloud, FileText, Loader2, PlayCircle, Plus, Sparkles, XCircle } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";

export interface AgentRunLog {
  id: string;
  triggerSource: string;
  timestamp: string;
  extractedItems: any[];
  plan: any[];
  executionResults: { success: boolean; messages: string[]; errors: string[] };
}

interface AgentActivityProps {
  serverUrl: string;
}

export default function AgentActivity({ serverUrl }: AgentActivityProps) {
  const { getToken } = useAuth();
  const [runs, setRuns] = useState<AgentRunLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      
      const res = await fetch(`${serverUrl}/autopilot/runs`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (e) {
      console.error("Failed to fetch agent runs:", e);
    } finally {
      setLoading(false);
    }
  };

  // Poll every 5 seconds for the hackathon demo live updates
  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="animate-spin" style={{ color: "var(--m-text-sub)" }} />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-center" style={{ borderColor: "var(--m-border-light)" }}>
        <Bot size={24} className="mx-auto mb-2 opacity-50" style={{ color: "var(--m-text-sub)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--m-text-muted)" }}>No agent activity yet.</p>
        <p className="text-xs mt-1" style={{ color: "var(--m-text-sub)" }}>Upload a syllabus or paste text to trigger Autopilot.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <div key={run.id} className="overflow-hidden rounded-xl border shadow-sm minimal-surface" style={{ borderColor: "var(--m-border-light)" }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--m-border-light)", backgroundColor: "var(--m-surface-alt)" }}>
            <div className="flex items-center gap-2">
              <div className="grid size-6 place-items-center rounded-md" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                <Bot size={14} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Autopilot Run</p>
                <p className="text-[10px]" style={{ color: "var(--m-text-sub)" }}>Trigger: {run.triggerSource} • {new Date(run.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5" style={{ backgroundColor: run.executionResults?.success ? "var(--m-surface)" : "var(--m-surface)", color: run.executionResults?.success ? "var(--m-success)" : "var(--m-danger)", border: "1px solid var(--m-border)" }}>
              {run.executionResults?.success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
              {run.executionResults?.success ? "Success" : "Failed"}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Stage A: Extraction */}
            <div>
              <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: "var(--m-text)" }}>
                <FileText size={12} style={{ color: "var(--m-primary)" }} /> Stage A: Extraction
              </p>
              {(run.extractedItems || []).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(run.extractedItems || []).map((item, idx) => (
                    <div key={idx} className="rounded-lg border p-2 text-[10px]" style={{ borderColor: "var(--m-border-light)" }}>
                      <p className="font-bold truncate" style={{ color: "var(--m-text-heading)" }}>{item.title}</p>
                      <div className="flex justify-between mt-1" style={{ color: "var(--m-text-sub)" }}>
                        <span>Type: {item.type}</span>
                        <span>Confidence: {Math.round(item.confidence * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic" style={{ color: "var(--m-text-sub)" }}>No actionable items extracted.</p>
              )}
            </div>

            {/* Stage B: Planning & Execution */}
            {(run.plan || []).length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: "var(--m-border-light)" }}>
                <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: "var(--m-text)" }}>
                  <Sparkles size={12} style={{ color: "var(--m-warning)" }} /> Stage B: Planning & Execution
                </p>
                <div className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: "var(--m-border)" }}>
                  {(run.plan || []).map((action, idx) => (
                    <div key={idx} className="text-[10px] flex items-start gap-1.5" style={{ color: "var(--m-text-sub)" }}>
                      <PlayCircle size={10} className="mt-0.5 shrink-0" style={{ color: "var(--m-primary)" }} />
                      <span>{action.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Results / Errors */}
            {(run.executionResults?.messages || []).length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: "var(--m-border-light)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "var(--m-text)" }}>Results:</p>
                <ul className="list-disc list-inside text-[10px]" style={{ color: "var(--m-success)" }}>
                  {(run.executionResults?.messages || []).map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {(run.executionResults?.errors || []).length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: "var(--m-border-light)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "var(--m-danger)" }}>Errors:</p>
                <ul className="list-disc list-inside text-[10px]" style={{ color: "var(--m-danger)" }}>
                  {(run.executionResults?.errors || []).map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
