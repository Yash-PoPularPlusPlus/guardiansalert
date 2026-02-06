import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type EmergencyType = "fire" | "earthquake" | "flood";

interface VisualAlertProps {
  emergencyType: EmergencyType;
  onDismiss: () => void;
  extraMessage?: string;
}

const emergencyConfig = {
  fire: {
    icon: "🔥",
    title: "FIRE ALERT",
    action: "EVACUATE NOW",
  },
  earthquake: {
    icon: "🌍",
    title: "EARTHQUAKE",
    action: "DROP, COVER, HOLD",
  },
  flood: {
    icon: "🌊",
    title: "FLOOD ALERT",
    action: "MOVE TO HIGH GROUND",
  },
};

const VisualAlert = ({ emergencyType, onDismiss, extraMessage }: VisualAlertProps) => {
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const vibrationPattern = [500, 200, 500, 200, 500];
    
    if (navigator.vibrate) {
      navigator.vibrate(vibrationPattern);
    }

    vibrationIntervalRef.current = setInterval(() => {
      if (navigator.vibrate) {
        navigator.vibrate(vibrationPattern);
      }
    }, 2000);

    return () => {
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
      }
      if (navigator.vibrate) {
        navigator.vibrate(0);
      }
    };
  }, []);

  const handleDismiss = () => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
    }
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
    onDismiss();
  };

  const config = emergencyConfig[emergencyType];

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center animate-emergency-flash"
      style={{ minHeight: "100dvh" }}
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6 flex-1">
        <span 
          className="leading-none"
          style={{ fontSize: "clamp(60px, 15vw, 80px)" }}
        >
          {config.icon}
        </span>
        
        <h1 
          className="font-bold text-white leading-tight"
          style={{ 
            fontSize: "clamp(32px, 10vw, 48px)",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          {config.title}
        </h1>
        
        <p 
          className="text-white font-semibold"
          style={{ 
            fontSize: "clamp(18px, 5vw, 24px)",
            textShadow: "1px 1px 3px rgba(0, 0, 0, 0.8)",
          }}
        >
          {config.action}
        </p>
        
        {extraMessage && (
          <p 
            className="text-white/90 font-medium mt-4"
            style={{ 
              fontSize: "clamp(16px, 4vw, 20px)",
              textShadow: "1px 1px 3px rgba(0, 0, 0, 0.8)",
            }}
          >
            {extraMessage}
          </p>
        )}
      </div>

      {/* Safe area padding for bottom button */}
      <div className="w-full px-6 pb-safe mb-8 flex justify-center">
        <Button
          onClick={handleDismiss}
          className="w-full max-w-sm mx-auto bg-white text-gray-900 hover:bg-gray-100 font-bold text-lg rounded-xl min-h-[56px]"
          style={{ 
            padding: "16px 48px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          }}
        >
          I'm Safe
        </Button>
      </div>
    </div>
  );
};

export default VisualAlert;
