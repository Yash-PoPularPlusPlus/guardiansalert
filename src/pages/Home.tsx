import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Mic, CheckCircle, Users, MessageSquare, Clock, AlertTriangle, Monitor } from "lucide-react";
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
import {
  usePersonalizedAlert,
  getDisabilities,
  type EmergencyType,
  type DisabilityType,
} from "@/hooks/usePersonalizedAlert";
import { useSmsNotification, getEmergencyContacts } from "@/hooks/useSmsNotification";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useBackgroundNotification, playWakeUpSound } from "@/hooks/useBackgroundNotification";
import { useEmergencySiren } from "@/hooks/useEmergencySiren";
import { useEmergencyTitleBlink } from "@/hooks/useEmergencyTitleBlink";
import { toast } from "@/hooks/use-toast";
import { 
  getDetectionLog, 
  addDetectionEntry, 
  formatDetectionTime, 
  formatDetectionLabel,
  type DetectionLogEntry 
} from "@/utils/detectionLog";

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
  const { alertState, triggerPersonalizedAlert, dismissAlert } = usePersonalizedAlert();
  const { notifyEmergencyContacts, resetSmsFlag } = useSmsNotification();
  const audioMonitorRef = useRef<AudioMonitorHandle>(null);
  const checkIntervalRef = useRef<number>(0);
  
  // Background protection
  const isBackgroundEnabled = localStorage.getItem("guardian_background_protection") === "true";
  const { isActive: wakeLockActive } = useWakeLock({ enabled: isBackgroundEnabled && isComplete });
  const { sendEmergencyNotification } = useBackgroundNotification({
    onNotificationClick: () => {
      // When notification is clicked, show the full alert
      if (!alertState.isActive) {
        triggerPersonalizedAlert("fire");
      }
    }
  });

  useEffect(() => {
    const data = localStorage.getItem("guardian_data");
    if (!data) {
      navigate("/");
      return;
    }
    
    const parsed = JSON.parse(data);
    if (parsed.onboardingComplete) {
      setIsComplete(true);
      // Set protected since date
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

    // Update "last checked" every second
    checkIntervalRef.current = window.setInterval(() => {
      setLastChecked("Just now");
    }, 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [navigate]);

  // Automatic fire alarm detection callback with background support
  const handleAutoDetectedAlert = useCallback((type: EmergencyType) => {
    unlockAudioForEmergency();
    
    // Check if we're in background - send system notification
    if (document.visibilityState === "hidden" || !document.hasFocus()) {
      // Send system notification
      sendEmergencyNotification(type);
      // Play loud wake-up sound even in background
      playWakeUpSound();
    }
    
    triggerPersonalizedAlert(type);
    
    const updated = addDetectionEntry(type, "automatic");
    setActivityLog(updated);
    notifyEmergencyContacts(type);
  }, [sendEmergencyNotification, triggerPersonalizedAlert, notifyEmergencyContacts]);

  // Manual emergency report
  const handleManualReport = async () => {
    unlockAudioForEmergency();
    triggerPersonalizedAlert("fire");
    
    const updated = addDetectionEntry("fire", "manual");
    setActivityLog(updated);
    
    await notifyEmergencyContacts("fire");
    
    toast({
      title: "Emergency reported",
      description: "Your emergency contacts have been notified.",
    });
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
          >
            <span className="w-2 h-2 rounded-full bg-primary mr-2" />
            Protected
          </Badge>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 py-5 space-y-4 overflow-y-auto pb-20">
          {/* Card 1: Monitoring Status */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Mic className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Monitoring Active</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Listening for fire alarms and emergency sounds
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Last checked: {lastChecked}</span>
                </div>
                
                {/* Background Protection Status */}
                {isBackgroundEnabled && (
                  <div className="flex items-center gap-2 py-2 px-3 bg-primary/10 rounded-lg">
                    <Monitor className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs text-primary font-medium">
                      Background Monitoring: {wakeLockActive ? "Active" : "Standby"}
                    </span>
                  </div>
                )}
                
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
                    <p className="text-sm font-medium text-foreground">No emergencies detected</p>
                    <p className="text-xs text-muted-foreground">You're safe.</p>
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
                    className="text-xs text-primary font-medium hover:underline w-full text-left pt-1"
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
                  <Button variant="destructive" className="w-full">
                    🚨 Report Fire Emergency
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Emergency Report</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure there's a fire emergency? We'll verify and notify your emergency contacts.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleManualReport}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                  SMS<br />Enabled
                </span>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 py-3">
          <div className="flex justify-around items-center max-w-md mx-auto">
            <button className="flex flex-col items-center gap-1 text-primary">
              <Shield className="w-5 h-5" />
              <span className="text-xs font-medium">Home</span>
            </button>
            <button 
              className="flex flex-col items-center gap-1 text-muted-foreground"
              onClick={() => navigate("/activity")}
            >
              <Clock className="w-5 h-5" />
              <span className="text-xs">Activity</span>
            </button>
            <button 
              className="flex flex-col items-center gap-1 text-muted-foreground"
              onClick={() => navigate("/settings")}
            >
              <Users className="w-5 h-5" />
              <span className="text-xs">Settings</span>
            </button>
          </div>
        </nav>
      </div>
    </>
  );
};

export default Home;
