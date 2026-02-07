import { useEffect, useState, forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import { Mic, MicOff, AlertCircle, Flame, Shield, Brain, Loader2 } from "lucide-react";
import { useAIAlarmDetection, AIClassificationResult, AIDetectionStatus } from "@/hooks/useAIAlarmDetection";
import { toast } from "@/hooks/use-toast";

interface AudioMonitorProps {
  enabled: boolean;
  onAlertTriggered: (type: "fire") => void;
  onAIClassification?: (result: AIClassificationResult, status: AIDetectionStatus) => void;
  onFireAlarmConfirmed?: () => void;
}

export interface AudioMonitorHandle {
  resetCooldown: () => void;
}

// Fire alarm related categories from YAMNet
const FIRE_ALARM_CATEGORIES = [
  "Fire alarm",
  "Smoke detector",
  "Alarm",
  "Siren",
  "Civil defense siren",
  "Buzzer"
];

const CONFIDENCE_THRESHOLD = 0.7;
const REQUIRED_CONSECUTIVE_DETECTIONS = 4;

const AudioMonitor = forwardRef<AudioMonitorHandle, AudioMonitorProps>(({ 
  enabled, 
  onAlertTriggered,
  onAIClassification,
  onFireAlarmConfirmed 
}, ref) => {
  const [showDetectionAlert, setShowDetectionAlert] = useState(false);
  const [consecutiveDetections, setConsecutiveDetections] = useState(0);
  const [hasTriggered, setHasTriggered] = useState(false);
  
  // Refs for callbacks
  const onAlertTriggeredRef = useRef(onAlertTriggered);
  const onFireAlarmConfirmedRef = useRef(onFireAlarmConfirmed);
  onAlertTriggeredRef.current = onAlertTriggered;
  onFireAlarmConfirmedRef.current = onFireAlarmConfirmed;

  // Use the AI detection hook
  const { status: aiStatus, lastClassification, error: aiError } = useAIAlarmDetection({ enabled });

  // Reset cooldown function
  const resetCooldown = useCallback(() => {
    setHasTriggered(false);
    setConsecutiveDetections(0);
    setShowDetectionAlert(false);
  }, []);

  // Expose resetCooldown to parent via ref
  useImperativeHandle(ref, () => ({
    resetCooldown
  }), [resetCooldown]);

  // Monitor AI classification results
  useEffect(() => {
    if (!lastClassification || hasTriggered) return;

    // Forward classification to parent
    if (onAIClassification) {
      onAIClassification(lastClassification, aiStatus);
    }

    // Check if it's a fire alarm category
    const isFireAlarm = FIRE_ALARM_CATEGORIES.some(
      category => lastClassification.categoryName.toLowerCase().includes(category.toLowerCase())
    ) && lastClassification.score >= CONFIDENCE_THRESHOLD;

    if (isFireAlarm) {
      setConsecutiveDetections(prev => {
        const newCount = prev + 1;
        
        // Check if we've reached the threshold for confirmed detection
        if (newCount >= REQUIRED_CONSECUTIVE_DETECTIONS && !hasTriggered) {
          setHasTriggered(true);
          setShowDetectionAlert(true);
          
          // Trigger the alert
          onAlertTriggeredRef.current("fire");
          onFireAlarmConfirmedRef.current?.();
          
          setTimeout(() => setShowDetectionAlert(false), 2000);
        }
        
        return newCount;
      });
    } else {
      // Reset consecutive count if not a fire alarm
      setConsecutiveDetections(0);
    }
  }, [lastClassification, aiStatus, hasTriggered, onAIClassification]);

  // Show error toast if there's an AI error
  useEffect(() => {
    if (aiError && aiStatus === "error") {
      toast({
        title: "AI Detection Error",
        description: aiError,
        variant: "destructive",
      });
    } else if (aiStatus === "permission_denied") {
      toast({
        title: "Microphone Access Required",
        description: "Please enable microphone access for AI sound detection.",
        variant: "destructive",
      });
    }
  }, [aiError, aiStatus]);

  // Determine display state
  const isDetecting = consecutiveDetections > 0;
  const isConfirmed = showDetectionAlert;
  const progress = Math.min(100, (consecutiveDetections / REQUIRED_CONSECUTIVE_DETECTIONS) * 100);

  // Get status icon and text
  const getStatusDisplay = () => {
    if (isConfirmed) {
      return { icon: <Flame className="w-5 h-5 animate-pulse" />, text: "Fire alarm detected!" };
    }
    if (isDetecting) {
      return { icon: <Flame className="w-5 h-5 animate-pulse" />, text: "Analyzing sound..." };
    }
    switch (aiStatus) {
      case "initializing":
        return { icon: <Loader2 className="w-5 h-5 animate-spin" />, text: "AI Initializing..." };
      case "idle":
        return { 
          icon: (
            <div className="relative">
              <Brain className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
          ), 
          text: "AI Listening..." 
        };
      case "detecting":
        return { icon: <Mic className="w-5 h-5" />, text: "Processing..." };
      case "error":
        return { icon: <AlertCircle className="w-5 h-5" />, text: "AI Error" };
      case "permission_denied":
        return { icon: <MicOff className="w-5 h-5" />, text: "Mic Denied" };
      default:
        return { icon: <MicOff className="w-5 h-5" />, text: "Paused" };
    }
  };

  const statusDisplay = getStatusDisplay();

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
              : aiStatus === "error" || aiStatus === "permission_denied"
                ? "bg-destructive/80 text-destructive-foreground"
                : aiStatus === "initializing"
                  ? "bg-blue-600/90 text-white"
                  : "bg-black/70 text-white"
          }
        `}
      >
        {/* Main status row */}
        <div className="flex items-center gap-2">
          {statusDisplay.icon}
          <span className="font-medium">{statusDisplay.text}</span>
        </div>

        {/* AI Classification result */}
        {lastClassification && aiStatus === "idle" && !isDetecting && !isConfirmed && (
          <div className="flex items-center gap-1.5 text-white/70 text-[10px]">
            <span>Detected: {lastClassification.categoryName}</span>
            <span className="text-white/50">({Math.round(lastClassification.score * 100)}%)</span>
          </div>
        )}

        {/* Secondary info row */}
        {aiStatus === "idle" && !isDetecting && !isConfirmed && (
          <div className="flex items-center gap-1.5 text-white/70">
            <Shield className="w-3 h-3" />
            <span>AI monitoring for emergencies</span>
          </div>
        )}

        {/* Detection progress */}
        {isDetecting && !isConfirmed && (
          <div className="w-full bg-white/20 rounded-full h-1 mt-1">
            <div 
              className="bg-white h-1 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Active status */}
        {aiStatus === "idle" && !isDetecting && (
          <div className="flex items-center gap-1.5 text-white/50 text-[10px]">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span>AI Active</span>
          </div>
        )}
      </div>
    </div>
  );
});

AudioMonitor.displayName = "AudioMonitor";

export default AudioMonitor;
