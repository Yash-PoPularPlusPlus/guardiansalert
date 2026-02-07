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

// Comprehensive list of alarm-related sounds
const ALARM_SOUNDS = [
  "Fire alarm",
  "Smoke detector, smoke alarm",
  "Siren",
  "Alarm",
  "Beep, bleep",
  "Ding",
];

const CONFIDENCE_THRESHOLD = 0.3;
const CONFIRMATION_THRESHOLD = 3;
const MAX_MISSES = 4;
const COOLDOWN_DURATION_MS = 30000;

const AudioMonitor = forwardRef<AudioMonitorHandle, AudioMonitorProps>(({ 
  enabled, 
  onAlertTriggered,
  onAIClassification,
  onFireAlarmConfirmed 
}, ref) => {
  // Refs for detection counters (stable across renders)
  const detectionCountRef = useRef(0);
  const missCountRef = useRef(0);
  
  // State for UI updates
  const [detectionCount, setDetectionCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
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
    detectionCountRef.current = 0;
    missCountRef.current = 0;
    setDetectionCount(0);
    setMissCount(0);
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

  // Monitor AI classification results - Core detection logic
  useEffect(() => {
    // Always forward classification to parent for display
    if (lastClassification && onAIClassification) {
      onAIClassification(lastClassification, aiStatus);
    }

    // Skip processing if no classification or in cooldown
    if (!lastClassification || isInCooldown) {
      return;
    }

    const detectedCategory = lastClassification.categoryName;
    const confidence = lastClassification.score;
    
    // Check if detected sound matches any alarm category
    const isAlarmSound = ALARM_SOUNDS.some(
      sound => detectedCategory.toLowerCase().includes(sound.toLowerCase()) || 
               sound.toLowerCase().includes(detectedCategory.toLowerCase())
    );

    if (isAlarmSound && confidence > CONFIDENCE_THRESHOLD) {
      // Alarm sound detected - increment count, reset misses
      detectionCountRef.current += 1;
      missCountRef.current = 0;
      
      // Update state for UI
      setDetectionCount(detectionCountRef.current);
      setMissCount(0);
      
      console.log(`[DETECTED] Sound: ${detectedCategory}, Confidence: ${confidence}, Confirmations: ${detectionCountRef.current}`);
      
      // Check if threshold reached
      if (detectionCountRef.current >= CONFIRMATION_THRESHOLD) {
        console.log("[CONFIRMED] Threshold reached! Triggering alert!");
        
        // Trigger the alert
        setShowConfirmedAlert(true);
        onAlertTriggeredRef.current("fire");
        onFireAlarmConfirmedRef.current?.();
        
        // Reset counters
        detectionCountRef.current = 0;
        missCountRef.current = 0;
        setDetectionCount(0);
        setMissCount(0);
        
        // Start cooldown immediately
        startCooldown();
        
        // Hide confirmed alert after a brief display
        setTimeout(() => setShowConfirmedAlert(false), 3000);
      }
    } else if (detectionCountRef.current > 0) {
      // Non-alarm sound detected while tracking potential alarm
      missCountRef.current += 1;
      setMissCount(missCountRef.current);
      
      console.log(`[MISS] Non-alarm sound detected. Miss count: ${missCountRef.current}`);
      
      // Check if max misses exceeded
      if (missCountRef.current > MAX_MISSES) {
        console.log("[RESET] Max misses reached. Resetting detection.");
        detectionCountRef.current = 0;
        missCountRef.current = 0;
        setDetectionCount(0);
        setMissCount(0);
      }
    }
    // If detectionCountRef.current === 0 and not an alarm sound, do nothing
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
  const isDetecting = detectionCount > 0;
  const isReEvaluating = isDetecting && missCount > 0;
  const progress = Math.min(100, (detectionCount / CONFIRMATION_THRESHOLD) * 100);
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
        text: `Cooldown: ${cooldownSeconds}s`,
        subtext: "Resuming monitoring soon"
      };
    }
    if (isReEvaluating) {
      return { 
        icon: <Flame className="w-5 h-5 animate-pulse opacity-70" />, 
        text: `Re-evaluating... (${missCount}/${MAX_MISSES})`,
        subtext: `${detectionCount}/${CONFIRMATION_THRESHOLD} confirmations`
      };
    }
    if (isDetecting && lastClassification) {
      return { 
        icon: <Flame className="w-5 h-5 animate-pulse" />, 
        text: `Analyzing: ${lastClassification.categoryName} (${Math.round(lastClassification.score * 100)}%)`,
        subtext: `${detectionCount}/${CONFIRMATION_THRESHOLD} confirmations`
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
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full animate-pulse" />
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
    if (isReEvaluating) return "bg-amber-600/70 text-white";
    if (isDetecting) return "bg-amber-500/90 text-white";
    if (aiStatus === "error" || aiStatus === "permission_denied") return "bg-destructive/80 text-destructive-foreground";
    if (aiStatus === "initializing") return "bg-primary/90 text-primary-foreground";
    return "bg-background/70 text-foreground";
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
