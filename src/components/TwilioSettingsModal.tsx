import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, CheckCircle, XCircle, RotateCcw, AlertTriangle } from "lucide-react";
import {
  getTwilioSettings,
  saveTwilioSettings,
  useSmsNotification,
  getEmergencyContacts,
  type TwilioSettings,
} from "@/hooks/useSmsNotification";
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
import { clearDetectionLog } from "@/utils/detectionLog";

interface TwilioSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TwilioSettingsModal = ({ open, onOpenChange }: TwilioSettingsModalProps) => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<TwilioSettings>({
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
  });
  const [saved, setSaved] = useState(false);
  const { isSending, sendTestSms } = useSmsNotification();
  const contacts = getEmergencyContacts();

  useEffect(() => {
    if (open) {
      const existing = getTwilioSettings();
      if (existing) {
        setSettings(existing);
      }
      setSaved(false);
    }
  }, [open]);

  const handleSave = () => {
    saveTwilioSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestSms = async () => {
    saveTwilioSettings(settings);
    await sendTestSms();
  };

  const handleResetDemo = () => {
    // Clear all localStorage
    localStorage.removeItem("guardian_data");
    localStorage.removeItem("guardian_disabilities");
    localStorage.removeItem("guardian_contacts");
    localStorage.removeItem("twilioAccountSid");
    localStorage.removeItem("twilioAuthToken");
    localStorage.removeItem("twilioPhoneNumber");
    localStorage.removeItem("guardian_last_sms");
    
    // Close modal and navigate to welcome
    onOpenChange(false);
    navigate("/");
  };

  const isConfigured = settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioPhoneNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Twilio Settings Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Twilio SMS
            </h3>
            
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="accountSid" className="text-sm">Account SID</Label>
                <Input
                  id="accountSid"
                  placeholder="ACxxxxxxxxx..."
                  value={settings.twilioAccountSid}
                  onChange={(e) => setSettings({ ...settings, twilioAccountSid: e.target.value })}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="authToken" className="text-sm">Auth Token</Label>
                <Input
                  id="authToken"
                  type="password"
                  placeholder="Your auth token"
                  value={settings.twilioAuthToken}
                  onChange={(e) => setSettings({ ...settings, twilioAuthToken: e.target.value })}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="twilioPhone" className="text-sm">Twilio Phone Number</Label>
                <Input
                  id="twilioPhone"
                  placeholder="+1234567890"
                  value={settings.twilioPhoneNumber}
                  onChange={(e) => setSettings({ ...settings, twilioPhoneNumber: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>

            {contacts.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                No emergency contacts configured
              </div>
            )}

            {contacts.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                {contacts.length} emergency contact(s) configured
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!isConfigured} className="flex-1 h-11">
                {saved ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Saved!
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleTestSms}
                disabled={!isConfigured || isSending || contacts.length === 0}
                className="h-11"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Demo Controls Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Demo Controls
            </h3>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full h-11 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Demo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Reset Demo?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all settings, contacts, and profile data. You'll need to go through the onboarding again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetDemo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Reset Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwilioSettingsModal;
