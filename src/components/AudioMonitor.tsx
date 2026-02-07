import { useEffect, useState, forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import { Mic, MicOff, AlertCircle, Flame, Shield, Brain, Loader2, Clock } from "lucide-react";
import { useAIAlarmDetection, AIClassificationResult, AIDetectionStatus } from "@/hooks/useAIAlarmDetection";
import { toast } from "@/hooks/use-toast";

interface AudioMonitorProps {
  onAIClassification?: (result: AIClassificationResult, status: AIDetectionStatus) => void;
  onFireAlarmConfirmed?: () => void;
}

export interface AudioMonitorHandle {
  reset: () => void;
}

// Internal state machine type - SINGLE SOURCE OF TRUTH
type InternalStatus = "IDLE" | "DETECTING" | "COOLDOWN";

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
const COOLDOWN_DURATION_MS = 12000;

const AudioMonitor = forwardRef<AudioMonitorHandle, AudioMonitorProps>(({ 
  onAIClassification,
  onFireAlarmConfirmed 
}, ref) => {
  // SINGLE SOURCE OF TRUTH - Internal state machine
  const [internalStatus, setInternalStatus] = useState<InternalStatus>("IDLE");
  
  // Refs for detection counters (stable across renders)
  const detectionCountRef = useRef(0);
  const missCountRef = useRef(0);
  
  // State for UI updates only
  const [detectionCount, setDetectionCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  // Ref to track the last processed classification to avoid reprocessing stale data
  const lastProcessedClassificationRef = useRef<AIClassificationResult>(null);
  
  // Refs for stable callback references
  const onFireAlarmConfirmedRef = useRef(onFireAlarmConfirmed);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update refs on each render
  onFireAlarmConfirmedRef.current = onFireAlarmConfirmed;

  // Derive whether AI should be active based on internal status
  const isAIEnabled = internalStatus !== "COOLDOWN";

  // Use the AI detection hook - ONLY enabled when NOT in cooldown
  const { status: aiStatus, lastClassification, error: aiError } = useAIAlarmDetection({ 
    enabled: isAIEnabled 
  });

  // Reset function - clears cooldown and returns to IDLE
  const reset = useCallback(() => {
    // Clear timers
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
    
    // Reset all state
    setInternalStatus("IDLE");
    setCooldownRemaining(0);
    detectionCountRef.current = 0;
    missCountRef.current = 0;
    setDetectionCount(0);
    setMissCount(0);
  }, []);

  // Expose reset to parent via ref
  useImperativeHandle(ref, () => ({
    reset
  }), [reset]);

  // Start cooldown period - self-contained timer management
  const startCooldown = useCallback(() => {
    // Set initial cooldown time
    setCooldownRemaining(COOLDOWN_DURATION_MS);
    
    // Update countdown every second
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        const newVal = prev - 1000;
        return newVal > 0 ? newVal : 0;
      });
    }, 1000);
    
    // End cooldown after duration - automatically return to IDLE
    cooldownTimerRef.current = setTimeout(() => {
      // Clear interval
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
      
      // Reset detection state
      detectionCountRef.current = 0;
      missCountRef.current = 0;
      setDetectionCount(0);
      setMissCount(0);
      
      // Return to IDLE
      setInternalStatus("IDLE");
    }, COOLDOWN_DURATION_MS);
  }, []);

  // Core detection logic - ONLY runs when NOT in COOLDOWN
  useEffect(() => {
    // Always forward classification to parent for display (regardless of internal state)
    if (lastClassification && onAIClassification) {
      onAIClassification(lastClassification, aiStatus);
    }

    // CRITICAL: Skip ALL processing if in COOLDOWN state
    if (internalStatus === "COOLDOWN") {
      return;
    }

    // Skip if no classification available
    if (!lastClassification) {
      return;
    }

    // CRITICAL: Skip if this is the same classification we already processed
    if (lastClassification === lastProcessedClassificationRef.current) {
      return;
    }
    lastProcessedClassificationRef.current = lastClassification;

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
      setInternalStatus("DETECTING");
      
      // Check if threshold reached
      if (detectionCountRef.current >= CONFIRMATION_THRESHOLD) {
        // Trigger the alert callback ONCE (single callback, no duplicates)
        onFireAlarmConfirmedRef.current?.();
        
        // Reset detection counters
        detectionCountRef.current = 0;
        missCountRef.current = 0;
        setDetectionCount(0);
        setMissCount(0);
        
        // Immediately transition to COOLDOWN
        setInternalStatus("COOLDOWN");
        startCooldown();
      }
    } else if (detectionCountRef.current > 0) {
      // Non-alarm sound detected while tracking potential alarm
      missCountRef.current += 1;
      setMissCount(missCountRef.current);
      
      // Check if max misses exceeded
      if (missCountRef.current > MAX_MISSES) {
        detectionCountRef.current = 0;
        missCountRef.current = 0;
        setDetectionCount(0);
        setMissCount(0);
        setInternalStatus("IDLE");
      }
    }
  }, [lastClassification, aiStatus, internalStatus, onAIClassification, startCooldown]);

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

  // Determine display values
  const progress = Math.min(100, (detectionCount / CONFIRMATION_THRESHOLD) * 100);
  const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

  // Get status icon and text based on internalStatus
  const getStatusDisplay = () => {
    switch (internalStatus) {
      case "COOLDOWN":
        return { 
          icon: <Clock className="w-5 h-5" />, 
          text: `Cooldown: ${cooldownSeconds}s`,
          subtext: "Resuming monitoring soon"
        };
      case "DETECTING":
        if (missCount > 0) {
          return { 
            icon: <Flame className="w-5 h-5 animate-pulse opacity-70" />, 
            text: `Re-evaluating... (${missCount}/${MAX_MISSES})`,
            subtext: `${detectionCount}/${CONFIRMATION_THRESHOLD} confirmations`
          };
        }
        return { 
          icon: <Flame className="w-5 h-5 animate-pulse" />, 
          text: lastClassification 
            ? `Analyzing: ${lastClassification.categoryName} (${Math.round(lastClassification.score * 100)}%)`
            : "Analyzing...",
          subtext: `${detectionCount}/${CONFIRMATION_THRESHOLD} confirmations`
        };
      case "IDLE":
      default:
        // Show AI status when idle
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
    }
  };

  const statusDisplay = getStatusDisplay();

  // Determine background color based on internalStatus
  const getBackgroundClass = () => {
    switch (internalStatus) {
      case "COOLDOWN":
        return "bg-muted text-muted-foreground";
      case "DETECTING":
        return missCount > 0 
          ? "bg-amber-600/70 text-white" 
          : "bg-amber-500/90 text-white";
      case "IDLE":
      default:
        if (aiStatus === "error" || aiStatus === "permission_denied") {
          return "bg-destructive/80 text-destructive-foreground";
        }
        if (aiStatus === "initializing") {
          return "bg-primary/90 text-primary-foreground";
        }
        return "bg-background/70 text-foreground";
    }
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
        {internalStatus === "DETECTING" && (
          <div className="w-full bg-white/20 rounded-full h-1.5 mt-1">
            <div 
              className="bg-white h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Cooldown progress bar */}
        {internalStatus === "COOLDOWN" && (
          <div className="w-full bg-white/20 rounded-full h-1.5 mt-1">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${(cooldownRemaining / COOLDOWN_DURATION_MS) * 100}%` }}
            />
          </div>
        )}

        {/* Active indicator when idle */}
        {internalStatus === "IDLE" && aiStatus === "idle" && (
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
