import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Flame, Globe, Waves, MessageSquare, CheckCircle, Users, Clock, Hand } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import VisualAlert from "@/components/VisualAlert";
import AudioAlert, { unlockAudioForEmergency } from "@/components/AudioAlert";
import CognitiveAlert from "@/components/CognitiveAlert";
import DeafBlindAlert from "@/components/DeafBlindAlert";
import AudioMonitor, { type AudioMonitorHandle } from "@/components/AudioMonitor";
import {
  usePersonalizedAlert,
  getDisabilities,
  setDisabilities,
  type EmergencyType,
  type DisabilityType,
} from "@/hooks/usePersonalizedAlert";
import { useSmsNotification, getEmergencyContacts } from "@/hooks/useSmsNotification";
import { 
  getDetectionLog, 
  addDetectionEntry, 
  formatDetectionTime, 
  formatDetectionLabel,
  type DetectionLogEntry 
} from "@/utils/detectionLog";

const DEMO_PROFILES: { value: string; label: string; disabilities: DisabilityType[] }[] = [
  { value: "deaf", label: "Deaf", disabilities: ["deaf"] },
  { value: "blind", label: "Blind", disabilities: ["blind"] },
  { value: "deaf-blind", label: "Deaf + Blind", disabilities: ["deaf", "blind"] },
  { value: "nonverbal", label: "Speech", disabilities: ["nonverbal"] },
  { value: "cognitive", label: "Cognitive", disabilities: ["cognitive"] },
  { value: "mobility", label: "Mobility", disabilities: ["mobility"] },
];

const EMERGENCY_CARDS = [
  {
    type: "fire" as EmergencyType,
    icon: Flame,
    title: "Fire Emergency",
    emoji: "🔥",
    gradient: "from-red-500 to-red-600",
    shadow: "shadow-red-500/25",
  },
  {
    type: "earthquake" as EmergencyType,
    icon: Globe,
    title: "Earthquake",
    emoji: "🌍",
    gradient: "from-orange-500 to-orange-600",
    shadow: "shadow-orange-500/25",
  },
  {
    type: "flood" as EmergencyType,
    icon: Waves,
    title: "Flood Warning",
    emoji: "🌊",
    gradient: "from-blue-500 to-blue-600",
    shadow: "shadow-blue-500/25",
  },
];

const Home = () => {
  const navigate = useNavigate();
  const [isComplete, setIsComplete] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<string>("");
  const [contactCount, setContactCount] = useState(0);
  const [activityLog, setActivityLog] = useState<DetectionLogEntry[]>([]);
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

    // Load current disabilities to show profile
    const disabilities = getDisabilities();
    const matchedProfile = DEMO_PROFILES.find(
      p => JSON.stringify(p.disabilities.sort()) === JSON.stringify(disabilities.sort())
    );
    if (matchedProfile) {
      setCurrentProfile(matchedProfile.value);
    } else if (disabilities.length > 0) {
      setCurrentProfile("custom");
    }

    // Get contact count
    const contacts = getEmergencyContacts();
    setContactCount(contacts.length);

    // Load activity log
    setActivityLog(getDetectionLog());
  }, [navigate]);

  const handleProfileChange = (value: string) => {
    const profile = DEMO_PROFILES.find(p => p.value === value);
    if (profile) {
      setDisabilities(profile.disabilities);
      setCurrentProfile(value);
    }
  };

  // Manual emergency trigger (backup method)
  const handleManualTrigger = async (type: EmergencyType) => {
    unlockAudioForEmergency();
    triggerPersonalizedAlert(type);
    
    const updated = addDetectionEntry(type, "manual");
    setActivityLog(updated);
    
    await notifyEmergencyContacts(type);
  };

  // INSTANT callback - trigger alert immediately
  const handleAutoDetectedAlert = (type: EmergencyType) => {
    unlockAudioForEmergency();
    triggerPersonalizedAlert(type);
    
    const updated = addDetectionEntry(type, "automatic");
    setActivityLog(updated);
    notifyEmergencyContacts(type);
  };

  const getProfileLabel = () => {
    if (currentProfile === "custom") return "Custom";
    const profile = DEMO_PROFILES.find(p => p.value === currentProfile);
    return profile?.label || "Not set";
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

        {/* Main Content */}
        <main className="flex-1 px-5 py-6 space-y-6 overflow-y-auto">
          {/* Profile Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Current Profile</span>
              <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
                {getProfileLabel()}
              </Badge>
            </div>
            
            {/* Profile Switcher */}
            <div className="bg-card rounded-xl p-4 border border-border">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Demo as:
              </label>
              <Select value={currentProfile} onValueChange={handleProfileChange}>
                <SelectTrigger className="w-full h-12 text-base">
                  <SelectValue placeholder="Select a profile" />
                </SelectTrigger>
                <SelectContent>
                  {DEMO_PROFILES.map((profile) => (
                    <SelectItem key={profile.value} value={profile.value} className="text-base py-3">
                      {profile.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Manual Alert Cards */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Hand className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Manual Alert</p>
              </div>
              <p className="text-xs text-muted-foreground">Tap if you need to report an emergency manually</p>
            </div>
            
            {EMERGENCY_CARDS.map((card) => (
              <Card
                key={card.type}
                className={`cursor-pointer transition-all duration-200 bg-gradient-to-r ${card.gradient} border-0 shadow-lg ${card.shadow} hover:shadow-xl active:scale-[0.98] rounded-xl overflow-hidden`}
                onClick={() => handleManualTrigger(card.type)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
                    {card.emoji}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-base">{card.title}</h3>
                    <p className="text-white/70 text-xs">Tap to trigger alert</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Recent Activity</p>
            </div>
            
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {activityLog.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No activity yet
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {activityLog.slice(0, 3).map((entry, index) => (
                    <div key={index} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{formatDetectionLabel(entry.type)}</span>
                        {entry.source === "automatic" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Auto
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDetectionTime(entry.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer - SMS Status (always enabled) */}
        <footer className="px-5 py-4 border-t border-border bg-card">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-foreground">SMS Enabled</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Users className="w-3 h-3" />
                <span>{contactCount} emergency contact{contactCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home;
