import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Flame, Globe, Waves, Settings, MessageSquare, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import VisualAlert from "@/components/VisualAlert";
import AudioAlert, { unlockAudioForEmergency } from "@/components/AudioAlert";
import CognitiveAlert from "@/components/CognitiveAlert";
import DeafBlindAlert from "@/components/DeafBlindAlert";
import TwilioSettingsModal from "@/components/TwilioSettingsModal";
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
    gradient: "from-red-500 to-red-700",
    hoverGradient: "hover:from-red-600 hover:to-red-800",
  },
  {
    type: "earthquake" as EmergencyType,
    icon: Globe,
    title: "Earthquake",
    gradient: "from-orange-500 to-orange-700",
    hoverGradient: "hover:from-orange-600 hover:to-orange-800",
  },
  {
    type: "flood" as EmergencyType,
    icon: Waves,
    title: "Flood Warning",
    gradient: "from-blue-500 to-blue-700",
    hoverGradient: "hover:from-blue-600 hover:to-blue-800",
  },
];

const Home = () => {
  const navigate = useNavigate();
  const [isComplete, setIsComplete] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [smsStatus, setSmsStatus] = useState({ configured: false, contactCount: 0 });
  const { alertState, triggerPersonalizedAlert, dismissAlert } = usePersonalizedAlert();
  const { notifyEmergencyContacts, isSending } = useSmsNotification();

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

  const getProfileLabel = () => {
    if (currentProfile === "custom") return "Custom";
    const profile = DEMO_PROFILES.find(p => p.value === currentProfile);
    return profile?.label || "Not set";
  };

  if (!isComplete) return null;

  // Render the appropriate alert based on config
  const renderAlert = () => {
    if (!alertState.isActive || !alertState.config || !alertState.emergencyType) return null;

    const { config, emergencyType } = alertState;

    if (config.showDeafBlind) {
      return <DeafBlindAlert emergencyType={emergencyType} onDismiss={dismissAlert} />;
    }

    if (config.showCognitive) {
      return <CognitiveAlert emergencyType={emergencyType} onDismiss={dismissAlert} />;
    }

    return (
      <>
        {config.showVisual && (
          <VisualAlert 
            emergencyType={emergencyType} 
            onDismiss={dismissAlert}
            extraMessage={config.extraMessage}
          />
        )}
        {config.showAudio && (
          <AudioAlert 
            emergencyType={emergencyType} 
            onDismiss={dismissAlert} 
          />
        )}
      </>
    );
  };

  return (
    <>
      {renderAlert()}
      <TwilioSettingsModal open={showSettings} onOpenChange={setShowSettings} />
      
      <div className="guardian-container items-center text-center">
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          {/* Header with Settings */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-primary">Guardian Alert Active</span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* SMS Status */}
          <div className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1 text-left">
              {smsStatus.configured ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm">SMS: Enabled ({smsStatus.contactCount} contacts)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">SMS: Not configured</span>
                </div>
              )}
            </div>
          </div>

          {/* Current Profile Display */}
          <div className="w-full p-4 rounded-xl bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Current Profile</p>
            <p className="text-xl font-bold text-foreground">{getProfileLabel()}</p>
          </div>

          {/* Demo Profile Switcher */}
          <div className="w-full">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Demo as:
            </label>
            <Select value={currentProfile} onValueChange={handleProfileChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a profile" />
              </SelectTrigger>
              <SelectContent>
                {DEMO_PROFILES.map((profile) => (
                  <SelectItem key={profile.value} value={profile.value}>
                    {profile.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Emergency Trigger Cards */}
          <div className="w-full space-y-3 mt-4">
            <p className="text-sm font-medium text-muted-foreground">Simulate Emergency:</p>
            
            {EMERGENCY_CARDS.map((card) => (
              <Card
                key={card.type}
                className={`cursor-pointer transition-all duration-200 bg-gradient-to-r ${card.gradient} ${card.hoverGradient} border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]`}
                onClick={() => handleEmergencyTrigger(card.type)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <card.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-white text-lg">{card.title}</h3>
                    <p className="text-white/70 text-sm">Tap to simulate</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
