import { useEffect, useState, forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import { Mic, MicOff, AlertCircle, Flame, Shield, Clock, RotateCcw, Cpu } from "lucide-react";
import { useFireAlarmDetection, type AudioEngineStatus } from "@/hooks/useFireAlarmDetection";
import { unlockAudioForEmergency } from "@/components/AudioAlert";
import { toast } from "@/hooks/use-toast";

interface AudioMonitorProps {
  enabled: boolean;
  onAlertTriggered: (type: "fire") => void;
}

export interface AudioMonitorHandle {
  resetCooldown: () => void;
  getAudioEngineStatus: () => AudioEngineStatus;
}

const AudioMonitor = forwardRef<AudioMonitorHandle, AudioMonitorProps>(({ enabled, onAlertTriggered }, ref) => {
  const [showDetectionAlert, setShowDetectionAlert] = useState(false);
  
  // Store callback in ref - update SYNCHRONOUSLY during render
  const onAlertTriggeredRef = useRef(onAlertTriggered);
  onAlertTriggeredRef.current = onAlertTriggered;

  // INSTANT callback - no delays, no toasts, just trigger immediately
  const handleFireAlarmDetected = useCallback(() => {
    unlockAudioForEmergency();
    onAlertTriggeredRef.current("fire");
    setShowDetectionAlert(true);
    setTimeout(() => setShowDetectionAlert(false), 2000);
  }, []);

  const { 
    isListening, 
    error, 
    permissionDenied, 
    detectionStatus, 
    detectionProgress,
    cooldownRemaining,
    audioEngineStatus,
    resetCooldown
  } = useFireAlarmDetection({
    onFireAlarmDetected: handleFireAlarmDetected,
    enabled,
  });

  // Expose resetCooldown and audioEngineStatus to parent via ref
  useImperativeHandle(ref, () => ({
    resetCooldown,
    getAudioEngineStatus: () => audioEngineStatus,
  }), [resetCooldown, audioEngineStatus]);

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

  // Engine status indicator color
  const getEngineStatusColor = () => {
    switch (audioEngineStatus) {
      case "running": return "text-green-400";
      case "suspended": return "text-yellow-400";
      default: return "text-red-400";
    }
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

        {/* Audio Engine Status - Debug info */}
        {isListening && !error && (
          <div className="flex items-center justify-between gap-2 text-[10px] pt-1 border-t border-white/10 mt-1">
            <div className="flex items-center gap-1 text-white/50">
              <Cpu className="w-3 h-3" />
              <span>Audio Engine:</span>
            </div>
            <span className={`font-medium capitalize ${getEngineStatusColor()}`}>
              {audioEngineStatus}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

AudioMonitor.displayName = "AudioMonitor";

export default AudioMonitor;
