import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  CameraOff,
  RefreshCw,
  UploadCloud,
  Sparkles,
  Check,
  Copy,
  Brain,
  Notebook,
  MessageCircle,
  X,
  Loader2,
  ChevronRight,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { ImageAttachment } from "../../lib/ai-client";
import { solveHomeworkProblem, SolveMode } from "./snapAndSolveEngine";

interface SubjectOption {
  id: number;
  name: string;
  color?: string;
}

interface SnapAndSolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects?: SubjectOption[];
  defaultSubjectId?: number;
  onSaveToNotes?: (title: string, content: string, subjectId?: number) => void;
  onSaveToFlashcard?: (front: string, back: string, subjectId?: number) => void;
  onAskFollowUp?: (prompt: string, image?: ImageAttachment) => void;
}

type TabMode = "camera" | "upload";

export default function SnapAndSolveModal({
  isOpen,
  onClose,
  subjects = [],
  defaultSubjectId,
  onSaveToNotes,
  onSaveToFlashcard,
  onAskFollowUp,
}: SnapAndSolveModalProps) {
  const [tab, setTab] = useState<TabMode>("camera");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<ImageAttachment | null>(null);

  // Problem solving options
  const [solveMode, setSolveMode] = useState<SolveMode>("math");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | undefined>(defaultSubjectId);
  const [userNote, setUserNote] = useState("");

  // Solving states
  const [isSolving, setIsSolving] = useState(false);
  const [solution, setSolution] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success states
  const [copied, setCopied] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [savedCard, setSavedCard] = useState(false);

  // Camera video and canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start / Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        setTab("upload");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setHasCameraPermission(true);
    } catch (err) {
      console.warn("[SnapAndSolve] Camera access denied or unavailable:", err);
      setHasCameraPermission(false);
      setTab("upload");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isOpen && tab === "camera" && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, tab, capturedImage, startCamera, stopCamera]);

  // Handle modal close
  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setSolution(null);
    setErrorMsg(null);
    setUserNote("");
    setSavedNote(false);
    setSavedCard(false);
    onClose();
  };

  // Flip camera (rear/front)
  const toggleCameraFacing = () => {
    setFacingMode((curr) => (curr === "environment" ? "user" : "environment"));
  };

  // Capture photo from video feed
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");

    setCapturedImage({
      name: `snap_${Date.now()}.jpg`,
      mimeType: "image/jpeg",
      base64Data,
      dataUrl,
    });
    stopCamera();
  };

  // Handle file input upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.replace(/^data:.*?;base64,/, "");
      setCapturedImage({
        name: file.name,
        mimeType: file.type || "image/jpeg",
        base64Data,
        dataUrl,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setSolution(null);
    setErrorMsg(null);
    setSavedNote(false);
    setSavedCard(false);
    if (tab === "camera") {
      startCamera();
    }
  };

  // Solve problem with Gemini Vision
  const handleSolve = async () => {
    if (!capturedImage) return;
    setIsSolving(true);
    setErrorMsg(null);

    const subjectObj = subjects.find((s) => s.id === selectedSubjectId);

    const result = await solveHomeworkProblem({
      image: capturedImage,
      mode: solveMode,
      userNote,
      subjectName: subjectObj?.name,
    });

    setIsSolving(false);

    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setSolution(result.fullSolution);
    }
  };

  // Copy solution
  const handleCopy = () => {
    if (!solution) return;
    navigator.clipboard.writeText(solution);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save to Notes
  const handleSaveNote = () => {
    if (!solution || !onSaveToNotes) return;
    const title = userNote.trim()
      ? `Snap & Solve: ${userNote.slice(0, 35)}`
      : `Snap & Solve: ${solveMode.toUpperCase()} Problem`;
    onSaveToNotes(title, solution, selectedSubjectId);
    setSavedNote(true);
  };

  // Save as Flashcard
  const handleSaveFlashcard = () => {
    if (!solution || !onSaveToFlashcard) return;
    const front = userNote.trim() || `Problem: ${solveMode === "math" ? "Math Derivation" : "Key Concept"}`;
    onSaveToFlashcard(front, solution.slice(0, 1500), selectedSubjectId);
    setSavedCard(true);
  };

  // Ask Follow-up in Coach
  const handleAskFollowUp = () => {
    if (!solution || !onAskFollowUp) return;
    const prompt = `I have a question about this solved homework problem:\n\n${solution.slice(0, 800)}\n\nMy question: `;
    onAskFollowUp(prompt, capturedImage || undefined);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-3xl overflow-hidden border shadow-2xl flex flex-col my-auto max-h-[92vh]"
        style={{
          backgroundColor: "var(--m-surface)",
          borderColor: "var(--m-border)",
          color: "var(--m-text)",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between border-b shrink-0"
          style={{
            borderColor: "var(--m-border-light)",
            backgroundColor: "var(--m-surface-alt)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid size-10 place-items-center rounded-2xl shadow-sm"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <Camera size={20} />
            </div>
            <div>
              <h2 className="font-[Roboto_Slab] text-base font-bold flex items-center gap-1.5" style={{ color: "var(--m-text-heading)" }}>
                Snap & Solve Assistant
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">
                  AI Vision
                </span>
              </h2>
              <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>
                Point camera at equations, diagrams, or homework questions
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-xl transition hover:opacity-75"
            style={{ backgroundColor: "var(--m-surface)", color: "var(--m-text-sub)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
          {/* Top Switcher (Camera vs Upload) when not previewing photo */}
          {!capturedImage && (
            <div className="flex rounded-2xl p-1 border gap-1" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}>
              <button
                type="button"
                onClick={() => setTab("camera")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === "camera" ? "shadow-sm" : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: tab === "camera" ? "var(--m-surface)" : "transparent",
                  color: tab === "camera" ? "var(--m-primary)" : "var(--m-text-sub)",
                }}
              >
                <Camera size={15} />
                Live Camera
              </button>
              <button
                type="button"
                onClick={() => setTab("upload")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === "upload" ? "shadow-sm" : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: tab === "upload" ? "var(--m-surface)" : "transparent",
                  color: tab === "upload" ? "var(--m-primary)" : "var(--m-text-sub)",
                }}
              >
                <UploadCloud size={15} />
                Upload Photo / Screenshot
              </button>
            </div>
          )}

          {/* VIEW 1: Camera Viewfinder */}
          {!capturedImage && tab === "camera" && (
            <div className="space-y-4">
              <div
                className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-inner border"
                style={{ borderColor: "var(--m-border)" }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Reticle / Scanner Overlay */}
                <div className="absolute inset-6 pointer-events-none border border-white/25 rounded-2xl">
                  {/* Corner Marks */}
                  <div className="absolute -top-1 -left-1 size-6 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 size-6 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 size-6 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 size-6 border-b-2 border-r-2 border-indigo-400 rounded-br-lg" />

                  {/* Animated laser scan line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_10px_#818cf8] animate-pulse top-1/2 -translate-y-1/2" />
                </div>

                {/* Helper overlay tag */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-medium text-white border border-white/10 pointer-events-none">
                  Align problem inside the frame
                </div>
              </div>

              {/* Shutter & Controls Bar */}
              <div className="flex items-center justify-center gap-6 pt-1">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-3 rounded-2xl border transition hover:scale-105 active:scale-95"
                  style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
                  title="Switch Front/Back Camera"
                >
                  <RefreshCw size={18} style={{ color: "var(--m-text-sub)" }} />
                </button>

                {/* Big Shutter Button */}
                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="group relative size-18 rounded-full border-4 border-white/40 p-1 transition hover:scale-105 active:scale-95 shadow-xl"
                  style={{ backgroundColor: "var(--m-primary)" }}
                  title="Capture Photo"
                >
                  <div className="size-full rounded-full bg-white/90 transition group-hover:scale-90" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-2xl border transition hover:scale-105 active:scale-95"
                  style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
                  title="Upload from Gallery"
                >
                  <UploadCloud size={18} style={{ color: "var(--m-text-sub)" }} />
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: File Upload Box */}
          {!capturedImage && tab === "upload" && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition hover:border-[var(--m-primary)]"
              style={{
                backgroundColor: "var(--m-surface-alt)",
                borderColor: "var(--m-border)",
              }}
            >
              <div
                className="size-14 mx-auto rounded-2xl grid place-items-center mb-3 shadow"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                  color: "var(--m-primary)",
                }}
              >
                <UploadCloud size={28} />
              </div>
              <h3 className="text-sm font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
                Click or Drop Question Photo Here
              </h3>
              <p className="text-xs mt-1" style={{ color: "var(--m-text-sub)" }}>
                Supports handwritten notes, textbook pages, math formulas, or screenshots (PNG, JPG, WEBP)
              </p>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* VIEW 3: Captured Image Preview & Configuration Options */}
          {capturedImage && (
            <div className="space-y-4">
              {/* Photo Preview Strip */}
              <div
                className="relative rounded-2xl overflow-hidden border flex items-center justify-between p-3 gap-3"
                style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <img
                    src={capturedImage.dataUrl}
                    alt="Captured question"
                    className="size-16 rounded-xl object-cover border shadow-sm shrink-0"
                    style={{ borderColor: "var(--m-border)" }}
                  />
                  <div className="truncate">
                    <span className="text-xs font-bold block truncate" style={{ color: "var(--m-text-heading)" }}>
                      {capturedImage.name}
                    </span>
                    <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 mt-0.5">
                      <Check size={12} /> Ready for analysis
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={isSolving}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition hover:opacity-80"
                  style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}
                >
                  Retake
                </button>
              </div>

              {/* Mode Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: "var(--m-text-muted)" }}>
                  Select Solving Mode:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "math", label: "Math & Physics", desc: "Step-by-step KaTeX derivation", icon: "📐" },
                    { id: "diagram", label: "Science & Diagram", desc: "Labels & biological cycles", icon: "🔬" },
                    { id: "general", label: "General Q&A", desc: "Homework & definitions", icon: "📝" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSolveMode(m.id as SolveMode)}
                      disabled={isSolving}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        solveMode === m.id
                          ? "ring-2 ring-[var(--m-primary)] shadow-sm"
                          : "opacity-75 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor: solveMode === m.id ? "var(--m-surface-alt)" : "var(--m-surface)",
                        borderColor: solveMode === m.id ? "var(--m-primary)" : "var(--m-border)",
                      }}
                    >
                      <span className="text-lg block mb-1">{m.icon}</span>
                      <span className="text-xs font-bold block" style={{ color: "var(--m-text-heading)" }}>
                        {m.label}
                      </span>
                      <span className="text-[10px] leading-tight block opacity-70 mt-0.5" style={{ color: "var(--m-text-sub)" }}>
                        {m.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Subject & Prompt customization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subjects.length > 0 && (
                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: "var(--m-text-sub)" }}>
                      Link to Subject (Optional)
                    </label>
                    <select
                      value={selectedSubjectId || ""}
                      onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : undefined)}
                      disabled={isSolving}
                      className="w-full rounded-xl p-2 text-xs border outline-none font-medium"
                      style={{
                        backgroundColor: "var(--m-surface-alt)",
                        borderColor: "var(--m-border)",
                        color: "var(--m-text)",
                      }}
                    >
                      <option value="">None / General</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={subjects.length === 0 ? "sm:col-span-2" : ""}>
                  <label className="text-xs font-bold block mb-1" style={{ color: "var(--m-text-sub)" }}>
                    Additional Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    disabled={isSolving}
                    placeholder="e.g. Focus on Part B, find the derivative"
                    className="w-full rounded-xl p-2 text-xs border outline-none"
                    style={{
                      backgroundColor: "var(--m-surface-alt)",
                      borderColor: "var(--m-border)",
                      color: "var(--m-text)",
                    }}
                  />
                </div>
              </div>

              {/* Solve Button */}
              {!solution && (
                <button
                  type="button"
                  onClick={handleSolve}
                  disabled={isSolving}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--m-primary)",
                    color: "var(--m-primary-text)",
                  }}
                >
                  {isSolving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Analyzing Image & Deriving Solution...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Solve with AI Vision
                    </>
                  )}
                </button>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <HelpCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* VIEW 4: Formatted Solution */}
              {solution && (
                <div className="space-y-4 pt-2">
                  <div
                    className="rounded-2xl p-4 border overflow-x-auto"
                    style={{
                      backgroundColor: "var(--m-surface-alt)",
                      borderColor: "var(--m-border)",
                    }}
                  >
                    <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: "var(--m-border-light)" }}>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Check size={14} /> Solved Step-by-Step
                      </span>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition hover:opacity-80"
                        style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}
                      >
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>

                    <div className="text-sm leading-relaxed">
                      <MarkdownRenderer content={solution} />
                    </div>
                  </div>

                  {/* 1-Click Integration Action Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {onSaveToNotes && (
                      <button
                        type="button"
                        onClick={handleSaveNote}
                        disabled={savedNote}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition hover:scale-102 active:scale-98 ${
                          savedNote ? "opacity-60 bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : ""
                        }`}
                        style={{
                          backgroundColor: savedNote ? undefined : "var(--m-surface)",
                          borderColor: savedNote ? undefined : "var(--m-border)",
                        }}
                      >
                        <Notebook size={14} />
                        {savedNote ? "Added to Notes ✓" : "Save to Notes"}
                      </button>
                    )}

                    {onSaveToFlashcard && (
                      <button
                        type="button"
                        onClick={handleSaveFlashcard}
                        disabled={savedCard}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition hover:scale-102 active:scale-98 ${
                          savedCard ? "opacity-60 bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : ""
                        }`}
                        style={{
                          backgroundColor: savedCard ? undefined : "var(--m-surface)",
                          borderColor: savedCard ? undefined : "var(--m-border)",
                        }}
                      >
                        <Brain size={14} />
                        {savedCard ? "Card Created ✓" : "Make Flashcard"}
                      </button>
                    )}

                    {onAskFollowUp && (
                      <button
                        type="button"
                        onClick={handleAskFollowUp}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition hover:scale-102 active:scale-98"
                        style={{
                          backgroundColor: "var(--m-primary)",
                          color: "var(--m-primary-text)",
                        }}
                      >
                        <MessageCircle size={14} />
                        Ask Coach More
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
