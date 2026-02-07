import { useState, useEffect, useRef, useCallback } from "react";
import { AudioClassifier, FilesetResolver } from "@mediapipe/tasks-audio";

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

export const useAIAlarmDetection = ({ enabled }: UseAIAlarmDetectionProps) => {
  const [classifier, setClassifier] = useState<AudioClassifier | null>(null);
  const [status, setStatus] = useState<AIDetectionStatus>("initializing");
  const [lastClassification, setLastClassification] = useState<AIClassificationResult>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const initializeClassifier = async () => {
      try {
        setStatus("initializing");
        setError(null);

        const audio = await FilesetResolver.forAudioTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio/wasm"
        );

        const audioClassifier = await AudioClassifier.createFromOptions(audio, {
          baseOptions: {
            modelAssetPath:
              "https://tfhub.dev/google/lite-model/yamnet/classification/tflite/1?lite-format=tflite",
          },
          maxResults: 1,
        });

        setClassifier(audioClassifier);
        setStatus("idle");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize audio classifier";
        setError(errorMessage);
        setStatus("error");
        console.error("AI Alarm Detection initialization error:", err);
      }
    };

    initializeClassifier();
  }, [enabled]);

  return {
    status,
    lastClassification,
    error,
  };
};
