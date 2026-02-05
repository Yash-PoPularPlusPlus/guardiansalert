import { useEffect, useCallback, useState } from "react";
import { Mic, MicOff, AlertCircle, Flame, Shield } from "lucide-react";
import { useFireAlarmDetection } from "@/hooks/useFireAlarmDetection";
import { useSmsNotification } from "@/hooks/useSmsNotification";
import { unlockAudioForEmergency } from "@/components/AudioAlert";
import { toast } from "@/hooks/use-toast";

interface AudioMonitorProps {
  enabled: boolean;
  onAlertTriggered: (type: "fire") => void;
}

const AudioMonitor = ({ enabled, onAlertTriggered }: AudioMonitorProps) => {
  const { notifyEmergencyContacts } = useSmsNotification();
  const [showDetectionAlert, setShowDetectionAlert] = useState(false);

  const handleFireAlarmDetected = useCallback(async () => {
    // Show detection state for 2 seconds before triggering full alert
    setShowDetectionAlert(true);
    
    setTimeout(async () => {
      setShowDetectionAlert(false);
      
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
    }, 2000);
  }, [onAlertTriggered, notifyEmergencyContacts]);

  const { isListening, error, permissionDenied, detectionStatus, detectionProgress } = useFireAlarmDetection({
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

  // Determine display state
  const isDetecting = detectionStatus === "detecting" || showDetectionAlert;
  const isConfirmed = detectionStatus === "confirmed" || showDetectionAlert;

  return (
    <div className="fixed top-4 right-4 z-40">
      <div 
        className={`
          flex flex-col gap-1 px-3 py-2 rounded-xl text-xs
          backdrop-blur-md shadow-lg transition-all duration-300
          ${isConfirmed 
            ? "bg-red-600/90 text-white" 
            : isDetecting
              ? "bg-amber-500/90 text-white"
              : error 
                ? "bg-destructive/80 text-destructive-foreground"
                : "bg-black/70 text-white"
          }
        `}
      >
        {/* Main status row */}
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <>
              <Flame className="w-5 h-5 animate-pulse" />
              <span className="font-semibold">Fire alarm detected!</span>
            </>
          ) : isDetecting ? (
            <>
              <Flame className="w-5 h-5 animate-pulse" />
              <span className="font-medium">Analyzing sound...</span>
            </>
          ) : isListening ? (
            <>
              <div className="relative">
                <Mic className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
              <span className="font-medium">Listening...</span>
            </>
          ) : error ? (
            <>
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Mic unavailable</span>
            </>
          ) : (
            <>
              <MicOff className="w-5 h-5" />
              <span className="font-medium">Paused</span>
            </>
          )}
        </div>

        {/* Secondary info row */}
        {isListening && !isDetecting && !isConfirmed && (
          <div className="flex items-center gap-1.5 text-white/70">
            <Shield className="w-3 h-3" />
            <span>Monitoring for fire alarms</span>
          </div>
        )}

        {/* Detection progress */}
        {isDetecting && !isConfirmed && (
          <div className="w-full bg-white/20 rounded-full h-1 mt-1">
            <div 
              className="bg-white h-1 rounded-full transition-all duration-200"
              style={{ width: `${detectionProgress}%` }}
            />
          </div>
        )}

        {/* Active status */}
        {isListening && !error && !isDetecting && (
          <div className="flex items-center gap-1.5 text-white/50 text-[10px]">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span>Active now</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioMonitor;
