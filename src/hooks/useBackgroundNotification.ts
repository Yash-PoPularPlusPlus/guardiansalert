import { useState, useCallback, useEffect, useRef } from "react";

export type NotificationPermission = "default" | "granted" | "denied";

export interface BackgroundNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isBackgroundEnabled: boolean;
}

interface UseBackgroundNotificationOptions {
  onNotificationClick?: () => void;
}

export const useBackgroundNotification = ({
  onNotificationClick,
}: UseBackgroundNotificationOptions = {}) => {
  const [state, setState] = useState<BackgroundNotificationState>({
    isSupported: typeof window !== "undefined" && "Notification" in window,
    permission: typeof window !== "undefined" && "Notification" in window 
      ? (Notification.permission as NotificationPermission)
      : "default",
    isBackgroundEnabled: localStorage.getItem("guardian_background_protection") === "true",
  });

  const onNotificationClickRef = useRef(onNotificationClick);
  onNotificationClickRef.current = onNotificationClick;

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!("Notification" in window)) {
      return "denied";
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission: permission as NotificationPermission }));
      return permission as NotificationPermission;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return "denied";
    }
  }, []);

  const sendBackgroundNotification = useCallback((
    title: string,
    options?: NotificationOptions
  ): Notification | null => {
    if (!("Notification" in window)) {
      console.log("Notifications not supported");
      return null;
    }

    if (Notification.permission !== "granted") {
      console.log("Notification permission not granted");
      return null;
    }

    try {
      const notification = new Notification(title, {
        ...options,
        requireInteraction: true, // Keep notification until user interacts
        tag: "emergency-alert", // Replace previous notifications with same tag
        renotify: true, // Vibrate device again even if replacing existing notification
        silent: false, // Allow system notification sound
      });

      notification.onclick = function(event) {
        // Prevent the browser from focusing the notification's origin
        event.preventDefault();
        
        // Aggressively focus the window using multiple methods
        window.focus();
        
        if (typeof window.focus === 'function') {
          window.focus();
        }
        
        // For some browsers, we need to also try focusing the parent
        if (window.parent && typeof window.parent.focus === 'function') {
          window.parent.focus();
        }
        
        // Try parent.focus() directly
        try {
          // @ts-ignore
          parent.focus();
        } catch (e) {
          // Ignore errors
        }
        
        notification.close();
        onNotificationClickRef.current?.();
      };

      return notification;
    } catch (error) {
      console.error("Failed to send notification:", error);
      return null;
    }
  }, []);

  const sendEmergencyNotification = useCallback((emergencyType: string) => {
    // Only send if tab is hidden or not focused
    if (document.visibilityState !== "hidden" && document.hasFocus()) {
      return null;
    }
    
    return sendBackgroundNotification(
      "🚨 FIRE ALARM DETECTED!",
      {
        body: `Emergency detected. Click to open Guardian Alert immediately.`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        silent: false,
      }
    );
  }, [sendBackgroundNotification]);

  const setBackgroundEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem("guardian_background_protection", enabled ? "true" : "false");
    setState(prev => ({ ...prev, isBackgroundEnabled: enabled }));
  }, []);

  // Check permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setState(prev => ({
        ...prev,
        permission: Notification.permission as NotificationPermission,
      }));
    }
  }, []);

  return {
    ...state,
    requestPermission,
    sendBackgroundNotification,
    sendEmergencyNotification,
    setBackgroundEnabled,
  };
};

// Play a loud wake-up sound that works even in background tabs
export const playWakeUpSound = async () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Resume if suspended (important for background playback)
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Loud, attention-grabbing pattern
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);

    // Quick frequency changes for urgent sound
    const duration = 2;
    for (let i = 0; i < 10; i++) {
      const time = audioContext.currentTime + (i * duration / 10);
      oscillator.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, time);
    }

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);

    // Cleanup after sound completes
    setTimeout(() => {
      audioContext.close();
    }, (duration + 0.5) * 1000);

    return true;
  } catch (error) {
    console.error("Failed to play wake-up sound:", error);
    return false;
  }
};
