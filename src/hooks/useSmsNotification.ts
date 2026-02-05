import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { EmergencyType } from "./usePersonalizedAlert";

export interface TwilioSettings {
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
}

export interface Contact {
  name: string;
  phone: string;
}

export const getTwilioSettings = (): TwilioSettings | null => {
  try {
    const saved = localStorage.getItem("guardian_twilio");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.twilioAccountSid && parsed.twilioAuthToken && parsed.twilioPhoneNumber) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to parse Twilio settings:", e);
  }
  return null;
};

export const saveTwilioSettings = (settings: TwilioSettings) => {
  localStorage.setItem("guardian_twilio", JSON.stringify(settings));
};

export const getEmergencyContacts = (): Contact[] => {
  try {
    const saved = localStorage.getItem("guardian_contacts");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(c => c.name && c.phone);
      }
    }
  } catch (e) {
    console.error("Failed to parse contacts:", e);
  }
  return [];
};

export const getUserName = (): string => {
  try {
    const saved = localStorage.getItem("guardian_data");
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.userName || "Someone";
    }
  } catch (e) {
    console.error("Failed to get user name:", e);
  }
  return "Someone";
};

const getCurrentLocation = (): Promise<string> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve("Location unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve(`https://maps.google.com/?q=${latitude},${longitude}`);
      },
      () => {
        resolve("Location unavailable");
      },
      { timeout: 5000, maximumAge: 60000 }
    );
  });
};

const SMS_COOLDOWN_MS = 60000; // 60 seconds

const getLastSmsSentTime = (): number => {
  try {
    const saved = localStorage.getItem("guardian_last_sms");
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
};

const setLastSmsSentTime = () => {
  localStorage.setItem("guardian_last_sms", Date.now().toString());
};

export const useSmsNotification = () => {
  const [isSending, setIsSending] = useState(false);
  const [smsSentForCurrentAlert, setSmsSentForCurrentAlert] = useState(false);

  const resetSmsFlag = useCallback(() => {
    setSmsSentForCurrentAlert(false);
  }, []);

  const notifyEmergencyContacts = useCallback(async (emergencyType: EmergencyType) => {
    // Check if already sent for this alert
    if (smsSentForCurrentAlert) {
      console.log("SMS already sent for this alert, skipping");
      return { success: false, reason: "already_sent" };
    }

    // Check cooldown
    const lastSent = getLastSmsSentTime();
    const timeSinceLast = Date.now() - lastSent;
    if (timeSinceLast < SMS_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((SMS_COOLDOWN_MS - timeSinceLast) / 1000);
      toast({
        title: "SMS already sent",
        description: `Wait ${remainingSeconds}s before sending again`,
      });
      return { success: false, reason: "cooldown" };
    }

    const settings = getTwilioSettings();
    const contacts = getEmergencyContacts();

    if (!settings) {
      console.log("Twilio not configured, skipping SMS");
      return { success: false, reason: "not_configured" };
    }

    if (contacts.length === 0) {
      console.log("No emergency contacts, skipping SMS");
      return { success: false, reason: "no_contacts" };
    }

    setIsSending(true);
    setSmsSentForCurrentAlert(true);

    try {
      const locationUrl = await getCurrentLocation();
      const userName = getUserName();

      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          accountSid: settings.twilioAccountSid,
          authToken: settings.twilioAuthToken,
          twilioPhoneNumber: settings.twilioPhoneNumber,
          contacts,
          userName,
          emergencyType,
          locationUrl,
        },
      });

      if (error) {
        console.error("SMS error:", error);
        toast({
          title: "SMS failed",
          description: "Check Twilio settings",
          variant: "destructive",
        });
        return { success: false, reason: "api_error" };
      }

      if (data?.success) {
        setLastSmsSentTime();
        toast({
          title: "Emergency contacts notified ✓",
          description: `SMS sent to ${contacts.length} contact(s)`,
        });
        return { success: true };
      } else if (data?.partial) {
        setLastSmsSentTime();
        toast({
          title: "Some SMS sent",
          description: "Not all contacts were notified",
          variant: "destructive",
        });
        return { success: true, partial: true };
      } else {
        toast({
          title: "SMS failed",
          description: data?.error || "Check Twilio settings",
          variant: "destructive",
        });
        return { success: false, reason: "send_failed" };
      }
    } catch (error) {
      console.error("SMS error:", error);
      toast({
        title: "SMS failed",
        description: "Check settings",
        variant: "destructive",
      });
      return { success: false, reason: "exception" };
    } finally {
      setIsSending(false);
    }
  }, [smsSentForCurrentAlert]);

  const sendTestSms = useCallback(async () => {
    const settings = getTwilioSettings();
    const contacts = getEmergencyContacts();

    if (!settings) {
      toast({
        title: "Configure Twilio first",
        description: "Add your Twilio credentials in settings",
        variant: "destructive",
      });
      return { success: false };
    }

    if (contacts.length === 0) {
      toast({
        title: "No contacts",
        description: "Add emergency contacts first",
        variant: "destructive",
      });
      return { success: false };
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          accountSid: settings.twilioAccountSid,
          authToken: settings.twilioAuthToken,
          twilioPhoneNumber: settings.twilioPhoneNumber,
          contacts,
          userName: getUserName(),
          emergencyType: "test",
          locationUrl: "Test location",
          isTest: true,
        },
      });

      if (error) {
        toast({
          title: "Test failed",
          description: "Check your Twilio credentials",
          variant: "destructive",
        });
        return { success: false };
      }

      if (data?.success) {
        toast({
          title: "Test SMS sent ✓",
          description: `Sent to ${contacts[0].name}`,
        });
        return { success: true };
      } else {
        toast({
          title: "Test failed",
          description: data?.error || "Check credentials",
          variant: "destructive",
        });
        return { success: false };
      }
    } catch (error) {
      toast({
        title: "Test failed",
        description: "Check settings",
        variant: "destructive",
      });
      return { success: false };
    } finally {
      setIsSending(false);
    }
  }, []);

  return {
    isSending,
    notifyEmergencyContacts,
    sendTestSms,
    resetSmsFlag,
  };
};
