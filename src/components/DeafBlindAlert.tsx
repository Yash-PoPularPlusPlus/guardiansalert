import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type EmergencyType = "fire" | "earthquake" | "flood";

interface DeafBlindAlertProps {
  emergencyType: EmergencyType;
  onDismiss: () => void;
}

const emergencyConfig = {
  fire: {
    title: "FIRE EMERGENCY",
    action: "Evacuate immediately",
  },
  earthquake: {
    title: "EARTHQUAKE",
    action: "Drop, Cover, Hold",
  },
  flood: {
    title: "FLOOD WARNING",
    action: "Move to higher ground",
  },
};

const MAXIMUM_VIBRATION = [1000, 100, 1000, 100, 1000, 100, 1000];

const DeafBlindAlert = ({ emergencyType, onDismiss }: DeafBlindAlertProps) => {
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (navigator.vibrate) {
      navigator.vibrate(MAXIMUM_VIBRATION);
    }

    vibrationIntervalRef.current = setInterval(() => {
      if (navigator.vibrate) {
        navigator.vibrate(MAXIMUM_VIBRATION);
      }
    }, 1500);

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
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
      style={{ minHeight: "100dvh" }}
    >
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="px-6 py-4 bg-yellow-400 rounded-lg">
          <h1 className="font-black text-black text-3xl">
            {config.title}
          </h1>
        </div>
        
        <p className="text-white text-xl font-semibold">
          {config.action}
        </p>
        
        <div className="px-4 py-2 bg-red-600 rounded-full animate-pulse">
          <span className="text-white font-bold text-lg">
            📳 VIBRATING
          </span>
        </div>
        
        <p className="text-gray-400 text-sm max-w-xs">
          For caregiver: The device is vibrating continuously to alert the user.
        </p>

        <Button
          onClick={handleDismiss}
          className="mt-4 bg-white text-black hover:bg-gray-100 font-bold text-xl rounded-xl min-h-[64px]"
          style={{ 
            padding: "20px 64px",
            boxShadow: "0 4px 20px rgba(255, 255, 255, 0.2)",
          }}
        >
          DISMISS
        </Button>
      </div>
    </div>
  );
};

export default DeafBlindAlert;
