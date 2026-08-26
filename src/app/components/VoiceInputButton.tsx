import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";

interface VoiceInputButtonProps {
  /** The current text value of the input */
  value: string;
  /** Callback to update the text value (supports live interim results) */
  onChange: (text: string) => void;
  disabled?: boolean;
  size?: number;
}

/**
 * A professional microphone button that uses the browser's SpeechRecognition API.
 * Features:
 * - Live interim results (you see words as you speak)
 * - Seamlessly appends to existing text
 * - Auto-restarts on pause to keep listening if desired, or stops gracefully
 */
export default function VoiceInputButton({ value, onChange, disabled = false, size = 16 }: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Track the text that existed before the current dictation session started
  const initialTextRef = useRef("");
  // Track the finalized text recognized during the current dictation session
  const finalSessionTranscriptRef = useRef("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      // Manual stop
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // Start
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // Enable live feedback!
    recognition.lang = "en-US";

    // Snapshot the current text so we can append to it
    initialTextRef.current = value;
    finalSessionTranscriptRef.current = "";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        finalSessionTranscriptRef.current += finalTranscript;
      }

      // Combine existing text + finalized session text + interim live text
      const parts = [
        initialTextRef.current,
        finalSessionTranscriptRef.current,
        interimTranscript
      ].filter(t => t && t.trim().length > 0);
      
      onChange(parts.join(" "));
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // The browser API often stops automatically after a few seconds of silence.
      // We'll update the state to reflect this so the UI doesn't get stuck in "listening" mode.
      setIsListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
    }
  }, [isListening, value, onChange]);

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      title={isListening ? "Stop listening" : "Voice input"}
      className={`shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 disabled:opacity-40 relative overflow-hidden size-9 ${
        isListening ? "animate-pulse" : ""
      }`}
      style={{
        backgroundColor: isListening
          ? "var(--m-danger, #ef4444)"
          : "color-mix(in srgb, var(--m-primary) 12%, transparent)",
        color: isListening ? "#fff" : "var(--m-primary)",
        border: isListening ? "none" : "1px solid color-mix(in srgb, var(--m-primary) 25%, transparent)",
        boxShadow: isListening ? "0 0 15px color-mix(in srgb, var(--m-danger) 50%, transparent)" : "none"
      }}
    >
      {/* Ripple effect when listening */}
      {isListening && (
        <span className="absolute inset-0 rounded-xl bg-white/20 animate-ping" style={{ animationDuration: '1.5s' }} />
      )}
      
      {isListening ? <MicOff size={size} className="relative z-10" /> : <Mic size={size} className="relative z-10" />}
    </button>
  );
}
