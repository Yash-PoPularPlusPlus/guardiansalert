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
  const speechUnlockedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<"siren" | "voice" | "pause">("siren");

  // Unlock speech synthesis - must happen synchronously in user gesture
  const unlockSpeechSynthesis = () => {
    if (!("speechSynthesis" in window) || speechUnlockedRef.current) return;
    
    // Speak empty string to unlock
    const unlock = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(unlock);
    speechUnlockedRef.current = true;
  };

  const startSiren = () => {
    try {
      if (!isActiveRef.current) return;
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      oscillatorRef.current = audioContextRef.current.createOscillator();
      gainNodeRef.current = audioContextRef.current.createGain();

      oscillatorRef.current.type = "sawtooth";
      oscillatorRef.current.frequency.setValueAtTime(800, audioContextRef.current.currentTime);
      gainNodeRef.current.gain.setValueAtTime(0.7, audioContextRef.current.currentTime);

      oscillatorRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
      oscillatorRef.current.start();

      let highFreq = true;
      sirenIntervalRef.current = setInterval(() => {
        if (oscillatorRef.current && audioContextRef.current) {
          const freq = highFreq ? 600 : 800;
          oscillatorRef.current.frequency.setValueAtTime(freq, audioContextRef.current.currentTime);
          highFreq = !highFreq;
        }
      }, 300);
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
      } catch (e) {}
      oscillatorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const speakAnnouncement = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window) || !isActiveRef.current) {
        console.log("Speech synthesis not available or inactive");
        setTimeout(resolve, 100);
        return;
      }

      // Cancel any pending speech
      window.speechSynthesis.cancel();

      const message = `Emergency. ${emergencyLabels[emergencyType]} detected. Evacuate immediately.`;
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.volume = 1.0;
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";

      // Get available voices and prefer English
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

      // Fallback timeout in case events don't fire
      setTimeout(safeResolve, 5000);

      console.log("Speaking:", message);
      window.speechSynthesis.speak(utterance);
    });
  };

  const runCycle = async () => {
    if (!isActiveRef.current) return;

    // Siren phase
    setCurrentPhase("siren");
    startSiren();
    
    await new Promise<void>((resolve) => {
      cycleTimeoutRef.current = setTimeout(resolve, 3000);
    });

    if (!isActiveRef.current) return;
    stopSiren();

    if (!isActiveRef.current) return;

    // Voice phase
    setCurrentPhase("voice");
    await speakAnnouncement();

    if (!isActiveRef.current) return;

    // Pause phase
    setCurrentPhase("pause");
    await new Promise<void>((resolve) => {
      cycleTimeoutRef.current = setTimeout(resolve, 1000);
    });

    if (!isActiveRef.current) return;
    runCycle();
  };

  const stopAllAudio = () => {
    isActiveRef.current = false;
    
    if (cycleTimeoutRef.current) {
      clearTimeout(cycleTimeoutRef.current);
      cycleTimeoutRef.current = null;
    }

    stopSiren();

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
    
    // Load voices
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    
    // Small delay then start cycle
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

// Export unlock function to be called from button click
export const unlockAudioForEmergency = () => {
  // Unlock AudioContext
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  ctx.resume();
  
  // Unlock Speech Synthesis
  if ("speechSynthesis" in window) {
    const unlock = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(unlock);
  }
};
