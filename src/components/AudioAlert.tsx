import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";

type EmergencyType = "fire" | "earthquake" | "flood";

interface AudioAlertProps {
  emergencyType: EmergencyType;
  onDismiss: () => void;
}

const emergencyLabels: Record<EmergencyType, string> = {
  fire: "Fire",
  earthquake: "Earthquake",
  flood: "Flood",
};

const AudioAlert = ({ emergencyType, onDismiss }: AudioAlertProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sirenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cycleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<"siren" | "voice" | "pause">("siren");

  const getAudioContext = () => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const startSiren = () => {
    try {
      if (!isActiveRef.current) return;
      
      const ctx = getAudioContext();
      
      // Create new oscillator (oscillators can only be started once)
      oscillatorRef.current = ctx.createOscillator();
      gainNodeRef.current = ctx.createGain();

      oscillatorRef.current.type = "sawtooth";
      oscillatorRef.current.frequency.setValueAtTime(800, ctx.currentTime);
      gainNodeRef.current.gain.setValueAtTime(0.7, ctx.currentTime);

      oscillatorRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);
      oscillatorRef.current.start();

      // Alternate between frequencies every 0.3 seconds
      let highFreq = true;
      sirenIntervalRef.current = setInterval(() => {
        if (oscillatorRef.current && audioContextRef.current && audioContextRef.current.state === "running") {
          const freq = highFreq ? 600 : 800;
          oscillatorRef.current.frequency.setValueAtTime(freq, audioContextRef.current.currentTime);
          highFreq = !highFreq;
        }
      }, 300);
      
      console.log("Siren started");
    } catch (error) {
      console.error("Failed to start siren:", error);
    }
  };

  const stopSiren = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch (e) {}
      oscillatorRef.current = null;
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch (e) {}
      gainNodeRef.current = null;
    }
    console.log("Siren stopped");
    // Don't close AudioContext - keep it alive for next cycle
  };

  const speakAnnouncement = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window) || !isActiveRef.current) {
        console.log("Speech synthesis not available or inactive");
        setTimeout(resolve, 100);
        return;
      }

      window.speechSynthesis.cancel();

      const message = `Emergency. ${emergencyLabels[emergencyType]} detected. Evacuate immediately.`;
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.volume = 1.0;
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang === "en-US") || voices.find(v => v.lang.startsWith("en"));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      utterance.onend = safeResolve;
      utterance.onerror = (e) => {
        console.error("Speech error:", e);
        safeResolve();
      };

      setTimeout(safeResolve, 5000);

      console.log("Speaking:", message);
      window.speechSynthesis.speak(utterance);
    });
  };

  const runCycle = async () => {
    while (isActiveRef.current) {
      // Siren phase (3 seconds)
      setCurrentPhase("siren");
      startSiren();
      
      await new Promise<void>((resolve) => {
        cycleTimeoutRef.current = setTimeout(resolve, 3000);
      });

      if (!isActiveRef.current) break;
      stopSiren();

      if (!isActiveRef.current) break;

      // Voice phase
      setCurrentPhase("voice");
      await speakAnnouncement();

      if (!isActiveRef.current) break;

      // Pause phase (0.5 seconds)
      setCurrentPhase("pause");
      await new Promise<void>((resolve) => {
        cycleTimeoutRef.current = setTimeout(resolve, 500);
      });
    }
  };

  const stopAllAudio = () => {
    isActiveRef.current = false;
    
    if (cycleTimeoutRef.current) {
      clearTimeout(cycleTimeoutRef.current);
      cycleTimeoutRef.current = null;
    }

    stopSiren();
    
    // Now close the AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsPlaying(false);
  };

  const handleDismiss = () => {
    stopAllAudio();
    onDismiss();
  };

  useEffect(() => {
    isActiveRef.current = true;
    
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    
    setTimeout(() => {
      if (isActiveRef.current) {
        runCycle();
      }
    }, 100);

    return () => {
      stopAllAudio();
    };
  }, [emergencyType]);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-pulse">
      <div className="bg-destructive text-destructive-foreground rounded-lg shadow-lg p-4 flex items-center gap-3">
        <Volume2 className="w-6 h-6 animate-bounce" />
        <div className="flex flex-col">
          <span className="font-semibold text-sm">
            {isPlaying ? `Audio: ${currentPhase === "siren" ? "🔊 Siren" : currentPhase === "voice" ? "🗣️ Speaking" : "⏸️ Pause"}` : "Audio Stopped"}
          </span>
          <span className="text-xs opacity-80">
            {emergencyLabels[emergencyType]} Emergency
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDismiss}
          className="ml-2"
        >
          Stop Audio
        </Button>
      </div>
    </div>
  );
};

export default AudioAlert;

export const unlockAudioForEmergency = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  ctx.resume();
  
  if ("speechSynthesis" in window) {
    const unlock = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(unlock);
  }
};
