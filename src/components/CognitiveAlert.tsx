import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type EmergencyType = "fire" | "earthquake" | "flood";

interface CognitiveAlertProps {
  emergencyType: EmergencyType;
  onDismiss: () => void;
}

const emergencyConfig = {
  fire: {
    icon: "🔥",
    simpleText: "DANGER. FIRE. GO OUTSIDE.",
    bgColor: "bg-red-600",
  },
  earthquake: {
    icon: "🌍",
    simpleText: "DANGER. EARTHQUAKE. GET DOWN.",
    bgColor: "bg-orange-600",
  },
  flood: {
    icon: "🌊",
    simpleText: "DANGER. FLOOD. GO UP HIGH.",
    bgColor: "bg-blue-600",
  },
};

const CognitiveAlert = ({ emergencyType, onDismiss }: CognitiveAlertProps) => {
  const isActiveRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const speakSlowly = () => {
    if (!("speechSynthesis" in window) || !isActiveRef.current) return;

    window.speechSynthesis.cancel();

    const config = emergencyConfig[emergencyType];
    const utterance = new SpeechSynthesisUtterance(config.simpleText);
    utterance.volume = 1.0;
    utterance.rate = 0.7;
    utterance.pitch = 0.9;
    utterance.lang = "en-US";

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang === "en-US") || voices.find(v => v.lang.startsWith("en"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    isActiveRef.current = true;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }

    const initialTimeout = setTimeout(() => {
      if (isActiveRef.current) {
        speakSlowly();
      }
    }, 500);

    intervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        speakSlowly();
      }
    }, 8000);

    return () => {
      isActiveRef.current = false;
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [emergencyType]);

  const handleDismiss = () => {
    isActiveRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    onDismiss();
  };

  const config = emergencyConfig[emergencyType];

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center ${config.bgColor}`}
      style={{ minHeight: "100dvh" }}
    >
      <div className="flex flex-col items-center justify-center gap-8 text-center px-8">
        <span 
          className="leading-none animate-bounce"
          style={{ fontSize: "clamp(80px, 20vw, 120px)" }}
        >
          {config.icon}
        </span>
        
        <h1 
          className="font-bold text-white leading-relaxed"
          style={{ 
            fontSize: "clamp(28px, 8vw, 36px)",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
            maxWidth: "300px",
          }}
        >
          {config.simpleText}
        </h1>

        <Button
          onClick={handleDismiss}
          className="mt-4 bg-white text-gray-900 hover:bg-gray-100 font-bold text-xl rounded-2xl min-h-[64px]"
          style={{ 
            padding: "24px 64px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          }}
        >
          I'M SAFE
        </Button>
      </div>
    </div>
  );
};

export default CognitiveAlert;
