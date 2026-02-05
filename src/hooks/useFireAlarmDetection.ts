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

// Fire alarm frequency range (Hz)
const MIN_FREQUENCY = 3000;
const MAX_FREQUENCY = 4000;
const AMPLITUDE_THRESHOLD = 150; // Out of 255
const DETECTION_DURATION_MS = 2000; // Must persist for 2 seconds
const BEEP_INTERVAL_MS = 250; // Expected beep interval ~0.25-0.3s
const FFT_SIZE = 2048;
const SAMPLE_RATE = 44100; // Standard sample rate
const COOLDOWN_DURATION_MS = 30000; // 30 second cooldown

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
  const animationFrameRef = useRef<number | null>(null);
  const detectionStartRef = useRef<number | null>(null);
  const lastPeakTimeRef = useRef<number | null>(null);
  const peakCountRef = useRef<number>(0);
  const hasTriggeredRef = useRef<boolean>(false);
  const cooldownRef = useRef<number>(0);
  const wasDetectingRef = useRef<boolean>(false);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate frequency bin index for a given frequency
  const getFrequencyBinIndex = useCallback((frequency: number, sampleRate: number, fftSize: number) => {
    return Math.round((frequency * fftSize) / sampleRate);
  }, []);

  // Check if dominant frequency is in fire alarm range
  const isFireAlarmFrequency = useCallback((frequencyData: Uint8Array, sampleRate: number) => {
    const minBin = getFrequencyBinIndex(MIN_FREQUENCY, sampleRate, FFT_SIZE);
    const maxBin = getFrequencyBinIndex(MAX_FREQUENCY, sampleRate, FFT_SIZE);

    // Get max amplitude in fire alarm frequency range
    let maxAmplitude = 0;
    let maxBinIndex = minBin;
    for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
      if (frequencyData[i] > maxAmplitude) {
        maxAmplitude = frequencyData[i];
        maxBinIndex = i;
      }
    }

    // Check if amplitude exceeds threshold
    if (maxAmplitude < AMPLITUDE_THRESHOLD) {
      return { detected: false, amplitude: maxAmplitude };
    }

    // Check if this is the dominant frequency (not just background noise)
    // Compare to average amplitude outside the fire alarm range
    let outsideSum = 0;
    let outsideCount = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      if (i < minBin || i > maxBin) {
        outsideSum += frequencyData[i];
        outsideCount++;
      }
    }
    const outsideAverage = outsideCount > 0 ? outsideSum / outsideCount : 0;

    // Fire alarm frequency should be significantly louder than background
    const isSignificantlyLouder = maxAmplitude > outsideAverage * 2;

    return {
      detected: isSignificantlyLouder,
      amplitude: maxAmplitude,
      frequency: (maxBinIndex * sampleRate) / FFT_SIZE,
    };
  }, [getFrequencyBinIndex]);

  // Analyze audio in real-time
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !enabled) {
      return;
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(frequencyData);

    const now = Date.now();

    // Cooldown period after triggering (30 seconds)
    if (cooldownRef.current > now) {
      const remaining = Math.ceil((cooldownRef.current - now) / 1000);
      setState(prev => ({
        ...prev,
        detectionStatus: "cooldown",
        cooldownRemaining: remaining,
      }));
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      return;
    } else if (state.detectionStatus === "cooldown") {
      // Cooldown just ended, reset to idle
      setState(prev => ({
        ...prev,
        detectionStatus: "idle",
        cooldownRemaining: 0,
      }));
    }

    const result = isFireAlarmFrequency(frequencyData, SAMPLE_RATE);

    if (result.detected) {
      // Track beeping pattern
      if (lastPeakTimeRef.current) {
        const timeSinceLastPeak = now - lastPeakTimeRef.current;
        // Check if this matches beeping pattern (250-350ms intervals)
        if (timeSinceLastPeak >= 200 && timeSinceLastPeak <= 400) {
          peakCountRef.current++;
        } else if (timeSinceLastPeak > 500) {
          // Reset if too much time passed
          peakCountRef.current = 1;
          detectionStartRef.current = now;
        }
      } else {
        detectionStartRef.current = now;
        peakCountRef.current = 1;
        // Notify when detection starts
        if (!wasDetectingRef.current) {
          wasDetectingRef.current = true;
          onDetectionStart?.();
        }
      }
      lastPeakTimeRef.current = now;

      // Check if detection criteria met
      if (detectionStartRef.current) {
        const detectionDuration = now - detectionStartRef.current;
        const progress = Math.min(100, (detectionDuration / DETECTION_DURATION_MS) * 100);
        
        // Update detection status
        setState(prev => ({
          ...prev,
          detectionStatus: progress >= 100 ? "confirmed" : "detecting",
          detectionProgress: progress,
        }));

        // Need at least 2 seconds of detection with multiple beeps
        if (detectionDuration >= DETECTION_DURATION_MS && peakCountRef.current >= 4) {
          if (!hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            cooldownRef.current = now + 30000; // 30 second cooldown
            onFireAlarmDetected();
            
            // Reset after triggering
            setTimeout(() => {
              hasTriggeredRef.current = false;
              peakCountRef.current = 0;
              detectionStartRef.current = null;
              lastPeakTimeRef.current = null;
              wasDetectingRef.current = false;
              setState(prev => ({
                ...prev,
                detectionStatus: "idle",
                detectionProgress: 0,
              }));
            }, 5000);
          }
        }
      }
    } else {
      // Reset if no detection for a while
      if (lastPeakTimeRef.current && now - lastPeakTimeRef.current > 1000) {
        peakCountRef.current = 0;
        detectionStartRef.current = null;
        lastPeakTimeRef.current = null;
        wasDetectingRef.current = false;
        setState(prev => ({
          ...prev,
          detectionStatus: "idle",
          detectionProgress: 0,
        }));
      }
    }

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [enabled, isFireAlarmFrequency, onFireAlarmDetected]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!enabled) return;

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } 
      });
      streamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setState({
        isListening: true,
        error: null,
        permissionDenied: false,
        detectionStatus: "idle",
        detectionProgress: 0,
      });

      // Start analysis loop
      analyzeAudio();
    } catch (error: any) {
      console.error("Microphone access error:", error);
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setState({
          isListening: false,
          error: "Guardian Alert needs microphone access to detect fire alarms. Please enable in browser settings.",
          permissionDenied: true,
          detectionStatus: "idle",
          detectionProgress: 0,
        });
      } else if (error.name === "NotFoundError") {
        setState({
          isListening: false,
          error: "No microphone detected",
          permissionDenied: false,
          detectionStatus: "idle",
          detectionProgress: 0,
        });
      } else {
        setState({
          isListening: false,
          error: "Could not access microphone",
          permissionDenied: false,
          detectionStatus: "idle",
          detectionProgress: 0,
        });
      }
    }
  }, [enabled, analyzeAudio]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
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
    detectionStartRef.current = null;
    lastPeakTimeRef.current = null;
    peakCountRef.current = 0;
    hasTriggeredRef.current = false;

    setState(prev => ({
      ...prev,
      isListening: false,
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
  };
};
