import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Mic, CheckCircle, Users, MessageSquare, Clock, AlertTriangle, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import VisualAlert from "@/components/VisualAlert";
import AudioAlert, { unlockAudioForEmergency } from "@/components/AudioAlert";
import CognitiveAlert from "@/components/CognitiveAlert";
import DeafBlindAlert from "@/components/DeafBlindAlert";
import AudioMonitor, { type AudioMonitorHandle } from "@/components/AudioMonitor";
import WaveformVisualizer from "@/components/WaveformVisualizer";
import StatusBanner from "@/components/StatusBanner";
import BottomNav from "@/components/BottomNav";
import {
  usePersonalizedAlert,
  getDisabilities,
  type EmergencyType,
  type DisabilityType,
} from "@/hooks/usePersonalizedAlert";
import { useSmsNotification, getEmergencyContacts } from "@/hooks/useSmsNotification";
import { toast } from "sonner";
import { 
  getDetectionLog, 
  addDetectionEntry, 
  formatDetectionTime, 
  formatDetectionLabel,
  type DetectionLogEntry 
} from "@/utils/detectionLog";
import { AIClassificationResult, AIDetectionStatus } from "@/hooks/useAIAlarmDetection";

const DISABILITY_LABELS: Record<DisabilityType, string> = {
  deaf: "Deaf/Hard of Hearing",
  blind: "Blind/Low Vision",
  nonverbal: "Speech Disability",
  mobility: "Mobility Impaired",
  cognitive: "Cognitive Disability",
};

const Home = () => {
  const navigate = useNavigate();
  const [isComplete, setIsComplete] = useState(false);
  const [lastChecked, setLastChecked] = useState("Just now");
  const [activityLog, setActivityLog] = useState<DetectionLogEntry[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [protectedSince, setProtectedSince] = useState<string>("");
  const [disabilities, setDisabilitiesState] = useState<DisabilityType[]>([]);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [aiClassification, setAiClassification] = useState<AIClassificationResult>(null);
  const [aiStatus, setAiStatus] = useState<AIDetectionStatus>("initializing");
  const { alertState, triggerPersonalizedAlert, dismissAlert } = usePersonalizedAlert();
  const { notifyEmergencyContacts, resetSmsFlag } = useSmsNotification();
  const audioMonitorRef = useRef<AudioMonitorHandle>(null);
  const checkIntervalRef = useRef<number>(0);

  useEffect(() => {
    const data = localStorage.getItem("guardian_data");
    if (!data) {
      navigate("/");
      return;
    }
    
    const parsed = JSON.parse(data);
    if (parsed.onboardingComplete) {
      setIsComplete(true);
      if (parsed.completedAt) {
        const date = new Date(parsed.completedAt);
        setProtectedSince(date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }));
      } else {
        setProtectedSince("Today");
      }
    }

    // Load disabilities
    setDisabilitiesState(getDisabilities());

    // Get contact count
    setContactCount(getEmergencyContacts().length);

    // Load activity log
    setActivityLog(getDetectionLog());

    // Check microphone permission
    const micPermission = localStorage.getItem("guardian_mic_permission");
    setMicPermissionDenied(micPermission === "denied");

    // Update "last checked" every second
    checkIntervalRef.current = window.setInterval(() => {
      setLastChecked("Just now");
    }, 1000);

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [navigate]);

  // Automatic fire alarm detection callback
  const handleAutoDetectedAlert = (type: EmergencyType) => {
    unlockAudioForEmergency();
    triggerPersonalizedAlert(type);
    
    const contacts = getEmergencyContacts();
    const updated = addDetectionEntry(type, "automatic", contacts.length);
    setActivityLog(updated);
    notifyEmergencyContacts(type);
  };

  // Manual emergency report
  const handleManualReport = async () => {
    unlockAudioForEmergency();
    triggerPersonalizedAlert("fire");
    
    const contacts = getEmergencyContacts();
    const updated = addDetectionEntry("fire", "manual", contacts.length);
    setActivityLog(updated);
    
    await notifyEmergencyContacts("fire");
    
    toast.success("Emergency contacts notified ✓", {
      description: "Your report has been verified and sent.",
    });
  };

  if (!isComplete) return null;

  const handleDismissAlert = () => {
    dismissAlert();
    resetSmsFlag();
    audioMonitorRef.current?.resetCooldown();
    toast.success("Marked as safe – Monitoring resumed");
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

  const getDisabilityLabels = () => {
    if (disabilities.length === 0) return "None selected";
    return disabilities.map(d => DISABILITY_LABELS[d]).join(", ");
  };

  return (
    <>
      {renderAlert()}
      <AudioMonitor 
        ref={audioMonitorRef}
        enabled={isComplete && !alertState.isActive} 
        onAlertTriggered={handleAutoDetectedAlert}
        onAIClassification={(result, status) => {
          setAiClassification(result);
          setAiStatus(status);
        }}
        onFireAlarmConfirmed={() => handleAutoDetectedAlert("fire")}
      />
      
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">Guardian Alert</h1>
          </div>
          <Badge 
            variant="outline" 
            className="bg-primary/10 text-primary border-primary/30 animate-pulse"
            style={{ animationDuration: "2s" }}
          >
            <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" style={{ animationDuration: "1s" }} />
            Protected
          </Badge>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 py-5 space-y-4 overflow-y-auto pb-24">
          {/* Status Banners */}
          {micPermissionDenied && <StatusBanner type="sensor-waiting" />}
          {!isOnline && <StatusBanner type="offline" />}

          {/* Card 1: Monitoring Status */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-primary" />
                  </div>
                  {/* Live waveform */}
                  <div className="absolute -right-2 -bottom-1">
                    <WaveformVisualizer isActive={!alertState.isActive && !micPermissionDenied} />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {aiStatus === "initializing" 
                      ? "AI Initializing..." 
                      : aiStatus === "idle" || aiStatus === "detecting"
                        ? "AI Monitoring: Active"
                        : aiStatus === "error"
                          ? "AI Error"
                          : "AI Monitoring: Paused"
                    }
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {aiStatus === "initializing" 
                      ? "Loading AI sound classification model..."
                      : aiStatus === "idle" || aiStatus === "detecting"
                        ? "AI-powered detection for emergency sounds"
                        : aiStatus === "error"
                          ? "Unable to initialize AI detection"
                          : "Microphone access required"
                    }
                  </p>
                </div>
                
                {/* AI Classification Display */}
                {aiClassification && (aiStatus === "idle" || aiStatus === "detecting") && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                    <span className="text-sm font-medium text-primary">
                      AI: {aiClassification.categoryName}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(aiClassification.score * 100)}%
                    </Badge>
                  </div>
                )}
                
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Last checked: {lastChecked}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t border-border w-full">
                  Your accessibility profile: {getDisabilityLabels()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Activity Log */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLog.length === 0 ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Monitoring Status: Secure</p>
                    <p className="text-xs text-muted-foreground">No emergencies detected</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLog.slice(0, 3).map((entry, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{formatDetectionLabel(entry.type)}</span>
                        {entry.source === "manual" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Manual
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDetectionTime(entry.timestamp)}
                      </span>
                    </div>
                  ))}
                  <button 
                    className="text-xs text-primary font-medium hover:underline w-full text-left pt-1 min-h-[44px] flex items-center"
                    onClick={() => navigate("/activity")}
                  >
                    View all activity →
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Manual Report */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                Report Emergency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Detected danger that Guardian Alert hasn't caught? Report it manually.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="w-full min-h-[48px] active:scale-[0.98] transition-transform"
                  >
                    🚨 Report Emergency
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Emergency Report</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure there's an emergency? We'll verify and notify your emergency contacts.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="min-h-[48px]">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleManualReport}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[48px]"
                    >
                      Yes, Report
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Card 4: Quick Info */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex flex-col items-center text-center">
                <Users className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-lg font-bold text-foreground">{contactCount}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Emergency<br />Contacts
                </span>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex flex-col items-center text-center">
                <Shield className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs font-semibold text-foreground">{protectedSince}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Protected<br />Since
                </span>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex flex-col items-center text-center">
                <MessageSquare className="w-5 h-5 text-primary mb-1" />
                <CheckCircle className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-muted-foreground leading-tight">
                  SMS Alerts<br />Active
                </span>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    </>
  );
};

export default Home;
