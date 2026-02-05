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

      // Alternate between frequencies every 0.3 seconds
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
      } catch (e) {
        // Oscillator may already be stopped
      }
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
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const message = `Emergency. ${emergencyLabels[emergencyType]} detected. Evacuate immediately.`;
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.volume = 1.0;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  };

  const runCycle = async () => {
    if (!isActiveRef.current) return;

    // Step 1: Play siren for 3 seconds
    startSiren();
    
    await new Promise<void>((resolve) => {
      cycleTimeoutRef.current = setTimeout(resolve, 3000);
    });

    if (!isActiveRef.current) return;

    // Step 2: Stop siren
    stopSiren();

    if (!isActiveRef.current) return;

    // Step 3: Play voice announcement
    await speakAnnouncement();

    if (!isActiveRef.current) return;

    // Step 4: Pause for 1 second
    await new Promise<void>((resolve) => {
      cycleTimeoutRef.current = setTimeout(resolve, 1000);
    });

    if (!isActiveRef.current) return;

    // Step 5: Repeat
    runCycle();
  };

  const stopAllAudio = () => {
    isActiveRef.current = false;
    
    // Clear cycle timeout
    if (cycleTimeoutRef.current) {
      clearTimeout(cycleTimeoutRef.current);
      cycleTimeoutRef.current = null;
    }

    // Stop siren
    stopSiren();

    // Stop voice
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
    runCycle();

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
            {isPlaying ? "Audio Alert Playing..." : "Audio Stopped"}
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
