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

// Maximum vibration for deaf+blind users
const MAXIMUM_VIBRATION = [1000, 100, 1000, 100, 1000, 100, 1000];

const DeafBlindAlert = ({ emergencyType, onDismiss }: DeafBlindAlertProps) => {
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start maximum vibration immediately
    if (navigator.vibrate) {
      navigator.vibrate(MAXIMUM_VIBRATION);
    }

    // Repeat vibration pattern every 1.5 seconds
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

  // Simple text alert for caregiver nearby - high contrast, minimal design
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        {/* High contrast text for caregiver */}
        <div className="px-6 py-4 bg-yellow-400 rounded-lg">
          <h1 className="font-black text-black text-3xl">
            {config.title}
          </h1>
        </div>
        
        <p className="text-white text-xl font-semibold">
          {config.action}
        </p>
        
        <div className="mt-4 px-4 py-2 bg-red-600 rounded-full animate-pulse">
          <span className="text-white font-bold text-lg">
            📳 VIBRATING
          </span>
        </div>
        
        <p className="text-gray-400 text-sm max-w-xs mt-4">
          For caregiver: The device is vibrating continuously to alert the user.
        </p>
      </div>

      <Button
        onClick={handleDismiss}
        className="mt-12 bg-white text-black hover:bg-gray-100 font-bold text-xl rounded-xl"
        style={{ padding: "20px 48px" }}
      >
        DISMISS
      </Button>
    </div>
  );
};

export default DeafBlindAlert;
