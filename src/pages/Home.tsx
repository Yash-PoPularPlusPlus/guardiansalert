import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Flame, Globe, Waves, Settings, MessageSquare, AlertTriangle, CheckCircle, Users } from "lucide-react";
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
import TwilioSettingsModal from "@/components/TwilioSettingsModal";
import AudioMonitor from "@/components/AudioMonitor";
import {
  usePersonalizedAlert,
  getDisabilities,
  setDisabilities,
  type EmergencyType,
  type DisabilityType,
} from "@/hooks/usePersonalizedAlert";
import { useSmsNotification, getTwilioSettings, getEmergencyContacts } from "@/hooks/useSmsNotification";

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
  const [showSettings, setShowSettings] = useState(false);
  const [smsStatus, setSmsStatus] = useState({ configured: false, contactCount: 0 });
  const { alertState, triggerPersonalizedAlert, dismissAlert } = usePersonalizedAlert();
  const { notifyEmergencyContacts, isSending, resetSmsFlag } = useSmsNotification();

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

    // Check SMS status
    const twilioSettings = getTwilioSettings();
    const contacts = getEmergencyContacts();
    setSmsStatus({
      configured: !!twilioSettings,
      contactCount: contacts.length,
    });
  }, [navigate, showSettings]);

  const handleProfileChange = (value: string) => {
    const profile = DEMO_PROFILES.find(p => p.value === value);
    if (profile) {
      setDisabilities(profile.disabilities);
      setCurrentProfile(value);
    }
  };

  const handleEmergencyTrigger = async (type: EmergencyType) => {
    // Unlock audio for browsers that require user interaction
    unlockAudioForEmergency();
    triggerPersonalizedAlert(type);
    
    // Send SMS to emergency contacts
    await notifyEmergencyContacts(type);
  };

  // Callback for AudioMonitor when fire alarm is detected
  const handleAudioDetectedAlert = useCallback((type: EmergencyType) => {
    triggerPersonalizedAlert(type);
  }, [triggerPersonalizedAlert]);

  const getProfileLabel = () => {
    if (currentProfile === "custom") return "Custom";
    const profile = DEMO_PROFILES.find(p => p.value === currentProfile);
    return profile?.label || "Not set";
  };

  if (!isComplete) return null;

  const handleDismissAlert = () => {
    dismissAlert();
    resetSmsFlag();
  };

  // Render the appropriate alert based on config
  const renderAlert = () => {
    if (!alertState.isActive || !alertState.config || !alertState.emergencyType) return null;

    const { config, emergencyType } = alertState;

    if (config.showDeafBlind) {
      return <DeafBlindAlert emergencyType={emergencyType} onDismiss={handleDismissAlert} />;
    }

    if (config.showCognitive) {
      return <CognitiveAlert emergencyType={emergencyType} onDismiss={handleDismissAlert} />;
    }

    return (
      <>
        {config.showVisual && (
          <VisualAlert 
            emergencyType={emergencyType} 
            onDismiss={handleDismissAlert}
            extraMessage={config.extraMessage}
          />
        )}
        {config.showAudio && (
          <AudioAlert 
            emergencyType={emergencyType} 
            onDismiss={handleDismissAlert} 
          />
        )}
      </>
    );
  };

  return (
    <>
      {renderAlert()}
      <TwilioSettingsModal open={showSettings} onOpenChange={setShowSettings} />
      
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
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors active:scale-95"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-5 py-6 space-y-6">
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

          {/* Emergency Cards */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Simulate Emergency</p>
            
            {EMERGENCY_CARDS.map((card) => (
              <Card
                key={card.type}
                className={`cursor-pointer transition-all duration-200 bg-gradient-to-r ${card.gradient} border-0 shadow-lg ${card.shadow} hover:shadow-xl active:scale-[0.98] rounded-xl overflow-hidden`}
                onClick={() => handleEmergencyTrigger(card.type)}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-3xl">
                    {card.emoji}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-lg">{card.title}</h3>
                    <p className="text-white/70 text-sm">Tap to simulate</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>

        {/* Footer - SMS Status */}
        <footer className="px-5 py-4 border-t border-border bg-card">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              {smsStatus.configured ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-foreground">SMS Enabled</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-muted-foreground">SMS Not configured</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Users className="w-3 h-3" />
                <span>{smsStatus.contactCount} emergency contact{smsStatus.contactCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home;
