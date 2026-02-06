import { useState, useRef, useCallback, useEffect, useMemo } from "react";

export type DetectionStatus = "idle" | "detecting" | "confirmed" | "cooldown";

export interface FireAlarmDetectionState {
  isListening: boolean;
  error: string | null;
  permissionDenied: boolean;
  detectionStatus: DetectionStatus;
  detectionProgress: number; // 0-100 percent towards confirmation
  cooldownRemaining: number; // seconds remaining in cooldown
}

interface UseFireAlarmDetectionOptions {
  onFireAlarmDetected: () => void;
  onDetectionStart?: () => void;
  enabled?: boolean;
}

// Fire alarm frequency range (Hz) - widened for real-world variation
const MIN_FREQUENCY = 3400;
const MAX_FREQUENCY = 4000;

// Detection thresholds
const MIN_AMPLITUDE = 80; // Lowered slightly for sensitivity
const REQUIRED_DETECTIONS = 8; // Need 8 out of 10 checks (~1 second)
const MAX_MISSES = 3; // Allow up to 3 misses before reset
const ANALYSIS_INTERVAL_MS = 100; // Analyze every 100ms
const COOLDOWN_DURATION_MS = 30000; // 30 second cooldown

// Technical constants
const FFT_SIZE = 2048;
const SAMPLE_RATE = 44100;

export const useFireAlarmDetection = ({
  onFireAlarmDetected,
  onDetectionStart,
  enabled = true,
}: UseFireAlarmDetectionOptions) => {
  const [state, setState] = useState<FireAlarmDetectionState>({
    isListening: false,
    error: null,
    permissionDenied: false,
    detectionStatus: "idle",
    detectionProgress: 0,
    cooldownRemaining: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisIntervalRef = useRef<number | null>(null);
  
  // Detection tracking
  const detectionCountRef = useRef<number>(0);
  const missCountRef = useRef<number>(0);
  const hasTriggeredRef = useRef<boolean>(false);
  const cooldownRef = useRef<number>(0);
  const wasDetectingRef = useRef<boolean>(false);
  
  // Store callbacks in refs
  const onFireAlarmDetectedRef = useRef(onFireAlarmDetected);
  const onDetectionStartRef = useRef(onDetectionStart);
  
  onFireAlarmDetectedRef.current = onFireAlarmDetected;
  onDetectionStartRef.current = onDetectionStart;

  // Find peak frequency in the fire alarm range specifically
  const findPeakInRange = useCallback((frequencyData: Uint8Array) => {
    const minBin = Math.floor((MIN_FREQUENCY * FFT_SIZE) / SAMPLE_RATE);
    const maxBin = Math.ceil((MAX_FREQUENCY * FFT_SIZE) / SAMPLE_RATE);
    
    let maxMagnitude = 0;
    let peakBin = minBin;
    
    // Find peak within fire alarm frequency range
    for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
      if (frequencyData[i] > maxMagnitude) {
        maxMagnitude = frequencyData[i];
        peakBin = i;
      }
    }
    
    const peakFrequency = (peakBin * SAMPLE_RATE) / FFT_SIZE;
    
    // Also get overall peak for comparison
    let overallMax = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > overallMax) {
        overallMax = frequencyData[i];
      }
    }
    
    return {
      frequency: peakFrequency,
      magnitude: maxMagnitude,
      overallMax,
      // Fire alarm should be dominant in its range
      isDominant: maxMagnitude >= overallMax * 0.5,
    };
  }, []);

  // Main analysis function - runs every 100ms
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !enabled) return;

    const now = Date.now();

    // Handle cooldown
    if (cooldownRef.current > now) {
      const remaining = Math.ceil((cooldownRef.current - now) / 1000);
      setState(prev => ({
        ...prev,
        detectionStatus: "cooldown",
        cooldownRemaining: remaining,
        detectionProgress: 0,
      }));
      return;
    } else if (state.detectionStatus === "cooldown") {
      setState(prev => ({
        ...prev,
        detectionStatus: "idle",
        cooldownRemaining: 0,
      }));
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(frequencyData);

    const result = findPeakInRange(frequencyData);
    
    // Check if it matches fire alarm characteristics
    const isValidDetection = result.magnitude >= MIN_AMPLITUDE && result.isDominant;

    // Debug logging (every 10th analysis to reduce spam)
    if (detectionCountRef.current > 0 || result.magnitude > 50) {
      console.log("🎤 Audio:", {
        freq: result.frequency.toFixed(0) + " Hz",
        mag: result.magnitude,
        valid: isValidDetection,
        detections: detectionCountRef.current,
        misses: missCountRef.current,
      });
    }

    if (isValidDetection) {
      // Reset miss counter on valid detection
      missCountRef.current = 0;
      
      // Start detection tracking
      if (!wasDetectingRef.current) {
        wasDetectingRef.current = true;
        onDetectionStartRef.current?.();
      }
      
      detectionCountRef.current++;
      
      // Calculate progress (0-100%)
      const progress = Math.min(100, (detectionCountRef.current / REQUIRED_DETECTIONS) * 100);
      
      setState(prev => ({
        ...prev,
        detectionStatus: detectionCountRef.current >= REQUIRED_DETECTIONS ? "confirmed" : "detecting",
        detectionProgress: progress,
      }));

      // Trigger if we have enough detections
      if (detectionCountRef.current >= REQUIRED_DETECTIONS && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        cooldownRef.current = now + COOLDOWN_DURATION_MS;
        
        console.log("🔥 Fire alarm CONFIRMED:", {
          frequency: result.frequency.toFixed(0) + " Hz",
          amplitude: result.magnitude,
          detections: detectionCountRef.current,
        });
        
        onFireAlarmDetectedRef.current();
        
        // Reset after trigger
        setTimeout(() => {
          hasTriggeredRef.current = false;
          detectionCountRef.current = 0;
          missCountRef.current = 0;
          wasDetectingRef.current = false;
        }, 5000);
      }
    } else if (wasDetectingRef.current) {
      // We were detecting but this sample didn't match
      missCountRef.current++;
      
      // Allow some misses before resetting
      if (missCountRef.current >= MAX_MISSES) {
        console.log("❌ Detection reset after", missCountRef.current, "misses");
        detectionCountRef.current = 0;
        missCountRef.current = 0;
        wasDetectingRef.current = false;
        
        setState(prev => ({
          ...prev,
          detectionStatus: "idle",
          detectionProgress: 0,
        }));
      } else {
        // Still in detection mode, just a brief interruption
        const progress = Math.min(100, (detectionCountRef.current / REQUIRED_DETECTIONS) * 100);
        setState(prev => ({
          ...prev,
          detectionStatus: "detecting",
          detectionProgress: progress,
        }));
      }
    }
  }, [enabled, state.detectionStatus, findPeakInRange]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!enabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } 
      });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.5; // More smoothing for stability
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setState({
        isListening: true,
        error: null,
        permissionDenied: false,
        detectionStatus: "idle",
        detectionProgress: 0,
        cooldownRemaining: 0,
      });

      // Analyze every 100ms
      analysisIntervalRef.current = window.setInterval(analyzeAudio, ANALYSIS_INTERVAL_MS);
    } catch (error: any) {
      console.error("Microphone access error:", error);
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setState({
          isListening: false,
          error: "Guardian Alert needs microphone access to detect fire alarms. Please enable in browser settings.",
          permissionDenied: true,
          detectionStatus: "idle",
          detectionProgress: 0,
          cooldownRemaining: 0,
        });
      } else if (error.name === "NotFoundError") {
        setState({
          isListening: false,
          error: "No microphone detected",
          permissionDenied: false,
          detectionStatus: "idle",
          detectionProgress: 0,
          cooldownRemaining: 0,
        });
      } else {
        setState({
          isListening: false,
          error: "Could not access microphone",
          permissionDenied: false,
          detectionStatus: "idle",
          detectionProgress: 0,
          cooldownRemaining: 0,
        });
      }
    }
  }, [enabled, analyzeAudio]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    detectionCountRef.current = 0;
    missCountRef.current = 0;
    hasTriggeredRef.current = false;
    wasDetectingRef.current = false;

    setState(prev => ({
      ...prev,
      isListening: false,
    }));
  }, []);

  // Reset cooldown
  const resetCooldown = useCallback(() => {
    cooldownRef.current = 0;
    hasTriggeredRef.current = false;
    detectionCountRef.current = 0;
    missCountRef.current = 0;
    wasDetectingRef.current = false;
    setState(prev => ({
      ...prev,
      detectionStatus: "idle",
      detectionProgress: 0,
      cooldownRemaining: 0,
    }));
  }, []);

  // Auto-start when enabled changes
  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [enabled, startListening, stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    resetCooldown,
  };
};
