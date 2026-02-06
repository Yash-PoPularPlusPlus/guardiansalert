import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import VisualAlert from "@/components/VisualAlert";
import AudioAlert, { unlockAudioForEmergency } from "@/components/AudioAlert";
import CognitiveAlert from "@/components/CognitiveAlert";
import DeafBlindAlert from "@/components/DeafBlindAlert";
import AudioMonitor, { type AudioMonitorHandle } from "@/components/AudioMonitor";
import {
  usePersonalizedAlert,
  type EmergencyType,
} from "@/hooks/usePersonalizedAlert";
import { useSmsNotification } from "@/hooks/useSmsNotification";
import { addDetectionEntry } from "@/utils/detectionLog";

const Home = () => {
  const navigate = useNavigate();
  const [isComplete, setIsComplete] = useState(false);
  const { alertState, triggerPersonalizedAlert, dismissAlert } = usePersonalizedAlert();
  const { notifyEmergencyContacts, resetSmsFlag } = useSmsNotification();
  const audioMonitorRef = useRef<AudioMonitorHandle>(null);

  useEffect(() => {
    const data = localStorage.getItem("guardian_data");
    if (!data) {
      navigate("/");
      return;
    }
    
    const parsed = JSON.parse(data);
    if (parsed.onboardingComplete) {
      setIsComplete(true);
    }
  }, [navigate]);

  // Automatic fire alarm detection callback
  const handleAutoDetectedAlert = (type: EmergencyType) => {
    unlockAudioForEmergency();
    triggerPersonalizedAlert(type);
    
    addDetectionEntry(type, "automatic");
    notifyEmergencyContacts(type);
  };

  if (!isComplete) return null;

  const handleDismissAlert = () => {
    dismissAlert();
    resetSmsFlag();
    audioMonitorRef.current?.resetCooldown();
  };

  const renderAlert = () => {
    if (!alertState.isActive || !alertState.config || !alertState.emergencyType) {
      return null;
    }

    const { config, emergencyType } = alertState;

    if (config.showDeafBlind) {
      return <DeafBlindAlert emergencyType={emergencyType} onDismiss={handleDismissAlert} />;
    }

    if (config.showCognitive) {
      return <CognitiveAlert emergencyType={emergencyType} onDismiss={handleDismissAlert} />;
    }

    if (config.showVisual && !config.showAudio) {
      return (
        <VisualAlert 
          emergencyType={emergencyType} 
          onDismiss={handleDismissAlert}
          extraMessage={config.extraMessage}
        />
      );
    }
    
    if (config.showAudio && !config.showVisual) {
      return (
        <AudioAlert 
          emergencyType={emergencyType} 
          onDismiss={handleDismissAlert} 
        />
      );
    }

    return (
      <>
        <VisualAlert 
          emergencyType={emergencyType} 
          onDismiss={handleDismissAlert}
          extraMessage={config.extraMessage}
        />
        <AudioAlert 
          emergencyType={emergencyType} 
          onDismiss={handleDismissAlert} 
        />
      </>
    );
  };

  return (
    <>
      {renderAlert()}
      <AudioMonitor 
        ref={audioMonitorRef}
        enabled={isComplete && !alertState.isActive} 
        onAlertTriggered={handleAutoDetectedAlert}
      />
      
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Guardian Alert</h1>
              <p className="text-xs text-muted-foreground">Emergency Assistant</p>
            </div>
          </div>
        </header>

        {/* Main Content - Empty for now */}
        <main className="flex-1 px-5 py-6">
          {/* Will be rebuilt in next prompt */}
        </main>
      </div>
    </>
  );
};

export default Home;
