// Web Worker for fire alarm frequency analysis
// This runs in a separate thread and won't be throttled when the tab is hidden

const MIN_FREQUENCY = 3000;
const MAX_FREQUENCY = 4000;
const AMPLITUDE_THRESHOLD = 140;
const FFT_SIZE = 2048;
const SAMPLE_RATE = 44100;
const DETECTION_DURATION_MS = 500;
const MIN_PEAK_COUNT = 2;

interface AnalysisState {
  detectionStartTime: number | null;
  lastPeakTime: number | null;
  peakCount: number;
  cooldownUntil: number;
}

const state: AnalysisState = {
  detectionStartTime: null,
  lastPeakTime: null,
  peakCount: 0,
  cooldownUntil: 0,
};

// Calculate frequency bin index for a given frequency
function getFrequencyBinIndex(frequency: number, sampleRate: number, fftSize: number): number {
  return Math.round((frequency * fftSize) / sampleRate);
}

// Check if dominant frequency is in fire alarm range
function analyzeFrequencyData(frequencyData: Uint8Array): {
  detected: boolean;
  amplitude: number;
  frequency?: number;
} {
  const minBin = getFrequencyBinIndex(MIN_FREQUENCY, SAMPLE_RATE, FFT_SIZE);
  const maxBin = getFrequencyBinIndex(MAX_FREQUENCY, SAMPLE_RATE, FFT_SIZE);

  // Get max amplitude in fire alarm frequency range
  let maxAmplitude = 0;
  let maxBinIndex = minBin;
  for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
    if (frequencyData[i] > maxAmplitude) {
      maxAmplitude = frequencyData[i];
      maxBinIndex = i;
    }
  }

  // Check if amplitude exceeds threshold
  if (maxAmplitude < AMPLITUDE_THRESHOLD) {
    return { detected: false, amplitude: maxAmplitude };
  }

  // Check if this is the dominant frequency (not just background noise)
  let outsideSum = 0;
  let outsideCount = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    if (i < minBin || i > maxBin) {
      outsideSum += frequencyData[i];
      outsideCount++;
    }
  }
  const outsideAverage = outsideCount > 0 ? outsideSum / outsideCount : 0;
  const isSignificantlyLouder = maxAmplitude > outsideAverage * 2;

  return {
    detected: isSignificantlyLouder,
    amplitude: maxAmplitude,
    frequency: (maxBinIndex * SAMPLE_RATE) / FFT_SIZE,
  };
}

// Process incoming frequency data
function processAudioData(frequencyData: Uint8Array): void {
  const now = Date.now();

  // Check cooldown
  if (state.cooldownUntil > now) {
    const remaining = Math.ceil((state.cooldownUntil - now) / 1000);
    self.postMessage({
      type: "status",
      status: "cooldown",
      cooldownRemaining: remaining,
      progress: 0,
    });
    return;
  }

  const result = analyzeFrequencyData(frequencyData);

  if (result.detected) {
    // Track beeping pattern
    if (state.lastPeakTime) {
      const timeSinceLastPeak = now - state.lastPeakTime;
      // Check if this matches beeping pattern (250-350ms intervals)
      if (timeSinceLastPeak >= 200 && timeSinceLastPeak <= 400) {
        state.peakCount++;
      } else if (timeSinceLastPeak > 500) {
        // Reset if too much time passed
        state.peakCount = 1;
        state.detectionStartTime = now;
      }
    } else {
      state.detectionStartTime = now;
      state.peakCount = 1;
      // Notify detection started
      self.postMessage({ type: "detection_start" });
    }
    state.lastPeakTime = now;

    // Check if detection criteria met
    if (state.detectionStartTime) {
      const detectionDuration = now - state.detectionStartTime;
      const progress = Math.min(100, (detectionDuration / DETECTION_DURATION_MS) * 100);

      self.postMessage({
        type: "status",
        status: progress >= 100 ? "confirmed" : "detecting",
        progress,
        cooldownRemaining: 0,
      });

      // FAST: Only need 0.5 seconds of detection with 2+ beeps
      if (detectionDuration >= DETECTION_DURATION_MS && state.peakCount >= MIN_PEAK_COUNT) {
        // Fire alarm confirmed!
        self.postMessage({ type: "fire_detected" });
        
        // Set cooldown (30 seconds)
        state.cooldownUntil = now + 30000;
        
        // Reset detection state after short delay
        setTimeout(() => {
          state.peakCount = 0;
          state.detectionStartTime = null;
          state.lastPeakTime = null;
        }, 5000);
      }
    }
  } else {
    // Reset if no detection for a while
    if (state.lastPeakTime && now - state.lastPeakTime > 1000) {
      state.peakCount = 0;
      state.detectionStartTime = null;
      state.lastPeakTime = null;
      self.postMessage({
        type: "status",
        status: "idle",
        progress: 0,
        cooldownRemaining: 0,
      });
    }
  }
}

// Handle messages from main thread
self.onmessage = (event) => {
  const { type, data } = event.data;

  switch (type) {
    case "analyze":
      // Convert ArrayBuffer back to Uint8Array
      const frequencyData = new Uint8Array(data);
      processAudioData(frequencyData);
      break;

    case "reset_cooldown":
      state.cooldownUntil = 0;
      state.peakCount = 0;
      state.detectionStartTime = null;
      state.lastPeakTime = null;
      self.postMessage({
        type: "status",
        status: "idle",
        progress: 0,
        cooldownRemaining: 0,
      });
      break;

    case "ping":
      // Heartbeat to confirm worker is alive
      self.postMessage({ type: "pong" });
      break;
  }
};

// Signal that worker is ready
self.postMessage({ type: "ready" });
