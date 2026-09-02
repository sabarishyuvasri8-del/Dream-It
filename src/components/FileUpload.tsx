import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AttachedFile, uploadAttachedFile } from "../lib/supabase";

interface FileUploadProps {
  accessToken: string;
  userId: string;
  subjectId: number;
  taskId?: number;
  onUploadSuccess: (newFile: AttachedFile) => void;
  allowAutopilot?: boolean;
}

const ALLOWED_EXTENSIONS = [
  "pdf", "png", "jpg", "jpeg", "gif", "webp", "docx", "doc", "pptx", "xlsx", "txt"
];

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accessToken,
  userId,
  subjectId,
  taskId,
  onUploadSuccess,
  allowAutopilot = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Enforce max file size: ~25MB
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage(`File "${file.name}" exceeds the 25MB max size limit (${formatFileSize(file.size)}).`);
      return;
    }

    // 2. Validate file extension
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMessage(`Format ".${ext}" not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ").toUpperCase()}`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(25);

    try {
      // Animated progress interval
      const timer = window.setInterval(() => {
        setUploadProgress((p) => (p < 85 ? p + 15 : p));
      }, 150);

      const newFile = await uploadAttachedFile(accessToken, userId, file, subjectId, taskId, selectedKind || undefined);

      window.clearInterval(timer);
      setUploadProgress(100);

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setSuccessMessage(`Successfully uploaded "${file.name}"!`);
        onUploadSuccess(newFile);
      }, 300);
    } catch (err: any) {
      setIsUploading(false);
      setUploadProgress(0);
      setErrorMessage(err.message || "Failed uploading file. Please try again.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndUpload(file);
    }
  };

  return (
    <div className="space-y-3">
      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
          isDragging
            ? "scale-[1.01]"
            : "hover:scale-[1.005]"
        }`}
        style={{
          borderColor: isDragging ? "var(--m-primary)" : "var(--m-border)",
          backgroundColor: isDragging
            ? "color-mix(in srgb, var(--m-primary) 12%, transparent)"
            : "var(--m-surface-alt)",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.doc,.pptx,.xlsx,.txt"
        />

        <div
          className="grid size-12 place-items-center rounded-2xl shadow-xs mb-2"
          style={{
            backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
            color: "var(--m-primary)",
          }}
        >
          <UploadCloud size={24} />
        </div>

        <p className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>
          {isDragging ? "Drop your file here..." : "Drag & drop attachment here, or "}
          <span className="underline font-extrabold" style={{ color: "var(--m-primary)" }}>browse files</span>
        </p>

        <p className="mt-1 text-[11px]" style={{ color: "var(--m-text-sub)" }}>
          Supports PDF, Images, Word, Slides, Sheets & Text (Max 25MB)
        </p>

        {isUploading && (
          <div className="mt-4 w-full max-w-xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: "var(--m-primary)" }}>
              <span className="flex items-center gap-1">
                <Loader2 size={13} className="animate-spin" /> Uploading to cloud...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--m-border)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, backgroundColor: "var(--m-primary)" }}
              />
            </div>
          </div>
        )}
      </div>
      
      {allowAutopilot && (
        <div className="flex items-center gap-2 px-2 text-xs" style={{ color: "var(--m-text-sub)" }}>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={selectedKind === "syllabus"} onChange={(e) => setSelectedKind(e.target.checked ? "syllabus" : "")} className="rounded" />
            Process with Autopilot (Syllabus/Transcript)
          </label>
        </div>
      )}

      {/* Error Toast Banner */}
      {errorMessage && (
        <div className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-0.5 text-red-600 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Success Toast Banner */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-0.5 text-emerald-600 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
