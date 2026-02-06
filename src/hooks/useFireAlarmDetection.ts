import { useState, useRef, useCallback, useEffect } from "react";

export type DetectionStatus = "idle" | "detecting" | "confirmed" | "cooldown";
export type AudioEngineStatus = "running" | "suspended" | "stopped";

export interface FireAlarmDetectionState {
  isListening: boolean;
  error: string | null;
  permissionDenied: boolean;
  detectionStatus: DetectionStatus;
  detectionProgress: number;
  cooldownRemaining: number;
  audioEngineStatus: AudioEngineStatus;
}

interface UseFireAlarmDetectionOptions {
  onFireAlarmDetected: () => void;
  onDetectionStart?: () => void;
  enabled?: boolean;
}

const FFT_SIZE = 2048;
const ANALYSIS_INTERVAL_MS = 50; // Send data to worker every 50ms

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
    audioEngineStatus: "stopped",
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const analysisIntervalRef = useRef<number | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasTriggeredRef = useRef<boolean>(false);

  // Store callbacks in refs for stable references
  const onFireAlarmDetectedRef = useRef(onFireAlarmDetected);
  const onDetectionStartRef = useRef(onDetectionStart);
  onFireAlarmDetectedRef.current = onFireAlarmDetected;
  onDetectionStartRef.current = onDetectionStart;

  // Update audio engine status
  const updateEngineStatus = useCallback(() => {
    if (!audioContextRef.current) {
      setState(prev => ({ ...prev, audioEngineStatus: "stopped" }));
      return;
    }
    const status: AudioEngineStatus = 
      audioContextRef.current.state === "running" ? "running" : 
      audioContextRef.current.state === "suspended" ? "suspended" : "stopped";
    setState(prev => ({ ...prev, audioEngineStatus: status }));
  }, []);

  // Create silent audio loop to prevent browser from cutting audio
  const startSilentLoop = useCallback(() => {
    if (silentAudioRef.current) return;

    // Create a very short silent audio element
    const audio = new Audio();
    // Use a data URI for a tiny silent MP3
    audio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZKQxP+AAAAAAAAAAAAAAAAAAAAAP/7UGQAD/AAADSAAAAAIAAANIAAAAQAAABpAAAACAAADSAAAAEASW9uZSBhdWRpbyBmaWxlLg==";
    audio.loop = true;
    audio.volume = 0.001; // Nearly silent
    audio.play().catch(() => {
      // Autoplay may be blocked, that's okay
      console.log("Silent audio autoplay blocked - will play on user interaction");
    });
    silentAudioRef.current = audio;
  }, []);

  const stopSilentLoop = useCallback(() => {
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
      silentAudioRef.current.src = "";
      silentAudioRef.current = null;
    }
  }, []);

  // Initialize Web Worker
  const initWorker = useCallback(() => {
    if (workerRef.current) return;

    try {
      // Create worker from the worker file
      const worker = new Worker(
        new URL("../workers/audioAnalyzer.worker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event) => {
        const { type, status, progress, cooldownRemaining } = event.data;

        switch (type) {
          case "fire_detected":
            if (!hasTriggeredRef.current) {
              hasTriggeredRef.current = true;
              onFireAlarmDetectedRef.current();
              // Reset trigger flag after cooldown starts
              setTimeout(() => {
                hasTriggeredRef.current = false;
              }, 5000);
            }
            break;

          case "detection_start":
            onDetectionStartRef.current?.();
            break;

          case "status":
            setState(prev => ({
              ...prev,
              detectionStatus: status,
              detectionProgress: progress,
              cooldownRemaining: cooldownRemaining,
            }));
            break;

          case "ready":
            console.log("Audio analysis worker ready");
            break;

          case "pong":
            // Worker is alive
            break;
        }
      };

      worker.onerror = (error) => {
        console.error("Worker error:", error);
      };

      workerRef.current = worker;
    } catch (error) {
      console.error("Failed to create worker:", error);
    }
  }, []);

  // Send frequency data to worker
  const sendDataToWorker = useCallback(() => {
    if (!analyserRef.current || !workerRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(frequencyData);

    // Send to worker (transfer buffer for efficiency)
    workerRef.current.postMessage(
      { type: "analyze", data: frequencyData.buffer },
      [frequencyData.buffer]
    );
  }, []);

  // Resume AudioContext if suspended
  const resumeAudioContext = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      console.log("Resuming suspended AudioContext...");
      try {
        await audioContextRef.current.resume();
        console.log("AudioContext resumed successfully");
        updateEngineStatus();
      } catch (error) {
        console.error("Failed to resume AudioContext:", error);
      }
    }
  }, [updateEngineStatus]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!enabled) return;

    try {
      // Initialize worker first
      initWorker();

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Handle AudioContext state changes
      audioContext.onstatechange = () => {
        console.log("AudioContext state changed to:", audioContext.state);
        updateEngineStatus();
        
        // Auto-resume if suspended
        if (audioContext.state === "suspended" && enabled) {
          console.log("AudioContext suspended, attempting to resume...");
          audioContext.resume();
        }
      };

      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      // Start silent loop to prevent browser from cutting audio
      startSilentLoop();

      setState({
        isListening: true,
        error: null,
        permissionDenied: false,
        detectionStatus: "idle",
        detectionProgress: 0,
        cooldownRemaining: 0,
        audioEngineStatus: audioContext.state === "running" ? "running" : "suspended",
      });

      // Start sending data to worker at regular intervals
      // This is more reliable than requestAnimationFrame for background tabs
      analysisIntervalRef.current = window.setInterval(sendDataToWorker, ANALYSIS_INTERVAL_MS);

      console.log("Fire alarm detection started");
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
          audioEngineStatus: "stopped",
        });
      } else if (error.name === "NotFoundError") {
        setState({
          isListening: false,
          error: "No microphone detected",
          permissionDenied: false,
          detectionStatus: "idle",
          detectionProgress: 0,
          cooldownRemaining: 0,
          audioEngineStatus: "stopped",
        });
      } else {
        setState({
          isListening: false,
          error: "Could not access microphone",
          permissionDenied: false,
          detectionStatus: "idle",
          detectionProgress: 0,
          cooldownRemaining: 0,
          audioEngineStatus: "stopped",
        });
      }
    }
  }, [enabled, initWorker, sendDataToWorker, startSilentLoop, updateEngineStatus]);

  // Stop listening
  const stopListening = useCallback(() => {
    // Stop analysis interval
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    // Stop silent loop
    stopSilentLoop();

    // Cleanup audio resources
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    hasTriggeredRef.current = false;

    setState((prev) => ({
      ...prev,
      isListening: false,
      audioEngineStatus: "stopped",
    }));

    console.log("Fire alarm detection stopped");
  }, [stopSilentLoop]);

  // Reset cooldown
  const resetCooldown = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "reset_cooldown" });
    }
    hasTriggeredRef.current = false;
    setState((prev) => ({
      ...prev,
      detectionStatus: "idle",
      detectionProgress: 0,
      cooldownRemaining: 0,
    }));
  }, []);

  // Handle visibility change - resume AudioContext and re-request permissions if needed
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log("Tab visible, checking AudioContext...");
        await resumeAudioContext();
        
        // Also try to play silent audio to keep things active
        if (silentAudioRef.current && silentAudioRef.current.paused) {
          silentAudioRef.current.play().catch(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [resumeAudioContext]);

  // Periodically check and resume AudioContext (safety net)
  useEffect(() => {
    if (!enabled) return;

    const checkInterval = setInterval(() => {
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        console.log("Periodic check: AudioContext suspended, resuming...");
        audioContextRef.current.resume();
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, [enabled]);

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

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    resetCooldown,
    resumeAudioContext,
  };
};
