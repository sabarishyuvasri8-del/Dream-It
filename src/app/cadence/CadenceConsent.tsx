import React from "react";
import { ShieldCheck, Mic, Activity, ArrowRight } from "lucide-react";

interface CadenceConsentProps {
  onAccept: () => void;
}

export default function CadenceConsent({ onAccept }: CadenceConsentProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 w-full max-w-2xl mx-auto font-[DM_Sans]">
      <div 
        className="w-full rounded-3xl p-8 shadow-xl"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          border: "1px solid var(--m-border)"
        }}
      >
        <div className="flex justify-center mb-6">
          <div 
            className="grid size-14 place-items-center rounded-2xl shadow-sm"
            style={{
              backgroundColor: "var(--m-accent)",
              color: "var(--m-accent-text)"
            }}
          >
            <Activity size={28} />
          </div>
        </div>

        <h1 className="text-2xl font-[Roboto_Slab] font-bold text-center mb-4" style={{ color: "var(--m-text-heading)" }}>
          Cadence Voice Screening
        </h1>
        
        <p className="text-center mb-8 text-sm leading-relaxed" style={{ color: "var(--m-text-sub)" }}>
          A Parkinson's voice-screening tool that uses advanced signal processing and modeling 
          to analyze your voice across four clinical domains: Phonation, Prosody, Articulation, and Rate.
        </p>

        <div className="space-y-4 mb-8">
          <div 
            className="flex items-start gap-4 p-4 rounded-xl"
            style={{ backgroundColor: "var(--m-surface-alt)" }}
          >
            <Mic className="mt-1" size={20} style={{ color: "var(--m-primary)" }} />
            <div>
              <h3 className="font-bold text-sm" style={{ color: "var(--m-text-heading)" }}>Three Short Voice Tasks</h3>
              <p className="text-xs mt-1" style={{ color: "var(--m-text-sub)" }}>
                You will be asked to record a sustained vowel, read a short passage, and perform a rapid syllable repetition (pa-ta-ka).
              </p>
            </div>
          </div>

          <div 
            className="flex items-start gap-4 p-4 rounded-xl"
            style={{ backgroundColor: "var(--m-surface-alt)" }}
          >
            <ShieldCheck className="mt-1" size={20} style={{ color: "var(--m-success)" }} />
            <div>
              <h3 className="font-bold text-sm" style={{ color: "var(--m-text-heading)" }}>Zero Persistence Guarantee</h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--m-text-sub)" }}>
                Your privacy is paramount. **Your audio is never stored or saved anywhere.** It is kept in your device's memory just long enough to be analyzed by the Cadence engine, and discarded immediately after the report is generated.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <button
            onClick={onAccept}
            className="flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold transition hover:scale-[1.02] shadow-md w-full sm:w-auto justify-center"
            style={{
              backgroundColor: "var(--m-primary)",
              color: "var(--m-primary-text)",
            }}
          >
            I Understand & Continue
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
