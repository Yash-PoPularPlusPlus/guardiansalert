import { useEffect, useState, forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import { Mic, MicOff, AlertCircle, Flame, Shield, Brain, Loader2, Clock } from "lucide-react";
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

// Comprehensive list of fire alarm related categories from YAMNet
const FIRE_ALARM_CATEGORIES = [
  "Fire alarm",
  "Smoke detector, smoke alarm",
  "Smoke detector",
  "Siren",
  "Beep, bleep",
  "Ding",
  "Alarm",
  "Civil defense siren",
  "Buzzer",
  "Alarm clock",
  "Emergency vehicle",
  "Fire engine, fire truck (siren)",
];

const CONFIDENCE_THRESHOLD = 0.6;
const REQUIRED_CONSECUTIVE_DETECTIONS = 4;
const COOLDOWN_DURATION_MS = 30000; // 30 seconds cooldown

const AudioMonitor = forwardRef<AudioMonitorHandle, AudioMonitorProps>(({ 
  enabled, 
  onAlertTriggered,
  onAIClassification,
  onFireAlarmConfirmed 
}, ref) => {
  const [consecutiveDetections, setConsecutiveDetections] = useState(0);
  const [isInCooldown, setIsInCooldown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showConfirmedAlert, setShowConfirmedAlert] = useState(false);
  
  // Refs for stable callback references
  const onAlertTriggeredRef = useRef(onAlertTriggered);
  const onFireAlarmConfirmedRef = useRef(onFireAlarmConfirmed);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update refs on each render
  onAlertTriggeredRef.current = onAlertTriggered;
  onFireAlarmConfirmedRef.current = onFireAlarmConfirmed;

  // Use the AI detection hook
  const { status: aiStatus, lastClassification, error: aiError } = useAIAlarmDetection({ enabled });

  // Reset cooldown function
  const resetCooldown = useCallback(() => {
    setIsInCooldown(false);
    setCooldownRemaining(0);
    setConsecutiveDetections(0);
    setShowConfirmedAlert(false);
    
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  }, []);

  // Expose resetCooldown to parent via ref
  useImperativeHandle(ref, () => ({
    resetCooldown
  }), [resetCooldown]);

  // Start cooldown period
  const startCooldown = useCallback(() => {
    setIsInCooldown(true);
    setCooldownRemaining(COOLDOWN_DURATION_MS);
    
    // Update countdown every second
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        const newVal = prev - 1000;
        return newVal > 0 ? newVal : 0;
      });
    }, 1000);
    
    // End cooldown after duration
    cooldownTimerRef.current = setTimeout(() => {
      resetCooldown();
    }, COOLDOWN_DURATION_MS);
  }, [resetCooldown]);

  // Monitor AI classification results
  useEffect(() => {
    // Always forward classification to parent for display
    if (lastClassification && onAIClassification) {
      onAIClassification(lastClassification, aiStatus);
    }

    // Skip processing if no classification or in cooldown
    if (!lastClassification || isInCooldown) {
      return;
    }

    // Check if the detected category matches any fire alarm category
    const detectedCategory = lastClassification.categoryName.toLowerCase();
    const isFireAlarmCategory = FIRE_ALARM_CATEGORIES.some(
      category => detectedCategory.includes(category.toLowerCase()) || 
                  category.toLowerCase().includes(detectedCategory)
    );
    const meetsConfidenceThreshold = lastClassification.score >= CONFIDENCE_THRESHOLD;

    if (isFireAlarmCategory && meetsConfidenceThreshold) {
      setConsecutiveDetections(prev => {
        const newCount = prev + 1;
        
        // Check if we've reached the threshold for confirmed detection
        if (newCount >= REQUIRED_CONSECUTIVE_DETECTIONS) {
          // Trigger the alert
          setShowConfirmedAlert(true);
          onAlertTriggeredRef.current("fire");
          onFireAlarmConfirmedRef.current?.();
          
          // Start cooldown
          startCooldown();
          
          // Hide confirmed alert after a brief display
          setTimeout(() => setShowConfirmedAlert(false), 3000);
          
          return 0; // Reset after triggering
        }
        
        return newCount;
      });
    } else {
      // Reset consecutive count if not a fire alarm category
      setConsecutiveDetections(0);
    }
  }, [lastClassification, aiStatus, isInCooldown, onAIClassification, startCooldown]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  // Determine display state
  const isDetecting = consecutiveDetections > 0;
  const progress = Math.min(100, (consecutiveDetections / REQUIRED_CONSECUTIVE_DETECTIONS) * 100);
  const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

  // Get status icon and text
  const getStatusDisplay = () => {
    if (showConfirmedAlert) {
      return { 
        icon: <Flame className="w-5 h-5 animate-pulse" />, 
        text: "🚨 Fire Alarm Detected!",
        subtext: "Alert triggered"
      };
    }
    if (isInCooldown) {
      return { 
        icon: <Clock className="w-5 h-5" />, 
        text: "Cooldown Active",
        subtext: `Resuming in ${cooldownSeconds}s`
      };
    }
    if (isDetecting) {
      return { 
        icon: <Flame className="w-5 h-5 animate-pulse" />, 
        text: `Detecting: ${consecutiveDetections}/${REQUIRED_CONSECUTIVE_DETECTIONS}`,
        subtext: lastClassification?.categoryName || "Analyzing..."
      };
    }
    switch (aiStatus) {
      case "initializing":
        return { 
          icon: <Loader2 className="w-5 h-5 animate-spin" />, 
          text: "AI Initializing...",
          subtext: "Loading model"
        };
      case "idle":
        return { 
          icon: (
            <div className="relative">
              <Brain className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
          ), 
          text: "AI Listening...",
          subtext: lastClassification ? `${lastClassification.categoryName} (${Math.round(lastClassification.score * 100)}%)` : "Monitoring for emergencies"
        };
      case "detecting":
        return { 
          icon: <Mic className="w-5 h-5" />, 
          text: "Processing...",
          subtext: "Analyzing audio"
        };
      case "error":
        return { 
          icon: <AlertCircle className="w-5 h-5" />, 
          text: "AI Error",
          subtext: aiError || "Check console"
        };
      case "permission_denied":
        return { 
          icon: <MicOff className="w-5 h-5" />, 
          text: "Mic Denied",
          subtext: "Enable microphone access"
        };
      default:
        return { 
          icon: <MicOff className="w-5 h-5" />, 
          text: "Paused",
          subtext: "Monitoring disabled"
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Determine background color based on state
  const getBackgroundClass = () => {
    if (showConfirmedAlert) return "bg-destructive text-destructive-foreground";
    if (isInCooldown) return "bg-muted text-muted-foreground";
    if (isDetecting) return "bg-amber-500/90 text-white";
    if (aiStatus === "error" || aiStatus === "permission_denied") return "bg-destructive/80 text-destructive-foreground";
    if (aiStatus === "initializing") return "bg-blue-600/90 text-white";
    return "bg-black/70 text-white";
  };

  return (
    <div className="fixed top-4 right-4 z-40">
      <div 
        className={`
          flex flex-col gap-1 px-3 py-2 rounded-xl text-xs
          backdrop-blur-md shadow-lg transition-all duration-300
          ${getBackgroundClass()}
        `}
      >
        {/* Main status row */}
        <div className="flex items-center gap-2">
          {statusDisplay.icon}
          <span className="font-medium">{statusDisplay.text}</span>
        </div>

        {/* Subtext row */}
        {statusDisplay.subtext && (
          <div className="flex items-center gap-1.5 text-[10px] opacity-80">
            <span>{statusDisplay.subtext}</span>
          </div>
        )}

        {/* Detection progress bar */}
        {isDetecting && !showConfirmedAlert && (
          <div className="w-full bg-white/20 rounded-full h-1.5 mt-1">
            <div 
              className="bg-white h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Cooldown progress bar */}
        {isInCooldown && (
          <div className="w-full bg-white/20 rounded-full h-1.5 mt-1">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${(cooldownRemaining / COOLDOWN_DURATION_MS) * 100}%` }}
            />
          </div>
        )}

        {/* Active indicator when idle */}
        {aiStatus === "idle" && !isDetecting && !isInCooldown && (
          <div className="flex items-center gap-1.5 text-[10px] opacity-60">
            <Shield className="w-3 h-3" />
            <span>AI Active</span>
          </div>
        )}
      </div>
    </div>
  );
});

AudioMonitor.displayName = "AudioMonitor";

export default AudioMonitor;
