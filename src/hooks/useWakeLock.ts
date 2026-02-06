import { useState, useRef, useCallback, useEffect } from "react";

export interface WakeLockState {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
}

interface UseWakeLockOptions {
  enabled?: boolean;
}

export const useWakeLock = ({ enabled = true }: UseWakeLockOptions = {}) => {
  const [state, setState] = useState<WakeLockState>({
    isSupported: typeof navigator !== "undefined" && "wakeLock" in navigator,
    isActive: false,
    error: null,
  });

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) {
      setState(prev => ({
        ...prev,
        isSupported: false,
        error: "Wake Lock API not supported",
      }));
      return false;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      
      wakeLockRef.current.addEventListener("release", () => {
        console.log("Wake Lock was released");
        setState(prev => ({ ...prev, isActive: false }));
      });

      setState(prev => ({
        ...prev,
        isActive: true,
        error: null,
      }));

      console.log("Wake Lock acquired");
      return true;
    } catch (error: any) {
      console.error("Wake Lock request failed:", error);
      setState(prev => ({
        ...prev,
        isActive: false,
        error: error.message || "Failed to acquire wake lock",
      }));
      return false;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setState(prev => ({ ...prev, isActive: false }));
        console.log("Wake Lock released");
      } catch (error: any) {
        console.error("Failed to release wake lock:", error);
      }
    }
  }, []);

  // Handle visibility change - re-request wake lock when tab becomes visible
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        console.log("Tab visible, re-requesting wake lock");
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, requestWakeLock]);

  // Auto-request wake lock when enabled
  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  return {
    ...state,
    requestWakeLock,
    releaseWakeLock,
  };
};
