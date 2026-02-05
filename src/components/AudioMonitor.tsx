import { useEffect, useCallback } from "react";
import { Mic, MicOff, AlertCircle } from "lucide-react";
import { useFireAlarmDetection } from "@/hooks/useFireAlarmDetection";
import { usePersonalizedAlert, getDisabilities } from "@/hooks/usePersonalizedAlert";
import { useSmsNotification } from "@/hooks/useSmsNotification";
import { unlockAudioForEmergency } from "@/components/AudioAlert";
import { toast } from "@/hooks/use-toast";

interface AudioMonitorProps {
  enabled: boolean;
  onAlertTriggered: (type: "fire") => void;
}

const AudioMonitor = ({ enabled, onAlertTriggered }: AudioMonitorProps) => {
  const { notifyEmergencyContacts } = useSmsNotification();

  const handleFireAlarmDetected = useCallback(async () => {
    // Show detection toast
    toast({
      title: "🔊 Fire alarm detected!",
      description: "Activating emergency alert...",
    });

    // Unlock audio for browsers
    unlockAudioForEmergency();

    // Trigger the personalized alert through parent
    onAlertTriggered("fire");

    // Send SMS to emergency contacts
    await notifyEmergencyContacts("fire");
  }, [onAlertTriggered, notifyEmergencyContacts]);

  const { isListening, error, permissionDenied } = useFireAlarmDetection({
    onFireAlarmDetected: handleFireAlarmDetected,
    enabled,
  });

  // Show error toast if permission denied
  useEffect(() => {
    if (permissionDenied && error) {
      toast({
        title: "Microphone Access Required",
        description: error,
        variant: "destructive",
      });
    } else if (error && !permissionDenied) {
      toast({
        title: "Audio Monitor Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, permissionDenied]);

  // Subtle indicator in corner
  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div 
        className={`
          flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium
          transition-all duration-300 shadow-sm
          ${isListening 
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
            : error 
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-muted text-muted-foreground"
          }
        `}
      >
        {isListening ? (
          <>
            <Mic className="w-3.5 h-3.5 animate-pulse" />
            <span>Listening...</span>
          </>
        ) : error ? (
          <>
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Mic off</span>
          </>
        ) : (
          <>
            <MicOff className="w-3.5 h-3.5" />
            <span>Paused</span>
          </>
        )}
      </div>
    </div>
  );
};

export default AudioMonitor;
