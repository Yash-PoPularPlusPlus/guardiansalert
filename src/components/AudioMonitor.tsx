import { useEffect, useCallback, useState } from "react";
import { Mic, MicOff, AlertCircle, Flame, Shield, Clock, RotateCcw } from "lucide-react";
import { useFireAlarmDetection } from "@/hooks/useFireAlarmDetection";
import { unlockAudioForEmergency } from "@/components/AudioAlert";
import { toast } from "@/hooks/use-toast";

interface AudioMonitorProps {
  enabled: boolean;
  onAlertTriggered: (type: "fire") => void;
}

const AudioMonitor = ({ enabled, onAlertTriggered }: AudioMonitorProps) => {
  const [showDetectionAlert, setShowDetectionAlert] = useState(false);

  const handleFireAlarmDetected = useCallback(() => {
    console.log("[AudioMonitor] Fire alarm detected! Triggering alert...");
    
    // Show confirmed state briefly
    setShowDetectionAlert(true);
    
    // Show detection toast
    toast({
      title: "🔊 Fire alarm detected!",
      description: "Activating emergency alert...",
    });

    // Unlock audio for browsers
    unlockAudioForEmergency();

    // CRITICAL: Call the parent callback synchronously
    // This triggers the full-screen alert and SMS notifications
    console.log("[AudioMonitor] Calling onAlertTriggered...");
    onAlertTriggered("fire");
    console.log("[AudioMonitor] onAlertTriggered called");
    
    // Reset detection alert state after a short delay
    setTimeout(() => {
      setShowDetectionAlert(false);
    }, 2000);
  }, [onAlertTriggered]);

  const { 
    isListening, 
    error, 
    permissionDenied, 
    detectionStatus, 
    detectionProgress,
    cooldownRemaining,
    resetCooldown
  } = useFireAlarmDetection({
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
  const isCooldown = detectionStatus === "cooldown";

  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetCooldown();
    toast({
      title: "Monitoring resumed",
      description: "Fire alarm detection is now active again.",
    });
  };

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
              : isCooldown
                ? "bg-blue-600/90 text-white"
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
          ) : isCooldown ? (
            <>
              <Clock className="w-5 h-5" />
              <span className="font-medium">Cooldown: {cooldownRemaining}s</span>
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
        {isListening && !isDetecting && !isConfirmed && !isCooldown && (
          <div className="flex items-center gap-1.5 text-white/70">
            <Shield className="w-3 h-3" />
            <span>Monitoring for fire alarms</span>
          </div>
        )}

        {/* Cooldown info with reset button */}
        {isCooldown && (
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-white/70 text-[10px]">Alert triggered recently</span>
            <button
              onClick={handleResetClick}
              className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors text-[10px] font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              Resume
            </button>
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
        {isListening && !error && !isDetecting && !isCooldown && (
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
