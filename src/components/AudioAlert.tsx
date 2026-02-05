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
  const voiceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const speakAnnouncement = () => {
    if (!("speechSynthesis" in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const message = `Emergency. ${emergencyLabels[emergencyType]} detected. Evacuate immediately. This is not a drill.`;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.volume = 1.0;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";

    window.speechSynthesis.speak(utterance);
  };

  const startSiren = () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      oscillatorRef.current = audioContextRef.current.createOscillator();
      gainNodeRef.current = audioContextRef.current.createGain();

      oscillatorRef.current.type = "sawtooth";
      oscillatorRef.current.frequency.setValueAtTime(800, audioContextRef.current.currentTime);
      gainNodeRef.current.gain.setValueAtTime(1.0, audioContextRef.current.currentTime);

      oscillatorRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
      oscillatorRef.current.start();

      // Alternate between frequencies for siren effect
      let highFreq = true;
      sirenIntervalRef.current = setInterval(() => {
        if (oscillatorRef.current && audioContextRef.current) {
          const freq = highFreq ? 600 : 800;
          oscillatorRef.current.frequency.setValueAtTime(freq, audioContextRef.current.currentTime);
          highFreq = !highFreq;
        }
      }, 500);
    } catch (error) {
      console.error("Failed to start siren:", error);
    }
  };

  const stopAllAudio = () => {
    // Stop siren
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

    // Stop voice
    if (voiceIntervalRef.current) {
      clearInterval(voiceIntervalRef.current);
      voiceIntervalRef.current = null;
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
    // Start siren
    startSiren();

    // Initial voice announcement
    speakAnnouncement();

    // Repeat voice announcement every 10 seconds
    voiceIntervalRef.current = setInterval(() => {
      speakAnnouncement();
    }, 10000);

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
