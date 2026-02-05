import { useState, useCallback } from "react";

export type EmergencyType = "fire" | "earthquake" | "flood";
export type DisabilityType = "deaf" | "blind" | "nonverbal" | "mobility" | "cognitive";

export interface AlertConfig {
  showVisual: boolean;
  showAudio: boolean;
  showCognitive: boolean;
  showDeafBlind: boolean;
  vibrationPattern: number[];
  extraMessage?: string;
  voiceRate?: number;
}

export interface PersonalizedAlertState {
  isActive: boolean;
  emergencyType: EmergencyType | null;
  config: AlertConfig | null;
}

const VIBRATION_PATTERNS = {
  strong: [500, 200, 500, 200, 500, 200, 500], // Deaf users
  secondary: [300, 100, 300, 100, 300], // Blind users (secondary signal)
  maximum: [1000, 100, 1000, 100, 1000, 100, 1000], // Deaf + Blind
  gentle: [200, 400, 200, 400, 200], // Cognitive users
  standard: [500, 200, 500, 200, 500], // Standard
};

export const getDisabilities = (): DisabilityType[] => {
  try {
    const saved = localStorage.getItem("guardian_disabilities");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to parse disabilities:", e);
  }
  return [];
};

export const setDisabilities = (disabilities: DisabilityType[]) => {
  localStorage.setItem("guardian_disabilities", JSON.stringify(disabilities));
};

export const getAlertConfig = (disabilities: DisabilityType[]): AlertConfig => {
  const hasDeaf = disabilities.includes("deaf");
  const hasBlind = disabilities.includes("blind");
  const hasCognitive = disabilities.includes("cognitive");
  const hasMobility = disabilities.includes("mobility");
  const hasNonverbal = disabilities.includes("nonverbal");

  // Deaf AND Blind - maximum vibration only + simple text for caregiver
  if (hasDeaf && hasBlind) {
    return {
      showVisual: false,
      showAudio: false,
      showCognitive: false,
      showDeafBlind: true,
      vibrationPattern: VIBRATION_PATTERNS.maximum,
    };
  }

  // Deaf only (not blind) - visual + strong vibration, NO audio
  if (hasDeaf && !hasBlind) {
    return {
      showVisual: true,
      showAudio: false,
      showCognitive: false,
      showDeafBlind: false,
      vibrationPattern: VIBRATION_PATTERNS.strong,
    };
  }

  // Blind only (not deaf) - audio + secondary vibration, NO visual flashing
  if (hasBlind && !hasDeaf) {
    return {
      showVisual: false,
      showAudio: true,
      showCognitive: false,
      showDeafBlind: false,
      vibrationPattern: VIBRATION_PATTERNS.secondary,
    };
  }

  // Cognitive - simplified alert with slow voice
  if (hasCognitive) {
    return {
      showVisual: false,
      showAudio: false,
      showCognitive: true,
      showDeafBlind: false,
      vibrationPattern: VIBRATION_PATTERNS.gentle,
      voiceRate: 0.7,
    };
  }

  // Mobility - visual + audio + extra message
  if (hasMobility) {
    return {
      showVisual: true,
      showAudio: true,
      showCognitive: false,
      showDeafBlind: false,
      vibrationPattern: VIBRATION_PATTERNS.standard,
      extraMessage: "Stay calm. Help is on the way.",
    };
  }

  // Nonverbal (speech) - visual + audio (911 call feature for later)
  if (hasNonverbal) {
    return {
      showVisual: true,
      showAudio: true,
      showCognitive: false,
      showDeafBlind: false,
      vibrationPattern: VIBRATION_PATTERNS.standard,
    };
  }

  // Default - both visual and audio
  return {
    showVisual: true,
    showAudio: true,
    showCognitive: false,
    showDeafBlind: false,
    vibrationPattern: VIBRATION_PATTERNS.standard,
  };
};

export const triggerVibration = (pattern: number[]) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const stopVibration = () => {
  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
};

export const usePersonalizedAlert = () => {
  const [alertState, setAlertState] = useState<PersonalizedAlertState>({
    isActive: false,
    emergencyType: null,
    config: null,
  });

  const triggerPersonalizedAlert = useCallback((emergencyType: EmergencyType) => {
    const disabilities = getDisabilities();
    const config = getAlertConfig(disabilities);

    // Start vibration immediately
    triggerVibration(config.vibrationPattern);

    setAlertState({
      isActive: true,
      emergencyType,
      config,
    });
  }, []);

  const dismissAlert = useCallback(() => {
    stopVibration();
    setAlertState({
      isActive: false,
      emergencyType: null,
      config: null,
    });
  }, []);

  return {
    alertState,
    triggerPersonalizedAlert,
    dismissAlert,
  };
};
