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

// Helper function to check SIMD support
async function checkSimdSupport(): Promise<boolean> {
  try {
    const simdTest = new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
    ]);
    await WebAssembly.instantiate(simdTest);
    return true;
  } catch {
    return false;
  }
}

export const useAIAlarmDetection = ({ enabled }: UseAIAlarmDetectionProps) => {
  // All hooks must be called unconditionally at the top
  const [status, setStatus] = useState<AIDetectionStatus>("initializing");
  const [lastClassification, setLastClassification] = useState<AIClassificationResult>(null);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isProcessingRef = useRef(false);
  const classifierRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  // Cleanup function
  const stopAudioProcessing = useCallback(() => {
    console.log("[AI Detection] Stopping audio processing...");
    isProcessingRef.current = false;
    
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Ignore close errors
      }
      audioContextRef.current = null;
    }
  }, []);

  // Initialize classifier and start audio processing
  useEffect(() => {
    if (!enabled) {
      stopAudioProcessing();
      setStatus("idle");
      return;
    }

    // Prevent double initialization
    if (isInitializedRef.current) {
      return;
    }

    let isMounted = true;

    const initializeAndStart = async () => {
      try {
        setStatus("initializing");
        setError(null);
        isInitializedRef.current = true;

        console.log("[AI Detection] Initializing classifier...");

        // Dynamically import the module
        const tasksAudio = await import("@mediapipe/tasks-audio");
        
        if (!isMounted) return;

        // Check if FilesetResolver exists, otherwise create WasmFileset manually
        let wasmFileset;
        if (tasksAudio.FilesetResolver) {
          wasmFileset = await tasksAudio.FilesetResolver.forAudioTasks(WASM_BASE_PATH);
        } else {
          const isSimd = await checkSimdSupport();
          wasmFileset = {
            wasmLoaderPath: `${WASM_BASE_PATH}/audio_wasm_internal.js`,
            wasmBinaryPath: isSimd 
              ? `${WASM_BASE_PATH}/audio_wasm_internal.wasm`
              : `${WASM_BASE_PATH}/audio_wasm_nosimd_internal.wasm`,
          };
        }

        if (!isMounted) return;

        const audioClassifier = await tasksAudio.AudioClassifier.createFromOptions(wasmFileset, {
          baseOptions: {
            modelAssetPath: YAMNET_MODEL_URL,
          },
          maxResults: 5,
        });

        if (!isMounted) {
          audioClassifier.close?.();
          return;
        }

        classifierRef.current = audioClassifier;
        console.log("[AI Detection] Classifier initialized successfully");

        // Start audio processing
        await startAudioProcessing();
      } catch (err) {
        if (!isMounted) return;
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize audio classifier";
        console.error("[AI Detection] Initialization error:", err);
        setError(errorMessage);
        setStatus("error");
        isInitializedRef.current = false;
      }
    };

    const startAudioProcessing = async () => {
      try {
        console.log("[AI Detection] Requesting microphone access...");
        
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        mediaStreamRef.current = stream;
        console.log("[AI Detection] Microphone access granted");

        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
          return;
        }

        audioContextRef.current = audioContext;
        const sampleRate = audioContext.sampleRate;

        // Create source and processor
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        isProcessingRef.current = true;
        setStatus("idle");

        processor.onaudioprocess = (event) => {
          if (!isProcessingRef.current || !classifierRef.current) return;

          const inputData = event.inputBuffer.getChannelData(0);
          const audioData = new Float32Array(inputData.length);
          audioData.set(inputData);

          try {
            const results = classifierRef.current.classify(audioData, sampleRate);

            if (results && results.length > 0 && results[0].classifications?.length > 0) {
              const categories = results[0].classifications[0].categories;
              if (categories && categories.length > 0) {
                const topCategory = categories[0];
                if (topCategory && topCategory.score > 0.05) {
                  console.log(`[AI Detection] Detected: ${topCategory.categoryName} (${Math.round(topCategory.score * 100)}%)`);
                  setLastClassification({
                    categoryName: topCategory.categoryName,
                    score: topCategory.score,
                  });
                }
              }
            }
          } catch (classifyError) {
            console.debug("[AI Detection] Classification error:", classifyError);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        
        console.log("[AI Detection] Audio processing started");
      } catch (err) {
        if (!isMounted) return;
        
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          console.error("[AI Detection] Microphone permission denied");
          setError("Microphone permission denied");
          setStatus("permission_denied");
        } else {
          const errorMessage = err instanceof Error ? err.message : "Failed to start audio processing";
          console.error("[AI Detection] Audio processing error:", err);
          setError(errorMessage);
          setStatus("error");
        }
      }
    };

    initializeAndStart();

    return () => {
      isMounted = false;
      isInitializedRef.current = false;
      stopAudioProcessing();
    };
  }, [enabled, stopAudioProcessing]);

  return {
    status,
    lastClassification,
    error,
  };
};
