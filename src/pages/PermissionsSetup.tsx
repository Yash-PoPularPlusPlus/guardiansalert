import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const PermissionsSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnableProtection = async () => {
    setIsRequesting(true);
    
    let micGranted = false;
    let notifGranted = false;
    
    // Request microphone permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      micGranted = true;
      localStorage.setItem("guardian_mic_permission", "granted");
    } catch (err) {
      console.error("Microphone permission denied:", err);
      localStorage.setItem("guardian_mic_permission", "denied");
    }
    
    // Request notification permission
    try {
      const notifResult = await Notification.requestPermission();
      notifGranted = notifResult === "granted";
      localStorage.setItem("guardian_notif_permission", notifResult);
    } catch (err) {
      console.error("Notification permission error:", err);
      localStorage.setItem("guardian_notif_permission", "denied");
    }
    
    setIsRequesting(false);
    
    // Handle results
    if (micGranted && notifGranted) {
      toast({
        title: "Protection activated ✓",
        description: "You're now protected 24/7",
      });
      setTimeout(() => navigate("/home"), 1000);
    } else if (!micGranted) {
      toast({
        variant: "destructive",
        title: "Microphone Required",
        description: "Microphone access is required for fire detection. Please enable it in your browser settings.",
      });
    } else if (!notifGranted && micGranted) {
      toast({
        title: "Notifications Recommended",
        description: "Notifications are optional but recommended for alerts when you're on another tab.",
      });
      setTimeout(() => navigate("/home"), 2000);
    }
  };

  return (
    <div className="guardian-container">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        {/* Main Icon */}
        <div className="text-[80px] leading-none">🎤</div>
        
        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="guardian-heading">Final Step: Enable Protection</h1>
          <p className="guardian-subtext">
            Guardian Alert needs two permissions to protect you 24/7:
          </p>
        </div>

        {/* Permission Cards */}
        <div className="w-full space-y-3">
          <Card className="p-4 flex items-start gap-4">
            <div className="text-3xl">🎤</div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Microphone Access</h3>
              <p className="text-sm text-muted-foreground">
                To detect fire alarms and emergency sounds
              </p>
            </div>
          </Card>
          
          <Card className="p-4 flex items-start gap-4">
            <div className="text-3xl">🔔</div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">System Notifications</h3>
              <p className="text-sm text-muted-foreground">
                To alert you even when on another tab or window
              </p>
            </div>
          </Card>
        </div>

        {/* Privacy Reassurance */}
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          We only listen for emergency sounds. We don't record or store any audio.
        </p>
      </div>

      {/* Action Button */}
      <div className="pt-6">
        <Button 
          variant="guardian" 
          size="xl" 
          className="w-full"
          onClick={handleEnableProtection}
          disabled={isRequesting}
        >
          {isRequesting ? "Requesting..." : "Enable Protection"}
        </Button>
      </div>
    </div>
  );
};

export default PermissionsSetup;
