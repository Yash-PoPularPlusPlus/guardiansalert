import { useRef, useCallback } from "react";

// Generate a loud emergency siren using HTML5 Audio + Web Audio API
// This works in background tabs because HTML5 Audio is less throttled than pure WebAudio
const createSirenDataUri = (): string => {
  // Create a very loud, piercing siren sound using AudioContext
  // Then convert to WAV data URI for HTML5 Audio playback
  const sampleRate = 44100;
  const duration = 2; // 2 second loop
  const samples = sampleRate * duration;
  const buffer = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    // Create a sweeping siren that alternates between two frequencies
    const cycle = t % 1; // 1 second per sweep cycle
    const freq = cycle < 0.5 
      ? 800 + (cycle * 2) * 400  // Sweep up from 800 to 1200 Hz
      : 1200 - ((cycle - 0.5) * 2) * 400; // Sweep down from 1200 to 800 Hz
    
    // Generate the tone with harmonics for a more piercing sound
    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const harmonic2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.5;
    const harmonic3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.25;
    
    buffer[i] = (fundamental + harmonic2 + harmonic3) * 0.7;
  }

  // Convert to WAV
  const wavBuffer = float32ToWav(buffer, sampleRate);
  const base64 = arrayBufferToBase64(wavBuffer);
  return `data:audio/wav;base64,${base64}`;
};

const float32ToWav = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Convert float32 to int16
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const useEmergencySiren = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sirenDataUriRef = useRef<string | null>(null);

  const startSiren = useCallback(() => {
    // Generate siren data URI if not already created
    if (!sirenDataUriRef.current) {
      sirenDataUriRef.current = createSirenDataUri();
    }

    // Create new audio element if needed
    if (!audioRef.current) {
      audioRef.current = new Audio(sirenDataUriRef.current);
      audioRef.current.loop = true;
      audioRef.current.volume = 1.0;
    }

    // Play the siren
    audioRef.current.play().catch((error) => {
      console.error("Failed to play emergency siren:", error);
    });

    console.log("Emergency siren started");
  }, []);

  const stopSiren = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      console.log("Emergency siren stopped");
    }
  }, []);

  const isPlaying = useCallback(() => {
    return audioRef.current ? !audioRef.current.paused : false;
  }, []);

  return {
    startSiren,
    stopSiren,
    isPlaying,
  };
};
