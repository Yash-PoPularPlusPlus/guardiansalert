import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, CheckCircle, XCircle } from "lucide-react";
import {
  getTwilioSettings,
  saveTwilioSettings,
  useSmsNotification,
  getEmergencyContacts,
  type TwilioSettings,
} from "@/hooks/useSmsNotification";

interface TwilioSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TwilioSettingsModal = ({ open, onOpenChange }: TwilioSettingsModalProps) => {
  const [settings, setSettings] = useState<TwilioSettings>({
    accountSid: "",
    authToken: "",
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

  const isConfigured = settings.accountSid && settings.authToken && settings.twilioPhoneNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Twilio SMS Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="accountSid">Account SID</Label>
            <Input
              id="accountSid"
              placeholder="ACxxxxxxxxx..."
              value={settings.accountSid}
              onChange={(e) => setSettings({ ...settings, accountSid: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authToken">Auth Token</Label>
            <Input
              id="authToken"
              type="password"
              placeholder="Your auth token"
              value={settings.authToken}
              onChange={(e) => setSettings({ ...settings, authToken: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="twilioPhone">Twilio Phone Number</Label>
            <Input
              id="twilioPhone"
              placeholder="+1234567890"
              value={settings.twilioPhoneNumber}
              onChange={(e) => setSettings({ ...settings, twilioPhoneNumber: e.target.value })}
            />
          </div>

          {contacts.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <XCircle className="w-4 h-4" />
              No emergency contacts configured
            </div>
          )}

          {contacts.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-primary" />
              {contacts.length} emergency contact(s) configured
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={handleSave} disabled={!isConfigured}>
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
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Test SMS
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwilioSettingsModal;
