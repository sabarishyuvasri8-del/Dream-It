import React, { useState, useMemo } from "react";
import { useTheme } from "../../lib/ThemeContext";
import ThemeSelector from "../components/ThemeSelector";
import { Palette, LoaderCircle, AlertTriangle } from "lucide-react";
import CadenceConsent from "./CadenceConsent";
import CadenceTaskRecorder from "./CadenceTaskRecorder";
import CadenceReport from "./CadenceReport";
import CadenceSpeechCoach from "./CadenceSpeechCoach";
import { submitScreening, getRandomPassage, CadenceResponse } from "./cadence-api";
import { Link } from "react-router";

type Step = "consent" | "vowel" | "reading" | "ddk" | "submitting" | "report" | "error";

export default function CadenceApp() {
  const { themeConfig } = useTheme();
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  
  const [currentStep, setCurrentStep] = useState<Step>("consent");
  const [vowelBlob, setVowelBlob] = useState<Blob | null>(null);
  const [readingBlob, setReadingBlob] = useState<Blob | null>(null);
  const [readingTranscript, setReadingTranscript] = useState<string>("");
  const [ddkBlob, setDdkBlob] = useState<Blob | null>(null);
  
  const [reportData, setReportData] = useState<CadenceResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Pick a random passage once per screening session
  const [currentPassage, setCurrentPassage] = useState<string>(getRandomPassage());

  const handleConsentAccept = () => setCurrentStep("vowel");

  const handleVowelComplete = (blob: Blob) => {
    setVowelBlob(blob);
    setCurrentStep("reading");
  };

  const handleReadingComplete = (blob: Blob, transcript?: string) => {
    setReadingBlob(blob);
    if (transcript) setReadingTranscript(transcript);
    setCurrentStep("ddk");
  };

  const handleDdkComplete = async (blob: Blob) => {
    setDdkBlob(blob);
    setCurrentStep("submitting");

    try {
      // Pass the transcript AND the passage so the AI can compare them
      const report = await submitScreening(
        vowelBlob!, readingBlob!, blob, "en", readingTranscript, currentPassage
      );
      
      // Attach the transcript to the report for the Speech Coach chatbot
      report.transcript = readingTranscript || "";

      setReportData(report);
      setCurrentStep("report");
    } catch (err: any) {
      setErrorMsg(err.message || "An unknown error occurred during submission.");
      setCurrentStep("error");
    } finally {
      // Zero persistence: drop audio blobs from memory immediately
      setVowelBlob(null);
      setReadingBlob(null);
      setDdkBlob(null);
    }
  };

  const handleRestart = () => {
    setReportData(null);
    setErrorMsg("");
    setReadingTranscript("");
    setCurrentPassage(getRandomPassage()); // Pick a NEW random passage
    setCurrentStep("consent");
  };

  return (
    <main
      className={`min-h-screen p-4 sm:p-6 font-[DM_Sans] flex flex-col ${themeConfig.cssClass}`}
      style={{
        backgroundColor: "var(--m-bg)",
        color: "var(--m-text)",
      }}
    >
      {/* Header Bar */}
      <header className="flex justify-between items-center mb-8 w-full max-w-6xl mx-auto">
        <Link 
          to="/" 
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition hover:scale-105"
          style={{
            background: "var(--m-surface)",
            border: "1px solid var(--m-border)",
            color: "var(--m-text-heading)",
          }}
        >
          ← Back to Dream It
        </Link>
        <button
          type="button"
          onClick={() => setThemeSelectorOpen(true)}
          className="minimal-surface flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition hover:scale-105 shadow-md"
          style={{ color: "var(--m-text-heading)" }}
        >
          <Palette size={15} style={{ color: "var(--m-primary)" }} />
          <span className="hidden sm:inline">{themeConfig.name}</span>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full max-w-6xl mx-auto">
        {/* Progress Indicator */}
        {["vowel", "reading", "ddk", "submitting"].includes(currentStep) && (
          <div className="flex justify-center gap-2 mb-8">
            {["vowel", "reading", "ddk", "submitting"].map((s, idx) => {
              const steps = ["vowel", "reading", "ddk", "submitting"];
              const currentIndex = steps.indexOf(currentStep);
              const isActive = idx === currentIndex;
              const isPast = idx < currentIndex;
              return (
                <div 
                  key={s} 
                  className={`h-2 rounded-full transition-all duration-500 ${isActive ? 'w-12' : 'w-4'}`}
                  style={{ 
                    backgroundColor: isActive || isPast ? "var(--m-primary)" : "var(--m-border)",
                    opacity: isActive ? 1 : (isPast ? 0.6 : 0.3)
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Step Rendering */}
        {currentStep === "consent" && (
          <CadenceConsent onAccept={handleConsentAccept} />
        )}

        {currentStep === "vowel" && (
          <CadenceTaskRecorder 
            title="Task 1: Sustained Vowel"
            description="Take a deep breath and say 'Ahhhh' at a comfortable pitch and loudness for as long and as steadily as you can."
            minDurationSec={2}
            onComplete={handleVowelComplete}
          />
        )}

        {currentStep === "reading" && (
          <CadenceTaskRecorder 
            title="Task 2: Passage Reading"
            description="Please read the standard passage displayed on the screen clearly and naturally."
            passage={currentPassage}
            minDurationSec={3}
            onComplete={handleReadingComplete}
          />
        )}

        {currentStep === "ddk" && (
          <CadenceTaskRecorder 
            title="Task 3: Rapid Syllables"
            description="Take a deep breath and repeat the syllables 'pa-ta-ka' as quickly and clearly as possible until you run out of breath."
            minDurationSec={1}
            onComplete={handleDdkComplete}
          />
        )}

        {currentStep === "submitting" && (
          <div className="flex flex-col items-center justify-center py-20">
            <LoaderCircle className="animate-spin mb-4" size={48} style={{ color: "var(--m-primary)" }} />
            <h2 className="text-xl font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
              Analyzing Your Speech...
            </h2>
            <p className="text-sm mt-2 text-center max-w-md" style={{ color: "var(--m-text-sub)" }}>
              {readingTranscript
                ? "Our AI is comparing your reading against the passage and generating a personalized report."
                : "No speech was detected. The AI will note this in your report."}
            </p>
          </div>
        )}

        {currentStep === "report" && reportData && (
          <CadenceReport report={reportData} onRestart={handleRestart} />
        )}

        {currentStep === "error" && (
          <div className="flex flex-col items-center justify-center p-6 w-full max-w-lg mx-auto mt-10">
            <div 
              className="w-full rounded-3xl p-8 shadow-xl text-center"
              style={{ backgroundColor: "var(--m-surface-solid)", border: "1px solid var(--m-border)" }}
            >
              <div 
                className="mx-auto grid size-16 place-items-center rounded-2xl shadow-sm mb-6"
                style={{ backgroundColor: "color-mix(in srgb, var(--m-danger) 15%, transparent)", color: "var(--m-danger)" }}
              >
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--m-text-heading)" }}>Analysis Failed</h2>
              <p className="text-sm mb-6 font-mono bg-black/5 p-3 rounded-lg" style={{ color: "var(--m-danger)" }}>
                {errorMsg}
              </p>
              <button
                onClick={handleRestart}
                className="rounded-xl px-8 py-3.5 text-sm font-bold transition hover:scale-[1.02] shadow-md"
                style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Speech Coach AI Chatbot — only shows on report page */}
      {currentStep === "report" && reportData && (
        <CadenceSpeechCoach report={reportData} />
      )}

      <ThemeSelector
        isOpen={themeSelectorOpen}
        onClose={() => setThemeSelectorOpen(false)}
      />
    </main>
  );
}
