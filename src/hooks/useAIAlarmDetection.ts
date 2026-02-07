import { useState, useEffect, useRef, useCallback } from "react";

export type AIClassificationResult = {
  categoryName: string;
  score: number;
} | null;

export type AIDetectionStatus =
  | "initializing"
  | "idle"
  | "detecting"
  | "error"
  | "permission_denied";

interface UseAIAlarmDetectionProps {
  enabled: boolean;
}

// YAMNet model path from TensorFlow Hub
const YAMNET_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite";

// WASM files for MediaPipe audio tasks
const WASM_BASE_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.32/wasm";

export const useAIAlarmDetection = ({ enabled }: UseAIAlarmDetectionProps) => {
  const [classifier, setClassifier] = useState<any>(null);
  const [status, setStatus] = useState<AIDetectionStatus>("initializing");
  const [lastClassification, setLastClassification] = useState<AIClassificationResult>(null);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);

  // Initialize classifier
  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    const initializeClassifier = async () => {
      try {
        setStatus("initializing");
        setError(null);

        // Dynamically import the module to handle the export issue
        const tasksAudio = await import("@mediapipe/tasks-audio");
        
        // Check if FilesetResolver exists, otherwise create WasmFileset manually
        let wasmFileset;
        if (tasksAudio.FilesetResolver) {
          wasmFileset = await tasksAudio.FilesetResolver.forAudioTasks(WASM_BASE_PATH);
        } else {
          // Manually create WasmFileset when FilesetResolver is not available
          const isSimd = await checkSimdSupport();
          wasmFileset = {
            wasmLoaderPath: `${WASM_BASE_PATH}/audio_wasm_internal.js`,
            wasmBinaryPath: isSimd 
              ? `${WASM_BASE_PATH}/audio_wasm_internal.wasm`
              : `${WASM_BASE_PATH}/audio_wasm_nosimd_internal.wasm`,
          };
        }

        const audioClassifier = await tasksAudio.AudioClassifier.createFromOptions(wasmFileset, {
          baseOptions: {
            modelAssetPath: YAMNET_MODEL_URL,
          },
          maxResults: 5,
        });

        setClassifier(audioClassifier);
        setStatus("idle");
        console.log("AI Audio Classifier initialized successfully");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize audio classifier";
        console.error("AI Alarm Detection initialization error:", err);
        setError(errorMessage);
        setStatus("error");
      }
    };

    initializeClassifier();

    return () => {
      // Cleanup on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled]);

  // Start audio processing when classifier is ready
  useEffect(() => {
    if (!classifier || !enabled || status !== "idle") return;

    const startAudioProcessing = async () => {
      try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        mediaStreamRef.current = stream;

        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        // Create analyser node
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        // Connect media stream to analyser
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        setStatus("detecting");
        isProcessingRef.current = true;

        // Start processing loop
        processAudio();
      } catch (err) {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setError("Microphone permission denied");
          setStatus("permission_denied");
        } else {
          const errorMessage = err instanceof Error ? err.message : "Failed to start audio processing";
          setError(errorMessage);
          setStatus("error");
        }
        console.error("Audio processing error:", err);
      }
    };

    const processAudio = () => {
      if (!isProcessingRef.current || !analyserRef.current || !classifier) {
        return;
      }

      const analyser = analyserRef.current;
      const bufferLength = analyser.fftSize;
      const audioData = new Float32Array(bufferLength);
      analyser.getFloatTimeDomainData(audioData);

      try {
        // Classify the audio data
        const sampleRate = audioContextRef.current?.sampleRate || 48000;
        const results = classifier.classify(audioData, sampleRate);

        if (results && results.length > 0 && results[0].classifications?.length > 0) {
          const topCategory = results[0].classifications[0].categories[0];
          if (topCategory && topCategory.score > 0.1) {
            setLastClassification({
              categoryName: topCategory.categoryName,
              score: topCategory.score,
            });
          }
        }
      } catch (classifyError) {
        // Silently handle classification errors during streaming
        console.debug("Classification error:", classifyError);
      }

      // Continue processing
      animationFrameRef.current = requestAnimationFrame(processAudio);
    };

    startAudioProcessing();

    return () => {
      // Stop audio processing
      isProcessingRef.current = false;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      analyserRef.current = null;
    };
  }, [classifier, enabled, status]);

  return {
    status,
    lastClassification,
    error,
  };
};

// Helper function to check SIMD support
async function checkSimdSupport(): Promise<boolean> {
  try {
    // Feature detection for WebAssembly SIMD
    const simdTest = new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
    ]);
    await WebAssembly.instantiate(simdTest);
    return true;
  } catch {
    return false;
  }
}
