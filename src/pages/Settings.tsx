import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  User,
  Phone,
  Mic,
  Bell,
  Info,
  Shield,
  Lock,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

const disabilityLabels: Record<string, { icon: string; label: string }> = {
  deaf: { icon: "🔇", label: "Deaf or hard of hearing" },
  blind: { icon: "👁️", label: "Blind or low vision" },
  nonverbal: { icon: "🗣️", label: "Cannot speak" },
  mobility: { icon: "♿", label: "Mobility limitations" },
  cognitive: { icon: "🧠", label: "Cognitive disability" },
};

const Settings = () => {
  const navigate = useNavigate();
  const [disabilities, setDisabilities] = useState<string[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [sensitivity, setSensitivity] = useState("medium");
  const [browserNotifications, setBrowserNotifications] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    // Load disabilities
    const savedDisabilities = localStorage.getItem("guardian_disabilities");
    if (savedDisabilities) {
      try {
        setDisabilities(JSON.parse(savedDisabilities));
      } catch (e) {
        console.error("Failed to parse disabilities");
      }
    }

    // Load contacts
    const savedContacts = localStorage.getItem("guardian_contacts");
    if (savedContacts) {
      try {
        setContacts(JSON.parse(savedContacts));
      } catch (e) {
        console.error("Failed to parse contacts");
      }
    }

    // Load sensitivity
    const savedSensitivity = localStorage.getItem("guardian_sensitivity");
    if (savedSensitivity) {
      setSensitivity(savedSensitivity);
    }

    // Load browser notifications preference
    const savedBrowserNotif = localStorage.getItem("guardian_browser_notifications");
    if (savedBrowserNotif === "true") {
      setBrowserNotifications(true);
    }

    // Load SMS enabled preference (default ON for production)
    const savedSmsEnabled = localStorage.getItem("guardian_sms_enabled");
    setSmsEnabled(savedSmsEnabled !== "false");
  }, []);

  const handleSensitivityChange = (value: string) => {
    setSensitivity(value);
    localStorage.setItem("guardian_sensitivity", value);
    toast.success("Profile updated successfully", {
      description: `Detection sensitivity set to ${value}`,
    });
  };

  const handleBrowserNotificationsToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!("Notification" in window)) {
        toast.error("Browser notifications not supported on this device");
        return;
      }

      // Check current permission state first
      const currentPermission = Notification.permission;
      
      if (currentPermission === "denied") {
        toast.error("Notifications blocked. Click the lock icon in your browser's address bar → Site settings → Allow notifications", {
          duration: 6000,
        });
        return;
      }

      if (currentPermission === "granted") {
        setBrowserNotifications(true);
        localStorage.setItem("guardian_browser_notifications", "true");
        toast.success("Browser notifications enabled");
        return;
      }

      // Permission is "default" - request it
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setBrowserNotifications(true);
          localStorage.setItem("guardian_browser_notifications", "true");
          toast.success("Browser notifications enabled");
        } else {
          toast.error("Permission denied. You can enable it later in browser settings");
        }
      } catch (error) {
        toast.error("Could not request notification permission");
      }
    } else {
      setBrowserNotifications(false);
      localStorage.setItem("guardian_browser_notifications", "false");
      toast.success("Browser notifications disabled");
    }
  };

  const handleSmsToggle = (enabled: boolean) => {
    setSmsEnabled(enabled);
    localStorage.setItem("guardian_sms_enabled", enabled ? "true" : "false");
    toast.success("Profile updated successfully", {
      description: enabled ? "SMS alerts enabled – real SMS will be sent" : "SMS alerts disabled – testing mode active",
    });
  };

  const handleEditProfile = () => {
    // Clear onboarding complete flag to allow editing
    const data = localStorage.getItem("guardian_data");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        parsed.onboardingComplete = false;
        localStorage.setItem("guardian_data", JSON.stringify(parsed));
      } catch (e) {
        console.error("Failed to update guardian data");
      }
    }
    navigate("/onboarding/disability");
  };

  const handleEditContacts = () => {
    // Clear onboarding complete flag to allow editing
    const data = localStorage.getItem("guardian_data");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        parsed.onboardingComplete = false;
        localStorage.setItem("guardian_data", JSON.stringify(parsed));
      } catch (e) {
        console.error("Failed to update guardian data");
      }
    }
    navigate("/onboarding/contacts");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Section 1: Your Profile */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Your Profile
          </h2>

          {/* Disabilities Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Accessibility Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {disabilities.length > 0 ? (
                  disabilities.map((id) => (
                    <Badge key={id} variant="secondary" className="text-sm py-1">
                      {disabilityLabels[id]?.icon} {disabilityLabels[id]?.label}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">No profile selected</span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleEditProfile} className="w-full min-h-[44px] active:scale-[0.98] transition-transform">
                Edit Profile
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          {/* Contacts Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Emergency Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contacts.length > 0 ? (
                <div className="space-y-2">
                  {contacts.map((contact, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium text-foreground">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">{contact.phone}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {contact.relationship}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">No contacts added</span>
              )}
              <Button variant="outline" size="sm" onClick={handleEditContacts} className="w-full min-h-[44px] active:scale-[0.98] transition-transform">
                Edit Contacts
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Monitoring */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Monitoring
          </h2>

          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Fire Alarm Detection Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-primary" />
                    <Label className="font-medium">Natural Disaster Detection</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Required for protection</p>
                </div>
                <Switch checked={true} disabled className="opacity-50" />
              </div>

              {/* Detection Sensitivity */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <Label className="font-medium">Detection Sensitivity</Label>
                </div>
                <Select value={sensitivity} onValueChange={handleSensitivityChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sensitivity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Fewer false alarms</SelectItem>
                    <SelectItem value="medium">Medium - Balanced</SelectItem>
                    <SelectItem value="high">High - Maximum protection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Notifications */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Notifications
          </h2>

          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* SMS Alerts Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    <Label className="font-medium">Send SMS Alerts</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enable to send real SMS to emergency contacts. Disable for testing.
                  </p>
                </div>
                <Switch
                  checked={smsEnabled}
                  onCheckedChange={handleSmsToggle}
                />
              </div>

              {/* Browser Notifications Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <Label className="font-medium">Browser Notifications</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Get alerts in your browser</p>
                </div>
                <Switch
                  checked={browserNotifications}
                  onCheckedChange={handleBrowserNotificationsToggle}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 4: About */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            About
          </h2>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">App Version</span>
                </div>
                <span className="text-sm text-muted-foreground">1.0.0</span>
              </div>

              <button
                onClick={() => setShowHowItWorks(true)}
                className="w-full flex items-center justify-between py-2 text-left hover:bg-accent/50 rounded-md px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">How Guardian Alert Works</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => setShowPrivacy(true)}
                className="w-full flex items-center justify-between py-2 text-left hover:bg-accent/50 rounded-md px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Privacy Policy</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                Built for INTUition 2026
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* How It Works Dialog */}
      <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              How Guardian Alert Works
            </DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h4 className="font-semibold mb-1">🎤 24/7 Audio Monitoring</h4>
                <p className="text-muted-foreground">
                  Guardian Alert continuously listens for fire alarm sounds using your device's microphone.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">🔔 Personalized Alerts</h4>
                <p className="text-muted-foreground">
                  Based on your accessibility profile, we deliver alerts through visual, audio, or vibration channels.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">📱 SMS Notifications</h4>
                <p className="text-muted-foreground">
                  When danger is detected, your emergency contacts receive an immediate SMS with your location.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">🔒 Privacy First</h4>
                <p className="text-muted-foreground">
                  Audio is processed locally on your device. We never record, store, or transmit any audio data.
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Privacy Policy
            </DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h4 className="font-semibold mb-1">Data We Collect</h4>
                <p className="text-muted-foreground">
                  We store your accessibility preferences, emergency contacts, and activity logs locally on your device.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Audio Processing</h4>
                <p className="text-muted-foreground">
                  Audio is analyzed in real-time on your device to detect emergency sounds. No audio is ever recorded, stored, or transmitted.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">SMS Notifications</h4>
                <p className="text-muted-foreground">
                  When an emergency is detected, we send SMS messages to your emergency contacts. This requires transmitting contact information securely.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Your Control</h4>
                <p className="text-muted-foreground">
                  All data is stored locally. You can clear your data at any time by resetting the application.
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
