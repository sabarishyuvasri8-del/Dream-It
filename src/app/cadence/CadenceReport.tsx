import React from "react";
import { Download, Activity, FileText, CheckCircle2, AlertTriangle, Info, Bot } from "lucide-react";
import type { CadenceResponse } from "./cadence-api";

interface CadenceReportProps {
  report: CadenceResponse;
  onRestart: () => void;
}

export default function CadenceReport({ report, onRestart }: CadenceReportProps) {
  const downloadPdf = () => {
    // Since we are using the mock AI backend which doesn't generate a base64 PDF,
    // we use the browser's native print-to-pdf functionality which actually looks great.
    window.print();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "var(--m-success)";
    if (score >= 50) return "var(--m-warning)";
    return "var(--m-danger)";
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-4xl mx-auto font-[DM_Sans] cadence-print-container">
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          /* Hide sidebar/navbar elements */
          nav, aside, .sidebar { display: none !important; }
          
          /* Show only the report content cleanly */
          .cadence-print-container {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Force backgrounds and borders to print properly */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Simplify layout colors for print readability */
          .cadence-print-container > div {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
      <div 
        className="w-full rounded-3xl p-6 sm:p-10 shadow-xl"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          border: "1px solid var(--m-border)"
        }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-[Roboto_Slab] font-bold" style={{ color: "var(--m-text-heading)" }}>
              Screening Report
            </h1>
            <p className="text-sm mt-1 flex items-center gap-2" style={{ color: "var(--m-text-sub)" }}>
              <CheckCircle2 size={16} style={{ color: "var(--m-success)" }} />
              Analysis complete. Zero audio retained.
            </p>
          </div>
          <button
            onClick={downloadPdf}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition hover:scale-[1.02] shadow-md w-full sm:w-auto justify-center print:hidden"
            style={{
              backgroundColor: "var(--m-primary)",
              color: "var(--m-primary-text)",
            }}
          >
            <Download size={18} />
            Download PDF
          </button>
        </div>

        {/* Top Score Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div 
            className="rounded-2xl p-6 flex items-center gap-6"
            style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
          >
            <div 
              className="relative flex items-center justify-center size-24 rounded-full border-4 shadow-inner bg-white"
              style={{ borderColor: getScoreColor(report.score) }}
            >
              <span className="text-3xl font-bold font-[Roboto_Slab]" style={{ color: getScoreColor(report.score) }}>
                {report.score.toFixed(0)}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--m-text-sub)" }}>Overall Score</h3>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--m-text)" }}>
                Model Confidence: <strong style={{ color: "var(--m-text-heading)" }}>{(report.confidence * 100).toFixed(1)}%</strong>
              </p>
            </div>
          </div>

          <div 
            className="rounded-2xl p-6"
            style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
          >
            <h3 className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider mb-2" style={{ color: "var(--m-text-sub)" }}>
              <FileText size={16} /> Clinical Narrative
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--m-text)" }}>
              {report.narrative || "No narrative provided."}
            </p>
          </div>
        </div>

        {/* Subsystems Breakdown */}
        <h2 className="text-xl font-[Roboto_Slab] font-bold text-center mb-8" style={{ color: "var(--m-text-heading)" }}>
          Screening Results
        </h2>

        {report.ai_reading_analysis && (
          <div className="mb-6 rounded-2xl p-6" style={{ background: "color-mix(in srgb, var(--m-primary) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--m-primary) 30%, transparent)" }}>
            <div className="flex items-center gap-2 mb-3 font-bold" style={{ color: "var(--m-primary)" }}>
              <Bot size={18} />
              AI Reading Analysis (Gemma)
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--m-text-heading)" }}>
              {report.ai_reading_analysis}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {Object.entries(report.subsystems || {}).map(([key, val]) => (
            <div 
              key={key} 
              className="rounded-2xl p-4 flex flex-col justify-between"
              style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
            >
              <span className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-sub)" }}>{key}</span>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--m-text-heading)" }}>{val.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Biomarkers */}
        {report.biomarkers && report.biomarkers.length > 0 && (
          <>
            <h3 className="font-bold text-lg mb-4 font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>Key Biomarkers</h3>
            <div className="space-y-3 mb-8">
              {report.biomarkers.map((b, idx) => (
                <div 
                  key={idx}
                  className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
                >
                  <div className="flex-1">
                    <span className="font-bold text-sm" style={{ color: "var(--m-text-heading)" }}>{b.name}</span>
                    <div className="text-xs mt-1 font-mono" style={{ color: "var(--m-text-sub)" }}>Value: {b.value.toFixed(4)}</div>
                  </div>
                  <div className="flex-1 w-full sm:max-w-xs flex flex-col">
                    <div className="flex justify-between text-xs mb-1 font-bold" style={{ color: "var(--m-text-sub)" }}>
                      <span>Percentile</span>
                      <span>{b.percentile.toFixed(0)}th</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--m-border)" }}>
                      <div 
                        className="h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.max(0, Math.min(100, b.percentile))}%`, backgroundColor: "var(--m-accent)" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-center mt-10">
          <button
            onClick={onRestart}
            className="rounded-xl px-8 py-3.5 text-sm font-bold transition hover:scale-[1.02] print:hidden"
            style={{
              backgroundColor: "var(--m-surface-alt)",
              color: "var(--m-text)",
              border: "1px solid var(--m-border)"
            }}
          >
            Start New Screening
          </button>
        </div>
      </div>
    </div>
  );
}
