import { useState, useRef, useCallback, useEffect } from "react";

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

// Fire alarm frequency range (Hz) - narrowed to actual fire alarm
const MIN_FREQUENCY = 3600;
const MAX_FREQUENCY = 3800;

// Detection thresholds
const MIN_AMPLITUDE = 100; // Minimum amplitude (out of 255)
const REQUIRED_DETECTIONS = 10; // 1 second of consistent detection (10 checks at 100ms)
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
  
  // Simple consecutive detection counter
  const detectionCountRef = useRef<number>(0);
  const hasTriggeredRef = useRef<boolean>(false);
  const cooldownRef = useRef<number>(0);
  const wasDetectingRef = useRef<boolean>(false);
  
  // Store callbacks in refs
  const onFireAlarmDetectedRef = useRef(onFireAlarmDetected);
  const onDetectionStartRef = useRef(onDetectionStart);
  
  onFireAlarmDetectedRef.current = onFireAlarmDetected;
  onDetectionStartRef.current = onDetectionStart;

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

    // Find peak frequency and magnitude
    let maxMagnitude = 0;
    let peakBin = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > maxMagnitude) {
        maxMagnitude = frequencyData[i];
        peakBin = i;
      }
    }
    
    // Calculate frequency from bin
    const peakFrequency = (peakBin * SAMPLE_RATE) / FFT_SIZE;

    // Check if it matches fire alarm characteristics
    const isFireAlarmFrequency = peakFrequency >= MIN_FREQUENCY && peakFrequency <= MAX_FREQUENCY;
    const isLoudEnough = maxMagnitude >= MIN_AMPLITUDE;

    if (isFireAlarmFrequency && isLoudEnough) {
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

      // Trigger if we have enough consecutive detections
      if (detectionCountRef.current >= REQUIRED_DETECTIONS && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        cooldownRef.current = now + COOLDOWN_DURATION_MS;
        
        console.log("🔥 Fire alarm detected:", {
          frequency: peakFrequency.toFixed(0) + " Hz",
          amplitude: maxMagnitude,
          detections: detectionCountRef.current,
        });
        
        onFireAlarmDetectedRef.current();
        
        // Reset after trigger
        setTimeout(() => {
          hasTriggeredRef.current = false;
          detectionCountRef.current = 0;
          wasDetectingRef.current = false;
        }, 5000);
      }
    } else {
      // Reset if pattern breaks
      if (detectionCountRef.current > 0) {
        detectionCountRef.current = 0;
        wasDetectingRef.current = false;
        
        setState(prev => ({
          ...prev,
          detectionStatus: "idle",
          detectionProgress: 0,
        }));
      }
    }
  }, [enabled, state.detectionStatus]);

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
      analyser.smoothingTimeConstant = 0.3;
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
