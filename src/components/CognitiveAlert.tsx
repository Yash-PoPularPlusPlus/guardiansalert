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
    utterance.rate = 0.7; // Calm, slow voice
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

    // Ensure voices are loaded
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }

    // Initial announcement after a brief pause
    const initialTimeout = setTimeout(() => {
      if (isActiveRef.current) {
        speakSlowly();
      }
    }, 500);

    // Repeat every 8 seconds (slower for cognitive)
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
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center ${config.bgColor}`}>
      <div className="flex flex-col items-center justify-center gap-8 text-center px-8">
        {/* Single large icon */}
        <span 
          className="leading-none animate-bounce"
          style={{ fontSize: "120px" }}
        >
          {config.icon}
        </span>
        
        {/* Very simple text */}
        <h1 
          className="font-bold text-white leading-relaxed"
          style={{ 
            fontSize: "36px",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
            maxWidth: "300px",
          }}
        >
          {config.simpleText}
        </h1>
      </div>

      <Button
        onClick={handleDismiss}
        className="mt-16 bg-white text-gray-900 hover:bg-gray-100 font-bold text-xl rounded-2xl"
        style={{ padding: "24px 64px" }}
      >
        I'M SAFE
      </Button>
    </div>
  );
};

export default CognitiveAlert;
