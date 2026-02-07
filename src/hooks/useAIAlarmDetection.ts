import { useState, useEffect, useRef, useCallback } from "react";
import { AudioClassifier, FilesetResolver, AudioClassifierResult } from "@mediapipe/tasks-audio";

export interface UseAIAlarmDetectionOptions {
  onClassificationResult: (result: AudioClassifierResult) => void;
}

export interface UseAIAlarmDetectionReturn {
  isInitializing: boolean;
  error: string | null;
  isClassifierReady: boolean;
  startDetection: (audioContext: AudioContext, analyserNode: AnalyserNode) => void;
  stopDetection: () => void;
}

export const useAIAlarmDetection = ({
  onClassificationResult,
}: UseAIAlarmDetectionOptions): UseAIAlarmDetectionReturn => {
  const [classifier, setClassifier] = useState<AudioClassifier | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isRunningRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const onClassificationResultRef = useRef(onClassificationResult);

  // Keep callback ref updated synchronously
  onClassificationResultRef.current = onClassificationResult;

  // Initialize the AudioClassifier on mount
  useEffect(() => {
    let isMounted = true;

    const initializeClassifier = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // Load the WASM fileset for audio tasks
        const audio = await FilesetResolver.forAudioTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio/wasm"
        );

        // Create the AudioClassifier with YAMNet model
        const audioClassifier = await AudioClassifier.createFromOptions(audio, {
          baseOptions: {
            modelAssetPath:
              "https://tfhub.dev/google/lite-model/yamnet/classification/tflite/1?lite-format=tflite",
          },
          maxResults: 3,
        });

        if (isMounted) {
          setClassifier(audioClassifier);
          setIsInitializing(false);
          console.log("[AI Alarm Detection] AudioClassifier initialized successfully");
        }
      } catch (err) {
        console.error("[AI Alarm Detection] Failed to initialize classifier:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to initialize AI classifier");
          setIsInitializing(false);
        }
      }
    };

    initializeClassifier();

    return () => {
      isMounted = false;
      if (classifier) {
        classifier.close();
      }
    };
  }, []);

  // Start the detection loop
  const startDetection = useCallback(
    (audioContext: AudioContext, analyserNode: AnalyserNode) => {
      if (!classifier) {
        console.warn("[AI Alarm Detection] Cannot start detection - classifier not ready");
        return;
      }

      if (isRunningRef.current) {
        console.warn("[AI Alarm Detection] Detection already running");
        return;
      }

      isRunningRef.current = true;
      console.log("[AI Alarm Detection] Starting detection loop");

      const sampleRate = audioContext.sampleRate;
      const bufferLength = analyserNode.fftSize;
      const audioBuffer = new Float32Array(bufferLength);

      const runDetectionLoop = () => {
        if (!isRunningRef.current || !classifier) {
          return;
        }

        // Get time-domain audio data from the analyser
        analyserNode.getFloatTimeDomainData(audioBuffer);

        try {
          // Classify the audio data - returns an array of results
          const results = classifier.classify(audioBuffer, sampleRate);

          // Pass the first result to the callback (most recent classification)
          if (results && results.length > 0 && onClassificationResultRef.current) {
            onClassificationResultRef.current(results[0]);
          }
        } catch (err) {
          console.error("[AI Alarm Detection] Classification error:", err);
        }

        // Continue the detection loop
        animationFrameRef.current = requestAnimationFrame(runDetectionLoop);
      };

      // Start the recursive loop
      runDetectionLoop();
    },
    [classifier]
  );

  // Stop the detection loop
  const stopDetection = useCallback(() => {
    isRunningRef.current = false;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    console.log("[AI Alarm Detection] Detection stopped");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    isInitializing,
    error,
    isClassifierReady: classifier !== null,
    startDetection,
    stopDetection,
  };
};
