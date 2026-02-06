import { useRef, useCallback, useEffect } from "react";

const TITLE_MESSAGES = [
  "🚨 FIRE ALERT! 🚨",
  "⚠️ CHECK APP NOW ⚠️",
];

const BLINK_INTERVAL_MS = 500;

export const useEmergencyTitleBlink = () => {
  const originalTitleRef = useRef<string>(document.title);
  const intervalRef = useRef<number | null>(null);
  const isBlinkingRef = useRef(false);
  const currentIndexRef = useRef(0);

  const startBlinking = useCallback(() => {
    if (isBlinkingRef.current) return;
    
    // Store original title
    originalTitleRef.current = document.title;
    isBlinkingRef.current = true;
    currentIndexRef.current = 0;

    // Start blinking
    intervalRef.current = window.setInterval(() => {
      document.title = TITLE_MESSAGES[currentIndexRef.current];
      currentIndexRef.current = (currentIndexRef.current + 1) % TITLE_MESSAGES.length;
    }, BLINK_INTERVAL_MS);

    // Set initial title immediately
    document.title = TITLE_MESSAGES[0];

    console.log("Title blinking started");
  }, []);

  const stopBlinking = useCallback(() => {
    if (!isBlinkingRef.current) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Restore original title
    document.title = originalTitleRef.current;
    isBlinkingRef.current = false;

    console.log("Title blinking stopped");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        document.title = originalTitleRef.current;
      }
    };
  }, []);

  return {
    startBlinking,
    stopBlinking,
    isBlinking: () => isBlinkingRef.current,
  };
};
