import { useState, useRef, useCallback, useEffect } from "react";

export type DetectionStatus = "idle" | "detecting" | "confirmed" | "cooldown";

export interface FireAlarmDetectionState {
  isListening: boolean;
  error: string | null;
  permissionDenied: boolean;
  detectionStatus: DetectionStatus;
  detectionProgress: number;
  cooldownRemaining: number;
}

interface UseFireAlarmDetectionOptions {
  onFireAlarmDetected: () => void;
  onDetectionStart?: () => void;
  enabled?: boolean;
}

// Fire alarm frequency range - WIDE to catch various alarms
const MIN_FREQUENCY = 2500;
const MAX_FREQUENCY = 4500;

// Detection thresholds - RELAXED for sensitivity
const MIN_AMPLITUDE = 40; // Lower threshold to detect quieter sounds
const REQUIRED_DETECTIONS = 6; // ~600ms of detection
const MAX_MISSES = 5; // More tolerance for gaps
const ANALYSIS_INTERVAL_MS = 100;
const COOLDOWN_DURATION_MS = 30000;

const FFT_SIZE = 2048;

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

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Detection state refs (to avoid closure issues)
  const detectionCountRef = useRef(0);
  const missCountRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  const cooldownEndRef = useRef(0);
  const wasDetectingRef = useRef(false);
  const enabledRef = useRef(enabled);
  
  // Callback refs
  const onFireAlarmDetectedRef = useRef(onFireAlarmDetected);
  const onDetectionStartRef = useRef(onDetectionStart);
  
  // Keep refs updated
  enabledRef.current = enabled;
  onFireAlarmDetectedRef.current = onFireAlarmDetected;
  onDetectionStartRef.current = onDetectionStart;

  // Analysis function using refs only (no state dependencies)
  const runAnalysis = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !enabledRef.current) return;

    const now = Date.now();
    const sampleRate = audioContextRef.current?.sampleRate || 44100;

    // Handle cooldown
    if (cooldownEndRef.current > now) {
      const remaining = Math.ceil((cooldownEndRef.current - now) / 1000);
      setState(prev => 
        prev.detectionStatus !== "cooldown" || prev.cooldownRemaining !== remaining
          ? { ...prev, detectionStatus: "cooldown", cooldownRemaining: remaining, detectionProgress: 0 }
          : prev
      );
      return;
    }

    // Get frequency data
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    // Calculate bin indices for fire alarm range
    const minBin = Math.floor((MIN_FREQUENCY * FFT_SIZE) / sampleRate);
    const maxBin = Math.ceil((MAX_FREQUENCY * FFT_SIZE) / sampleRate);

    // Find peak in fire alarm range
    let peakMagnitude = 0;
    let peakBin = minBin;
    for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
      if (frequencyData[i] > peakMagnitude) {
        peakMagnitude = frequencyData[i];
        peakBin = i;
      }
    }
    
    const peakFreq = (peakBin * sampleRate) / FFT_SIZE;

    // Find overall max for dominance check
    let overallMax = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > overallMax) overallMax = frequencyData[i];
    }

    // Detection criteria: loud enough AND somewhat dominant in spectrum
    const isValid = peakMagnitude >= MIN_AMPLITUDE && peakMagnitude >= overallMax * 0.3;

    // Debug log when there's significant sound
    if (peakMagnitude > 30) {
      console.log("🎤", {
        freq: Math.round(peakFreq),
        mag: peakMagnitude,
        max: overallMax,
        valid: isValid,
        count: detectionCountRef.current,
      });
    }

    if (isValid) {
      missCountRef.current = 0;
      
      if (!wasDetectingRef.current) {
        wasDetectingRef.current = true;
        onDetectionStartRef.current?.();
        console.log("🔊 Detection started");
      }
      
      detectionCountRef.current++;
      const progress = Math.min(100, (detectionCountRef.current / REQUIRED_DETECTIONS) * 100);
      const isConfirmed = detectionCountRef.current >= REQUIRED_DETECTIONS;
      
      setState(prev => ({
        ...prev,
        detectionStatus: isConfirmed ? "confirmed" : "detecting",
        detectionProgress: progress,
        cooldownRemaining: 0,
      }));

      // Trigger alarm
      if (isConfirmed && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        cooldownEndRef.current = now + COOLDOWN_DURATION_MS;
        
        console.log("🔥 FIRE ALARM CONFIRMED!", { freq: Math.round(peakFreq), mag: peakMagnitude });
        onFireAlarmDetectedRef.current();
        
        // Reset after delay
        setTimeout(() => {
          hasTriggeredRef.current = false;
          detectionCountRef.current = 0;
          missCountRef.current = 0;
          wasDetectingRef.current = false;
        }, 5000);
      }
    } else if (wasDetectingRef.current) {
      missCountRef.current++;
      
      if (missCountRef.current >= MAX_MISSES) {
        console.log("❌ Detection reset");
        detectionCountRef.current = 0;
        missCountRef.current = 0;
        wasDetectingRef.current = false;
        
        setState(prev => ({
          ...prev,
          detectionStatus: "idle",
          detectionProgress: 0,
        }));
      }
    }
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    if (!enabledRef.current) return;
    
    // Clean up any existing
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      console.log("🎙️ Starting microphone...");
      
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
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      console.log("✅ Microphone active, sample rate:", audioContext.sampleRate);

      setState({
        isListening: true,
        error: null,
        permissionDenied: false,
        detectionStatus: "idle",
        detectionProgress: 0,
        cooldownRemaining: 0,
      });

      // Start analysis loop
      intervalRef.current = window.setInterval(runAnalysis, ANALYSIS_INTERVAL_MS);
      
    } catch (error: any) {
      console.error("❌ Microphone error:", error);
      
      const isPermissionDenied = error.name === "NotAllowedError" || error.name === "PermissionDeniedError";
      const isNotFound = error.name === "NotFoundError";
      
      setState({
        isListening: false,
        error: isPermissionDenied 
          ? "Microphone access required. Please enable in browser settings."
          : isNotFound 
            ? "No microphone detected"
            : "Could not access microphone",
        permissionDenied: isPermissionDenied,
        detectionStatus: "idle",
        detectionProgress: 0,
        cooldownRemaining: 0,
      });
    }
  }, [runAnalysis]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    
    audioContextRef.current?.close();
    audioContextRef.current = null;
    
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    
    analyserRef.current = null;
    detectionCountRef.current = 0;
    missCountRef.current = 0;
    hasTriggeredRef.current = false;
    wasDetectingRef.current = false;

    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  // Reset cooldown
  const resetCooldown = useCallback(() => {
    cooldownEndRef.current = 0;
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

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
    return () => stopListening();
  }, [enabled, startListening, stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    resetCooldown,
  };
};
