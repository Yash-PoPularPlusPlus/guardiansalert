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

// Fire alarm frequency range (Hz) - high-pitched beeping
const MIN_FREQUENCY = 2800;
const MAX_FREQUENCY = 4200;

// Human voice range to IGNORE (Hz)
const VOICE_MAX_FREQUENCY = 2500;

// Amplitude thresholds
const MIN_AMPLITUDE = 120; // Minimum to consider (out of 255)
const MAX_AMPLITUDE = 220; // Maximum reasonable for fire alarm

// Fire alarm pattern characteristics
const BEEP_DURATION_MIN = 300; // ms - minimum beep duration
const BEEP_DURATION_MAX = 800; // ms - maximum beep duration  
const GAP_DURATION_MIN = 200; // ms - minimum gap between beeps
const GAP_DURATION_MAX = 800; // ms - maximum gap between beeps
const REQUIRED_BEEP_COUNT = 3; // Need at least 3 beeps to confirm
const DETECTION_WINDOW_MS = 4000; // Analyze over 4 seconds
const FREQUENCY_CONSISTENCY_THRESHOLD = 0.7; // 70% of samples must be in fire alarm range

// Technical constants
const FFT_SIZE = 2048;
const SAMPLE_RATE = 44100;
const ANALYSIS_INTERVAL_MS = 50; // Analyze every 50ms
const COOLDOWN_DURATION_MS = 30000; // 30 second cooldown

interface BeepEvent {
  startTime: number;
  endTime: number | null;
  frequency: number;
  amplitude: number;
}

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
  
  // Pattern detection state
  const beepHistoryRef = useRef<BeepEvent[]>([]);
  const currentBeepRef = useRef<BeepEvent | null>(null);
  const frequencySamplesRef = useRef<number[]>([]);
  const detectionStartTimeRef = useRef<number | null>(null);
  const hasTriggeredRef = useRef<boolean>(false);
  const cooldownRef = useRef<number>(0);
  const wasDetectingRef = useRef<boolean>(false);
  const lastAnalysisTimeRef = useRef<number>(0);
  
  // Store callbacks in refs
  const onFireAlarmDetectedRef = useRef(onFireAlarmDetected);
  const onDetectionStartRef = useRef(onDetectionStart);
  
  onFireAlarmDetectedRef.current = onFireAlarmDetected;
  onDetectionStartRef.current = onDetectionStart;

  // Calculate frequency bin index
  const getFrequencyBinIndex = useCallback((frequency: number) => {
    return Math.round((frequency * FFT_SIZE) / SAMPLE_RATE);
  }, []);

  // Get dominant frequency and amplitude in a range
  const getDominantFrequency = useCallback((frequencyData: Uint8Array) => {
    const minBin = getFrequencyBinIndex(MIN_FREQUENCY);
    const maxBin = getFrequencyBinIndex(MAX_FREQUENCY);
    const voiceMaxBin = getFrequencyBinIndex(VOICE_MAX_FREQUENCY);

    // Get max amplitude in fire alarm frequency range
    let maxAmplitude = 0;
    let maxBinIndex = minBin;
    for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
      if (frequencyData[i] > maxAmplitude) {
        maxAmplitude = frequencyData[i];
        maxBinIndex = i;
      }
    }

    // Get max amplitude in voice range (to compare)
    let voiceMaxAmplitude = 0;
    for (let i = 0; i <= voiceMaxBin && i < frequencyData.length; i++) {
      if (frequencyData[i] > voiceMaxAmplitude) {
        voiceMaxAmplitude = frequencyData[i];
      }
    }

    // Calculate frequency from bin
    const frequency = (maxBinIndex * SAMPLE_RATE) / FFT_SIZE;

    return {
      frequency,
      amplitude: maxAmplitude,
      voiceAmplitude: voiceMaxAmplitude,
    };
  }, [getFrequencyBinIndex]);

  // Check if this is likely a fire alarm frequency (not voice)
  const isFireAlarmSignal = useCallback((frequencyData: Uint8Array) => {
    const { frequency, amplitude, voiceAmplitude } = getDominantFrequency(frequencyData);

    // Check amplitude is in valid range
    if (amplitude < MIN_AMPLITUDE || amplitude > MAX_AMPLITUDE) {
      return { isValid: false, frequency: 0, amplitude: 0, reason: "amplitude_out_of_range" };
    }

    // Check frequency is in fire alarm range
    if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
      return { isValid: false, frequency, amplitude, reason: "frequency_out_of_range" };
    }

    // CRITICAL: Fire alarm frequency must be DOMINANT over voice frequencies
    // If voice range is louder or similar, this is probably speech, not an alarm
    if (voiceAmplitude > amplitude * 0.8) {
      return { isValid: false, frequency, amplitude, reason: "voice_dominant" };
    }

    // Check that fire alarm frequency is significantly louder than average background
    let backgroundSum = 0;
    let backgroundCount = 0;
    const minBin = getFrequencyBinIndex(MIN_FREQUENCY);
    const maxBin = getFrequencyBinIndex(MAX_FREQUENCY);
    
    for (let i = 0; i < frequencyData.length; i++) {
      if (i < minBin - 20 || i > maxBin + 20) { // Exclude fire alarm range + buffer
        backgroundSum += frequencyData[i];
        backgroundCount++;
      }
    }
    const backgroundAvg = backgroundCount > 0 ? backgroundSum / backgroundCount : 0;

    // Fire alarm should be at least 3x louder than background
    if (amplitude < backgroundAvg * 3) {
      return { isValid: false, frequency, amplitude, reason: "not_prominent" };
    }

    return { isValid: true, frequency, amplitude, reason: "valid" };
  }, [getDominantFrequency, getFrequencyBinIndex]);

  // Analyze beeping pattern
  const analyzePattern = useCallback(() => {
    const now = Date.now();
    const beeps = beepHistoryRef.current;
    
    // Clean old beeps (older than detection window)
    beepHistoryRef.current = beeps.filter(b => 
      now - (b.endTime || b.startTime) < DETECTION_WINDOW_MS
    );

    // Count completed beeps with valid duration
    const completedBeeps = beepHistoryRef.current.filter(b => {
      if (!b.endTime) return false;
      const duration = b.endTime - b.startTime;
      return duration >= BEEP_DURATION_MIN && duration <= BEEP_DURATION_MAX;
    });

    if (completedBeeps.length < REQUIRED_BEEP_COUNT) {
      return { isPattern: false, beepCount: completedBeeps.length };
    }

    // Check gaps between beeps are consistent
    const gaps: number[] = [];
    for (let i = 1; i < completedBeeps.length; i++) {
      const gap = completedBeeps[i].startTime - (completedBeeps[i-1].endTime || completedBeeps[i-1].startTime);
      gaps.push(gap);
    }

    // Validate gaps are within expected range
    const validGaps = gaps.filter(g => g >= GAP_DURATION_MIN && g <= GAP_DURATION_MAX);
    if (validGaps.length < gaps.length * 0.5) { // At least 50% of gaps must be valid
      return { isPattern: false, beepCount: completedBeeps.length };
    }

    // Check frequency consistency
    const frequencies = completedBeeps.map(b => b.frequency);
    const avgFreq = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    const consistentFreqs = frequencies.filter(f => Math.abs(f - avgFreq) < 300); // Within 300Hz
    
    if (consistentFreqs.length < frequencies.length * FREQUENCY_CONSISTENCY_THRESHOLD) {
      return { isPattern: false, beepCount: completedBeeps.length };
    }

    return { isPattern: true, beepCount: completedBeeps.length };
  }, []);

  // Main analysis function - runs every 50ms
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !enabled) return;

    const now = Date.now();
    
    // Throttle analysis
    if (now - lastAnalysisTimeRef.current < ANALYSIS_INTERVAL_MS) return;
    lastAnalysisTimeRef.current = now;

    // Handle cooldown
    if (cooldownRef.current > now) {
      const remaining = Math.ceil((cooldownRef.current - now) / 1000);
      setState(prev => ({
        ...prev,
        detectionStatus: "cooldown",
        cooldownRemaining: remaining,
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

    const result = isFireAlarmSignal(frequencyData);

    if (result.isValid) {
      // Track frequency samples for consistency check
      frequencySamplesRef.current.push(result.frequency);
      if (frequencySamplesRef.current.length > 80) { // Keep last 4 seconds worth
        frequencySamplesRef.current.shift();
      }

      // Handle beep start/continuation
      if (!currentBeepRef.current) {
        // New beep starting
        currentBeepRef.current = {
          startTime: now,
          endTime: null,
          frequency: result.frequency,
          amplitude: result.amplitude,
        };
        
        if (!wasDetectingRef.current) {
          wasDetectingRef.current = true;
          detectionStartTimeRef.current = now;
          onDetectionStartRef.current?.();
        }
      } else {
        // Update ongoing beep with average frequency
        currentBeepRef.current.frequency = (currentBeepRef.current.frequency + result.frequency) / 2;
      }

      // Update detection progress
      if (detectionStartTimeRef.current) {
        const elapsed = now - detectionStartTimeRef.current;
        const progress = Math.min(100, (elapsed / DETECTION_WINDOW_MS) * 100);
        
        const patternResult = analyzePattern();
        
        setState(prev => ({
          ...prev,
          detectionStatus: patternResult.isPattern ? "confirmed" : "detecting",
          detectionProgress: progress,
        }));

        // TRIGGER: Pattern confirmed with enough beeps
        if (patternResult.isPattern && patternResult.beepCount >= REQUIRED_BEEP_COUNT) {
          if (!hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            cooldownRef.current = now + COOLDOWN_DURATION_MS;
            
            console.log("🔥 Fire alarm confirmed:", {
              beepCount: patternResult.beepCount,
              frequencies: frequencySamplesRef.current.slice(-10),
            });
            
            onFireAlarmDetectedRef.current();
            
            // Reset after trigger
            setTimeout(() => {
              hasTriggeredRef.current = false;
              beepHistoryRef.current = [];
              currentBeepRef.current = null;
              frequencySamplesRef.current = [];
              detectionStartTimeRef.current = null;
              wasDetectingRef.current = false;
            }, 5000);
          }
        }
      }
    } else {
      // Sound ended or not valid fire alarm
      if (currentBeepRef.current) {
        // End current beep
        currentBeepRef.current.endTime = now;
        beepHistoryRef.current.push(currentBeepRef.current);
        currentBeepRef.current = null;
      }

      // Reset if no valid signal for too long
      const lastBeep = beepHistoryRef.current[beepHistoryRef.current.length - 1];
      if (!lastBeep || now - (lastBeep.endTime || lastBeep.startTime) > 2000) {
        if (wasDetectingRef.current) {
          beepHistoryRef.current = [];
          frequencySamplesRef.current = [];
          detectionStartTimeRef.current = null;
          wasDetectingRef.current = false;
          
          setState(prev => ({
            ...prev,
            detectionStatus: "idle",
            detectionProgress: 0,
          }));
        }
      }
    }
  }, [enabled, isFireAlarmSignal, analyzePattern, state.detectionStatus]);

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
      analyser.smoothingTimeConstant = 0.2; // Less smoothing for faster response
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

      // Use setInterval for consistent timing (more reliable than requestAnimationFrame for audio)
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
    beepHistoryRef.current = [];
    currentBeepRef.current = null;
    frequencySamplesRef.current = [];
    detectionStartTimeRef.current = null;
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
    beepHistoryRef.current = [];
    currentBeepRef.current = null;
    frequencySamplesRef.current = [];
    detectionStartTimeRef.current = null;
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
