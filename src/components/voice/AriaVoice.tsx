import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ariaReply } from "@/lib/voice.functions";
import { Logo } from "@/components/brand/Logo";
import {
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  Repeat,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "muted"
  | "offline";

type Turn = { id: string; role: "user" | "assistant"; content: string };

const INTRO =
  "Hello. I am Aria, your AI assistant. How may I assist you today?";

// Minimal typings for the Web Speech API (not in TS lib by default).
type SRResultList = {
  length: number;
  [i: number]: { 0: { transcript: string }; isFinal: boolean; length: number };
};
type SREvent = { resultIndex: number; results: SRResultList };
type SRErrorEvent = { error: string; message?: string };
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onresult: ((e: SREvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognitionCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const lang = (navigator.language || "en-US").toLowerCase();
  const langPrefix = lang.split("-")[0];

  // Strong preference list — common high-quality female voices across platforms.
  const preferred = [
    "samantha", // macOS / iOS
    "ava", // macOS premium
    "allison", // macOS
    "victoria", // macOS
    "google uk english female",
    "google us english",
    "microsoft aria",
    "microsoft jenny",
    "microsoft zira",
    "microsoft michelle",
    "karen",
    "moira",
    "tessa",
    "fiona",
    "serena",
  ];

  const byName = (needle: string) =>
    voices.find((v) => v.name.toLowerCase().includes(needle));

  for (const name of preferred) {
    const v = byName(name);
    if (v) return v;
  }

  // Heuristic: any voice in the user's language that looks female by name.
  const femaleHints = ["female", "woman", "aria", "samantha", "jenny", "zira"];
  const inLang = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith(langPrefix) ||
      v.lang.toLowerCase().startsWith("en"),
  );
  for (const v of inLang) {
    if (femaleHints.some((h) => v.name.toLowerCase().includes(h))) return v;
  }
  // Fall back to first English voice, then first voice overall.
  return inLang[0] || voices[0] || null;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;
type Speed = (typeof SPEED_OPTIONS)[number];

export function AriaVoice() {
  const replyFn = useServerFn(ariaReply);

  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [continuous, setContinuous] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState<Speed>(1);
  const [supported, setSupported] = useState(true);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);

  const recognitionRef = useRef<SR | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const continuousRef = useRef(continuous);
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  const speedRef = useRef<Speed>(speed);
  const wantListenRef = useRef(false);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);
  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Load voices (async on Chrome).
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      setStatus("offline");
      return;
    }
    const load = () => {
      const v = pickFemaleVoice(window.speechSynthesis.getVoices());
      if (v) {
        voiceRef.current = v;
        setVoiceReady(true);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Init recognition.
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      setStatus("offline");
      return;
    }
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      setStatus("listening");
    };
    r.onend = () => {
      // If we still want to listen (continuous mode + not speaking/processing), restart.
      if (
        wantListenRef.current &&
        continuousRef.current &&
        !window.speechSynthesis.speaking
      ) {
        try {
          r.start();
          return;
        } catch {
          /* fallthrough */
        }
      }
      setStatus((s) => (s === "listening" ? "idle" : s));
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone permission denied");
        setStatus("offline");
      } else if (e.error === "network") {
        toast.error("Network error during speech recognition");
      } else {
        toast.error(`Voice error: ${e.error}`);
      }
    };
    r.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0].transcript;
        if (res.isFinal) finalText += txt;
        else interimText += txt;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        setInterim("");
        wantListenRef.current = false;
        try {
          r.stop();
        } catch {
          /* noop */
        }
        void handleUserUtterance(finalText.trim());
      }
    };

    recognitionRef.current = r;
    return () => {
      try {
        r.abort();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!text.trim() || !("speechSynthesis" in window)) {
          resolve();
          return;
        }
        if (mutedRef.current) {
          resolve();
          return;
        }
        const synth = window.speechSynthesis;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voiceRef.current) {
          u.voice = voiceRef.current;
          u.lang = voiceRef.current.lang;
        }
        u.rate = speedRef.current;
        u.pitch = 1.05;
        u.volume = volumeRef.current;
        u.onstart = () => setStatus("speaking");
        u.onend = () => {
          setStatus((s) => (s === "speaking" ? "idle" : s));
          resolve();
        };
        u.onerror = () => {
          setStatus((s) => (s === "speaking" ? "idle" : s));
          resolve();
        };
        synth.speak(u);
      }),
    [],
  );

  const handleUserUtterance = useCallback(
    async (text: string) => {
      setTurns((t) => [
        ...t,
        { id: crypto.randomUUID(), role: "user", content: text },
      ]);
      setStatus("processing");
      try {
        const history = turnsRef.current.map((t) => ({
          role: t.role,
          content: t.content,
        }));
        const { text: reply } = await replyFn({
          data: { transcript: text, history },
        });
        const safe = reply?.trim() || "I'm sorry, I didn't catch that.";
        setTurns((t) => [
          ...t,
          { id: crypto.randomUUID(), role: "assistant", content: safe },
        ]);
        await speak(safe);
        // Auto-resume listening in continuous mode.
        if (continuousRef.current && supported) {
          startListening();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Reply failed";
        toast.error(msg);
        setStatus("idle");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replyFn, speak, supported],
  );

  const startListening = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) {
      toast.error("Speech recognition not supported on this browser");
      return;
    }
    // Stop any current speech first (interrupt Aria).
    if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setStatus("idle");
    }
    setInterim("");
    wantListenRef.current = true;
    try {
      r.start();
    } catch {
      // Already started — ignore.
    }
  }, []);

  const stopListening = useCallback(() => {
    wantListenRef.current = false;
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch {
      /* noop */
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setStatus("idle");
  }, []);

  const handleMicPress = useCallback(async () => {
    if (status === "listening") {
      stopListening();
      return;
    }
    if (status === "speaking") {
      stopSpeaking();
      return;
    }
    try {
      // Ensure we have mic permission (best-effort).
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        stream.getTracks().forEach((t) => t.stop());
      }
      // Unlock TTS on iOS / Safari with a silent utterance on first user gesture.
      if (!hasGreeted && "speechSynthesis" in window) {
        const unlock = new SpeechSynthesisUtterance(" ");
        unlock.volume = 0;
        window.speechSynthesis.speak(unlock);
        setHasGreeted(true);
        await speak(INTRO);
        setTurns((t) => [
          ...t,
          { id: crypto.randomUUID(), role: "assistant", content: INTRO },
        ]);
      }
      startListening();
    } catch {
      toast.error("Microphone permission is required");
      setStatus("offline");
    }
  }, [status, hasGreeted, speak, startListening, stopListening, stopSpeaking]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (next && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setStatus("idle");
      }
      toast.success(next ? "Aria muted" : "Aria unmuted");
      return next;
    });
  }, []);

  const toggleContinuous = useCallback(() => {
    setContinuous((c) => {
      const next = !c;
      toast.success(next ? "Continuous mode on" : "Continuous mode off");
      if (!next) {
        wantListenRef.current = false;
        const r = recognitionRef.current;
        try {
          r?.stop();
        } catch {
          /* noop */
        }
      }
      return next;
    });
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed((s) => {
      const i = SPEED_OPTIONS.indexOf(s);
      const next = SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length];
      toast.success(`Speed ${next}x`);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    stopSpeaking();
    stopListening();
    setTurns([]);
    setInterim("");
    setHasGreeted(false);
    setStatus("idle");
  }, [stopListening, stopSpeaking]);

  const effectiveStatus: Status = muted && status !== "listening" ? "muted" : status;
  const statusLabel = useMemo(() => {
    switch (effectiveStatus) {
      case "listening":
        return "Listening…";
      case "processing":
        return "Thinking…";
      case "speaking":
        return "Speaking";
      case "muted":
        return "Muted";
      case "offline":
        return "Voice unavailable";
      default:
        return hasGreeted ? "Tap to speak" : "Tap to begin";
    }
  }, [effectiveStatus, hasGreeted]);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="px-4 pt-3 pb-2 lg:px-8 lg:pt-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glass flex h-10 w-10 items-center justify-center rounded-2xl">
              <Logo size={20} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-semibold tracking-tight">
                Aria
              </div>
              <div className="text-muted-foreground text-[11px]">
                Your AI voice assistant
              </div>
            </div>
          </div>
          <button
            onClick={reset}
            className="glass text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-[11px] font-medium transition"
          >
            New session
          </button>
        </div>
      </header>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {turns.length === 0 && (
            <div className="text-muted-foreground animate-fade-up pt-10 text-center text-sm">
              Aria is ready. Tap the microphone and speak naturally — she will
              listen, think, and reply.
            </div>
          )}
          {turns.map((t) => (
            <div
              key={t.id}
              className={cn(
                "animate-fade-up flex",
                t.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-3xl px-4 py-2.5 text-[14px] leading-relaxed",
                  t.role === "user"
                    ? "glass-bubble-user rounded-tr-lg"
                    : "glass-bubble-ai rounded-tl-lg",
                )}
              >
                {t.content}
              </div>
            </div>
          ))}
          {interim && (
            <div className="flex justify-end">
              <div className="glass-bubble-user max-w-[88%] rounded-3xl rounded-tr-lg px-4 py-2.5 text-[14px] italic opacity-60">
                {interim}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice dock */}
      <div className="px-3 pb-6 lg:px-8 lg:pb-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
          {/* Status pill */}
          <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                effectiveStatus === "listening" && "animate-pulse bg-red-500",
                effectiveStatus === "processing" &&
                  "animate-pulse bg-amber-500",
                effectiveStatus === "speaking" && "animate-pulse bg-emerald-500",
                effectiveStatus === "idle" && "bg-foreground/40",
                effectiveStatus === "muted" && "bg-foreground/30",
                effectiveStatus === "offline" && "bg-destructive",
              )}
            />
            {statusLabel}
            {!voiceReady && supported && (
              <span className="text-muted-foreground">· loading voice</span>
            )}
          </div>

          {/* Mic orb */}
          <MicOrb status={effectiveStatus} onClick={handleMicPress} />

          {/* Controls */}
          <div className="glass-dock liquid-shine flex items-center gap-1.5 rounded-full p-1.5">
            <DockBtn
              label={continuous ? "Continuous on" : "Continuous"}
              active={continuous}
              onClick={toggleContinuous}
              icon={<Repeat className="h-4 w-4" />}
            />
            <DockBtn
              label={`${speed}x`}
              onClick={cycleSpeed}
              icon={<Gauge className="h-4 w-4" />}
            />
            <DockBtn
              label={muted ? "Unmute" : "Mute"}
              active={muted}
              onClick={toggleMute}
              icon={
                muted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )
              }
            />
            <div className="hover:bg-black/5 flex items-center gap-2 rounded-full px-3 py-1.5">
              <Volume2 className="text-muted-foreground h-3.5 w-3.5" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="accent-foreground h-1 w-20 cursor-pointer"
                aria-label="Volume"
              />
            </div>
            {status === "speaking" && (
              <button
                onClick={stopSpeaking}
                className="bg-foreground text-background ml-1 flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium"
              >
                <Square className="h-3 w-3" fill="currentColor" />
                Stop
              </button>
            )}
          </div>

          <p className="text-muted-foreground/70 max-w-md text-center text-[10.5px] leading-snug">
            Aria uses your device's microphone and speech engine. Speech
            recognition requires Chrome, Edge, or Safari.
          </p>
        </div>
      </div>
    </div>
  );
}

function DockBtn({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium transition",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-black/5 hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MicOrb({
  status,
  onClick,
}: {
  status: Status;
  onClick: () => void;
}) {
  const disabled = status === "offline";
  const isListening = status === "listening";
  const isSpeaking = status === "speaking";
  const isProcessing = status === "processing";

  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      {/* Halo rings */}
      <span
        className={cn(
          "absolute inset-0 rounded-full transition",
          isListening &&
            "animate-ping-slow border border-red-400/40 bg-red-400/5",
          isSpeaking &&
            "animate-ping-slow border border-emerald-400/40 bg-emerald-400/5",
          isProcessing && "border border-amber-400/40 bg-amber-400/5",
          status === "idle" && "border border-black/5",
          status === "muted" && "border border-black/5 opacity-60",
        )}
      />
      <span
        className={cn(
          "absolute inset-3 rounded-full transition",
          isListening && "animate-pulse bg-red-400/10",
          isSpeaking && "animate-pulse bg-emerald-400/10",
          isProcessing && "animate-pulse bg-amber-400/10",
        )}
      />
      {/* Spectrum bars when speaking */}
      {isSpeaking && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="bg-foreground/70 w-1 rounded-full"
              style={{
                height: `${20 + (i % 3) * 14}px`,
                animation: `voiceBar 900ms ease-in-out ${i * 80}ms infinite`,
              }}
            />
          ))}
        </div>
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={isListening ? "Stop listening" : "Start voice"}
        className={cn(
          "glass-strong relative flex h-28 w-28 items-center justify-center rounded-full text-foreground shadow-xl transition active:scale-95",
          "hover:-translate-y-0.5",
          disabled && "cursor-not-allowed opacity-50",
          isListening && "ring-2 ring-red-400/60",
          isSpeaking && "ring-2 ring-emerald-400/60",
          isProcessing && "ring-2 ring-amber-400/60",
        )}
      >
        {disabled ? (
          <MicOff className="h-9 w-9" />
        ) : isListening ? (
          <Square className="h-7 w-7" fill="currentColor" />
        ) : (
          <Mic className="h-9 w-9" />
        )}
      </button>
      <style>{`
        @keyframes voiceBar {
          0%, 100% { transform: scaleY(0.45); opacity: 0.6; }
          50% { transform: scaleY(1.15); opacity: 1; }
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.8; }
          80%, 100% { transform: scale(1.25); opacity: 0; }
        }
        .animate-ping-slow { animation: ping-slow 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; }
      `}</style>
    </div>
  );
}
