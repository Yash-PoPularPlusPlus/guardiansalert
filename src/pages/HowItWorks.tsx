import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Check, ShieldCheck, Bell, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const HowItWorks = () => {
  const navigate = useNavigate();
  const [notificationStatus, setNotificationStatus] = useState<"default" | "granted" | "denied">("default");
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Redirect to home if user has already completed onboarding
  useEffect(() => {
    const data = localStorage.getItem("guardian_data");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.onboardingComplete) {
          navigate("/home", { replace: true });
        }
      } catch (e) {
        // Invalid data, let user continue onboarding
      }
    }

    // Check current notification permission
    if ("Notification" in window) {
      setNotificationStatus(Notification.permission as "default" | "granted" | "denied");
    }
  }, [navigate]);

  const handleRequestNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("Your browser doesn't support notifications");
      return;
    }

    setIsRequestingPermission(true);
    
    try {
      // Force permission request if not already granted
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        setNotificationStatus(permission as "default" | "granted" | "denied");
        
        if (permission === "granted") {
          // Send a test notification to confirm it's working
          new Notification("✅ Guardian Alert Enabled", { 
            body: "Notifications enabled! You will be alerted even if this tab is closed.",
            icon: "/favicon.ico",
            tag: "setup-confirmation"
          });
          
          toast.success("Notifications enabled! You'll be alerted even when the app is in the background.");
          localStorage.setItem("guardian_browser_notifications", "true");
          localStorage.setItem("guardian_background_protection", "true");
        } else {
          toast.error("Notifications blocked. You can enable them in browser settings.");
        }
      } else {
        // Already granted
        new Notification("✅ Guardian Alert Ready", { 
          body: "Your notification settings are already active!",
          icon: "/favicon.ico",
          tag: "setup-confirmation"
        });
        toast.success("Notifications already enabled!");
      }
    } catch (error) {
      console.error("Notification permission error:", error);
      toast.error("Failed to request notification permission");
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const features = [
    { text: "Always listening - no need to activate" },
    { text: "Instant personalized alerts" },
    { text: "Automatic family notification" },
  ];

  return (
    <div className="guardian-container items-center justify-center text-center px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm">
        {/* Pulsing microphone icon */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-5xl animate-pulse">🎤</span>
          </div>
          {/* Pulse rings */}
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-30" />
        </div>
        
        {/* Main heading */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            How Guardian Alert Protects You
          </h1>
          <p className="text-lg font-medium text-primary">
            Guardian Alert listens for danger 24/7
          </p>
        </div>

        {/* Explanation text */}
        <p className="text-muted-foreground leading-relaxed">
          Using AI, we continuously monitor for fire alarms and emergency sounds. 
          When detected, you'll get an instant alert in the format that works best for you.
        </p>

        {/* Feature bullets */}
        <div className="w-full space-y-3">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="flex items-center gap-3 bg-card rounded-xl p-4 border border-border"
            >
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-foreground text-left">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* CRITICAL: Notification Permission Request - Large prominent section */}
        <div className={`w-full rounded-xl p-5 border-2 space-y-4 ${
          notificationStatus === "granted" 
            ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700" 
            : notificationStatus === "denied"
              ? "bg-destructive/5 border-destructive/30"
              : "bg-primary/5 border-primary/30"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              notificationStatus === "granted" 
                ? "bg-green-100 dark:bg-green-900/50" 
                : notificationStatus === "denied"
                  ? "bg-destructive/10"
                  : "bg-primary/10"
            }`}>
              {notificationStatus === "granted" ? (
                <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
              ) : notificationStatus === "denied" ? (
                <XCircle className="w-7 h-7 text-destructive" />
              ) : (
                <Bell className="w-7 h-7 text-primary animate-pulse" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-foreground">🔔 Enable Emergency Alerts</p>
              <p className="text-sm text-muted-foreground">
                {notificationStatus === "granted" 
                  ? "✅ Enabled - You'll be alerted even when away"
                  : notificationStatus === "denied"
                    ? "❌ Blocked - Enable in browser settings"
                    : "Required for background protection"
                }
              </p>
            </div>
          </div>
          
          {notificationStatus !== "granted" && (
            <Button
              variant={notificationStatus === "denied" ? "outline" : "default"}
              size="lg"
              className={`w-full font-bold text-base py-6 ${
                notificationStatus === "default" ? "animate-pulse bg-primary hover:bg-primary/90" : ""
              }`}
              onClick={handleRequestNotifications}
              disabled={isRequestingPermission}
            >
              <Bell className="w-5 h-5 mr-2" />
              {isRequestingPermission 
                ? "Requesting Permission..." 
                : notificationStatus === "denied"
                  ? "Try Again (Check Browser Settings)"
                  : "🛡️ Allow System Notifications"
              }
            </Button>
          )}
          
          {notificationStatus === "default" && (
            <p className="text-xs text-center text-muted-foreground">
              Click the button above, then click "Allow" in the browser popup
            </p>
          )}
        </div>

        {/* Privacy reassurance */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>Guardian Alert only listens for emergency sounds. We don't record or store any audio.</span>
        </div>

        {/* Continue button */}
        <Button 
          variant="guardian" 
          size="xl" 
          className="w-full mt-2"
          onClick={() => navigate("/onboarding/disability")}
        >
          I Understand →
        </Button>
      </div>
    </div>
  );
};

export default HowItWorks;
