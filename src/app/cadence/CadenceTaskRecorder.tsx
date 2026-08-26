import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, RotateCcw, ArrowRight, AlertTriangle } from "lucide-react";
import { audioBufferToWav } from "./cadence-audio";

interface CadenceTaskRecorderProps {
  title: string;
  description: string;
  passage?: string;
  minDurationSec: number;
  onComplete: (audioBlob: Blob, transcript?: string) => void;
}

export default function CadenceTaskRecorder({
  title,
  description,
  passage,
  minDurationSec,
  onComplete,
}: CadenceTaskRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);

  // Audio visualizer state
  const [volumeLine, setVolumeLine] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startRecording = async () => {
    setError(null);
    setProcessedBlob(null);
    setTranscript("");
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Visualizer setup
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextCtor();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        setVolumeLine(Math.min(100, (avg / 255) * 150));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // Start Speech Recognition if available and passage exists
      if (passage) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event: any) => {
            let full = "";
            for (let i = 0; i < event.results.length; ++i) {
              full += event.results[i][0].transcript;
            }
            setTranscript(full);
          };
          recognition.start();
          recognitionRef.current = recognition;
        }
      }

      // Recorder setup
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(timerRef.current!);
        cancelAnimationFrame(animationFrameRef.current!);
        
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
        
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        
        const durationSec = (Date.now() - startTimeRef.current) / 1000;
        
        if (durationSec < minDurationSec) {
          setError(`Recording too short. Please record for at least ${minDurationSec} seconds.`);
          setVolumeLine(0);
          return;
        }

        const webmBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        
        try {
          // Decode to AudioBuffer and then to our exact WAV format
          const arrayBuffer = await webmBlob.arrayBuffer();
          const offlineCtx = new AudioContextCtor({ sampleRate: 48000 });
          const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
          const wavBlob = audioBufferToWav(audioBuffer);
          
          setProcessedBlob(wavBlob);
          setVolumeLine(0);
        } catch (err) {
          setError("Failed to process audio. Please try again.");
          console.error(err);
        }
      };

      startTimeRef.current = Date.now();
      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

    } catch (err) {
      setError("Microphone access denied or unavailable.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleReset = () => {
    setProcessedBlob(null);
    setError(null);
    setRecordingTime(0);
    setTranscript("");
  };

  const handleComplete = () => {
    if (processedBlob) {
      onComplete(processedBlob, transcript);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-6 w-full max-w-2xl mx-auto font-[DM_Sans]">
      <div 
        className="w-full rounded-3xl p-8 shadow-xl relative overflow-hidden"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          border: "1px solid var(--m-border)"
        }}
      >
        <h2 className="text-xl font-[Roboto_Slab] font-bold text-center mb-2" style={{ color: "var(--m-text-heading)" }}>
          {title}
        </h2>
        <p className="text-center mb-6 text-sm leading-relaxed" style={{ color: "var(--m-text-sub)" }}>
          {description}
        </p>

        {passage && (
          <div 
            className="mb-8 p-6 rounded-2xl text-center text-lg md:text-xl font-medium leading-relaxed shadow-sm"
            style={{ 
              backgroundColor: "var(--m-surface-alt)", 
              border: "1px solid var(--m-border)",
              color: "var(--m-text-heading)"
            }}
          >
            "{passage}"
          </div>
        )}

        {error && (
          <div 
            className="flex items-center gap-3 p-4 rounded-xl mb-6 text-sm"
            style={{ 
              backgroundColor: "color-mix(in srgb, var(--m-danger) 10%, transparent)",
              color: "var(--m-danger)",
              border: "1px solid color-mix(in srgb, var(--m-danger) 20%, transparent)" 
            }}
          >
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {/* Visualizer & Timer */}
        <div className="flex flex-col items-center justify-center py-8 mb-6">
          <div className="relative w-48 h-16 flex items-center justify-center mb-4">
            {isRecording ? (
              <div 
                className="w-full h-1 rounded-full transition-all duration-100 ease-out"
                style={{ 
                  backgroundColor: "var(--m-accent)",
                  transform: `scaleY(${Math.max(1, volumeLine / 10)})` 
                }}
              />
            ) : (
              <div className="w-full h-0.5 rounded-full opacity-20" style={{ backgroundColor: "var(--m-text-sub)" }} />
            )}
          </div>
          
          <div className="text-3xl font-[Roboto_Slab] font-bold tabular-nums" style={{ color: "var(--m-text-heading)" }}>
            0:{recordingTime.toString().padStart(2, "0")}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--m-text-sub)" }}>
            Minimum: {minDurationSec} seconds
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          {!isRecording && !processedBlob && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold transition hover:scale-[1.02] shadow-md"
              style={{
                backgroundColor: "var(--m-accent)",
                color: "var(--m-accent-text)",
              }}
            >
              <Mic size={18} />
              Start Recording
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold transition hover:scale-[1.02] shadow-md"
              style={{
                backgroundColor: "var(--m-danger)",
                color: "#ffffff",
              }}
            >
              <Square size={18} />
              Stop Recording
            </button>
          )}

          {!isRecording && processedBlob && (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition hover:scale-[1.02]"
                style={{
                  backgroundColor: "var(--m-surface-alt)",
                  color: "var(--m-text)",
                  border: "1px solid var(--m-border)"
                }}
              >
                <RotateCcw size={18} />
                Re-record
              </button>
              
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold transition hover:scale-[1.02] shadow-md"
                style={{
                  backgroundColor: "var(--m-primary)",
                  color: "var(--m-primary-text)",
                }}
              >
                Continue
                <ArrowRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
