import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { EmergencyType } from "./usePersonalizedAlert";
import { getDisabilities } from "./usePersonalizedAlert";

export interface Contact {
  name: string;
  phone: string;
}

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

interface LocationData {
  url: string;
  latitude: string | null;
  longitude: string | null;
}

const getCurrentLocationWithCoords = (): Promise<LocationData> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ url: "Location unavailable", latitude: null, longitude: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve({
          url: `https://maps.google.com/?q=${latitude},${longitude}`,
          latitude: String(latitude),
          longitude: String(longitude),
        });
      },
      () => {
        resolve({ url: "Location unavailable", latitude: null, longitude: null });
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
    // Check if SMS is enabled (testing mode check)
    const smsEnabled = localStorage.getItem("guardian_sms_enabled") === "true";
    
    if (!smsEnabled) {
      toast({
        title: "SMS simulated (testing mode) ✓",
        description: "SMS alerts are disabled in settings",
      });
      return { success: true, simulated: true };
    }

    // Check if already sent for this alert
    if (smsSentForCurrentAlert) {
      return { success: false, reason: "already_sent" };
    }

    // Check cooldown
    const lastSent = getLastSmsSentTime();
    const timeSinceLast = Date.now() - lastSent;
    if (timeSinceLast < SMS_COOLDOWN_MS) {
      return { success: false, reason: "cooldown" };
    }

    const contacts = getEmergencyContacts();

    if (contacts.length === 0) {
      return { success: false, reason: "no_contacts" };
    }

    setIsSending(true);
    setSmsSentForCurrentAlert(true);

    try {
      const locationData = await getCurrentLocationWithCoords();
      const userName = getUserName();

      // Check if user is nonverbal for voice call
      const isNonverbal = getDisabilities().includes("nonverbal");

      // Build request body
      const requestBody: Record<string, unknown> = {
        contacts,
        userName,
        emergencyType,
        locationUrl: locationData.url,
      };

      // Add voice call fields for nonverbal users
      if (isNonverbal && contacts.length > 0) {
        requestBody.makeVoiceCall = true;
        requestBody.voiceCallTo = contacts[0].phone;
        requestBody.latitude = locationData.latitude;
        requestBody.longitude = locationData.longitude;
        console.log("[SMS] Nonverbal user detected, adding voice call to:", contacts[0].phone);
      }

      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: requestBody,
      });

      if (error) {
        toast({
          title: "SMS failed",
          description: "Could not send emergency alert",
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

        // Show voice call toast if successful
        if (data?.voiceCall?.success && contacts.length > 0) {
          toast({
            title: "Emergency call placed ✓",
            description: `Calling ${contacts[0].name}`,
          });
        }

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
          description: data?.error || "Could not send",
          variant: "destructive",
        });
        return { success: false, reason: "send_failed" };
      }
    } catch (error) {
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
    const contacts = getEmergencyContacts();

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
          description: "Could not send test SMS",
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
          description: data?.error || "Could not send",
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
