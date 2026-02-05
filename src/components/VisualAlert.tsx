import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type EmergencyType = "fire" | "earthquake" | "flood";

interface VisualAlertProps {
  emergencyType: EmergencyType;
  onDismiss: () => void;
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

const VisualAlert = ({ emergencyType, onDismiss }: VisualAlertProps) => {
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initial vibration
    const vibrationPattern = [500, 200, 500, 200, 500];
    
    if (navigator.vibrate) {
      navigator.vibrate(vibrationPattern);
    }

    // Repeat vibration every 2 seconds
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
        navigator.vibrate(0); // Stop vibration on unmount
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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center animate-emergency-flash">
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6">
        <span 
          className="leading-none"
          style={{ fontSize: "80px" }}
        >
          {config.icon}
        </span>
        
        <h1 
          className="font-bold text-white leading-tight"
          style={{ 
            fontSize: "48px",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          {config.title}
        </h1>
        
        <p 
          className="text-white font-semibold"
          style={{ 
            fontSize: "24px",
            textShadow: "1px 1px 3px rgba(0, 0, 0, 0.8)",
          }}
        >
          {config.action}
        </p>
      </div>

      <Button
        onClick={handleDismiss}
        className="mt-12 bg-white text-gray-900 hover:bg-gray-100 font-bold text-lg rounded-xl"
        style={{ padding: "16px 48px" }}
      >
        I'm Safe
      </Button>
    </div>
  );
};

export default VisualAlert;
