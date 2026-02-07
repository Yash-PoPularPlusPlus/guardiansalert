import { useState, useEffect, useRef } from "react";

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
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isProcessingRef = useRef(false);
  const classifierRef = useRef<any>(null);

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

        console.log("[AI Detection] Initializing classifier...");

        // Dynamically import the module
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
        classifierRef.current = audioClassifier;
        console.log("[AI Detection] Classifier initialized successfully");
        
        // Start audio processing immediately after initialization
        startAudioProcessing(audioClassifier);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize audio classifier";
        console.error("[AI Detection] Initialization error:", err);
        setError(errorMessage);
        setStatus("error");
      }
    };

    initializeClassifier();

    return () => {
      stopAudioProcessing();
    };
  }, [enabled]);

  const startAudioProcessing = async (audioClassifier: any) => {
    try {
      console.log("[AI Detection] Requesting microphone access...");
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;
      console.log("[AI Detection] Microphone access granted");

      // Create audio context with 16kHz sample rate (YAMNet expects 16kHz)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;

      // Create source and processor
      const source = audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode for audio processing (4096 samples at 16kHz = ~256ms chunks)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      isProcessingRef.current = true;
      setStatus("idle");

      processor.onaudioprocess = (event) => {
        if (!isProcessingRef.current || !classifierRef.current) return;

        const inputData = event.inputBuffer.getChannelData(0);
        
        // Create a copy of the audio data
        const audioData = new Float32Array(inputData.length);
        audioData.set(inputData);

        try {
          // Classify the audio data
          const sampleRate = audioContext.sampleRate;
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
          // Silently handle classification errors during streaming
          console.debug("[AI Detection] Classification error:", classifyError);
        }
      };

      // Connect the audio graph
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      console.log("[AI Detection] Audio processing started");
    } catch (err) {
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

  const stopAudioProcessing = () => {
    console.log("[AI Detection] Stopping audio processing...");
    isProcessingRef.current = false;
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

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
