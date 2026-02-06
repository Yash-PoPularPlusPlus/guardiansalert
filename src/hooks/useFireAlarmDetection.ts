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

// Fire alarm frequency range (high-pitched beeping)
const ALARM_MIN_FREQ = 3000;
const ALARM_MAX_FREQ = 4000;

// Voice frequency range to check against (to filter out speech)
const VOICE_MAX_FREQ = 2500;

// Detection thresholds
const MIN_AMPLITUDE = 60; // Moderate threshold
const VOICE_RATIO_THRESHOLD = 1.5; // Alarm must be 1.5x louder than voice range
const REQUIRED_DETECTIONS = 8; // ~800ms of detection
const MAX_MISSES = 4; // Tolerance for gaps
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

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  const detectionCountRef = useRef(0);
  const missCountRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  const cooldownEndRef = useRef(0);
  const wasDetectingRef = useRef(false);
  const enabledRef = useRef(enabled);
  
  const onFireAlarmDetectedRef = useRef(onFireAlarmDetected);
  const onDetectionStartRef = useRef(onDetectionStart);
  
  enabledRef.current = enabled;
  onFireAlarmDetectedRef.current = onFireAlarmDetected;
  onDetectionStartRef.current = onDetectionStart;

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

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    // Calculate bin indices
    const alarmMinBin = Math.floor((ALARM_MIN_FREQ * FFT_SIZE) / sampleRate);
    const alarmMaxBin = Math.ceil((ALARM_MAX_FREQ * FFT_SIZE) / sampleRate);
    const voiceMaxBin = Math.ceil((VOICE_MAX_FREQ * FFT_SIZE) / sampleRate);

    // Find peak in fire alarm range (3000-4000 Hz)
    let alarmPeak = 0;
    let alarmPeakBin = alarmMinBin;
    for (let i = alarmMinBin; i <= alarmMaxBin && i < frequencyData.length; i++) {
      if (frequencyData[i] > alarmPeak) {
        alarmPeak = frequencyData[i];
        alarmPeakBin = i;
      }
    }
    
    // Find peak in voice range (0-2500 Hz)
    let voicePeak = 0;
    for (let i = 0; i <= voiceMaxBin && i < frequencyData.length; i++) {
      if (frequencyData[i] > voicePeak) {
        voicePeak = frequencyData[i];
      }
    }

    const alarmFreq = (alarmPeakBin * sampleRate) / FFT_SIZE;
    
    // Detection criteria:
    // 1. Alarm frequency range is loud enough
    // 2. Alarm range is significantly louder than voice range (filters out speech)
    const isLoudEnough = alarmPeak >= MIN_AMPLITUDE;
    const dominatesVoice = voicePeak === 0 || alarmPeak >= voicePeak * VOICE_RATIO_THRESHOLD;
    const isValid = isLoudEnough && dominatesVoice;

    // Debug log
    if (alarmPeak > 40 || voicePeak > 40) {
      console.log("🎤", {
        alarm: alarmPeak,
        voice: voicePeak,
        ratio: voicePeak > 0 ? (alarmPeak / voicePeak).toFixed(1) : "∞",
        valid: isValid,
        count: detectionCountRef.current,
      });
    }

    if (isValid) {
      missCountRef.current = 0;
      
      if (!wasDetectingRef.current) {
        wasDetectingRef.current = true;
        onDetectionStartRef.current?.();
        console.log("🔊 Fire alarm pattern detected at", Math.round(alarmFreq), "Hz");
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

      if (isConfirmed && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        cooldownEndRef.current = now + COOLDOWN_DURATION_MS;
        
        console.log("🔥 FIRE ALARM CONFIRMED!", { freq: Math.round(alarmFreq), amplitude: alarmPeak });
        onFireAlarmDetectedRef.current();
        
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

  const startListening = useCallback(async () => {
    if (!enabledRef.current) return;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

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

      console.log("✅ Listening for fire alarms (3000-4000 Hz)");

      setState({
        isListening: true,
        error: null,
        permissionDenied: false,
        detectionStatus: "idle",
        detectionProgress: 0,
        cooldownRemaining: 0,
      });

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
