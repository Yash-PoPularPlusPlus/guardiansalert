import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SMSRequest {
  contacts: { name: string; phone: string }[];
  userName: string;
  emergencyType: string;
  locationUrl: string;
  isTest?: boolean;
  makeVoiceCall?: boolean;
  voiceCallTo?: string;
  latitude?: string;
  longitude?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Hardcoded Twilio credentials for production
    const accountSid = 'AC8b07d946464dab4a039b6a4f74d5a007';
    const authToken = '55a49d79c65c818701e35b839500bf6c';
    const twilioPhoneNumber = '+13292150255';

    const { contacts, userName, emergencyType, locationUrl, isTest, makeVoiceCall, voiceCallTo, latitude, longitude }: SMSRequest = await req.json();

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No contacts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { phone: string; success: boolean; error?: string }[] = [];

    // Send SMS to each contact (only first contact for test)
    const contactsToNotify = isTest ? [contacts[0]] : contacts;

    for (const contact of contactsToNotify) {
      const messageBody = isTest 
        ? `🔔 TEST: Guardian Alert is working!`
        : `🚨 EMERGENCY\n\n${userName} needs help!\nType: ${emergencyType.toUpperCase()}\nLocation: ${locationUrl}\n\nCheck on them NOW.`;

      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const auth = btoa(`${accountSid}:${authToken}`);

        const formData = new URLSearchParams();
        formData.append('To', contact.phone);
        formData.append('From', twilioPhoneNumber);
        formData.append('Body', messageBody);

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        const data = await response.json();

        if (response.ok) {
          results.push({ phone: contact.phone, success: true });
        } else {
          results.push({ 
            phone: contact.phone, 
            success: false, 
            error: data.message || 'Failed to send SMS' 
          });
        }
      } catch (error) {
        results.push({ 
          phone: contact.phone, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // Voice call logic for nonverbal users
    let voiceCallResult: { success: boolean; error?: string } | undefined;

    if (makeVoiceCall && voiceCallTo) {
      console.log('[VoiceCall] Initiating voice call to:', voiceCallTo);
      
      try {
        const twilioCallUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
        const auth = btoa(`${accountSid}:${authToken}`);

        const lat = latitude || 'unknown';
        const lon = longitude || 'unknown';

        const twiml = `<Response><Say voice="alice" language="en-US">This is an automated emergency call from Guardian Alert. A fire emergency has been detected. The user cannot speak. Their location is latitude ${lat}, longitude ${lon}. Please send help immediately.</Say><Pause length="2"/><Say voice="alice" language="en-US">Repeating. This is an automated emergency call. A fire has been detected. The user cannot speak. Please send help.</Say></Response>`;

        const callFormData = new URLSearchParams();
        callFormData.append('To', voiceCallTo);
        callFormData.append('From', twilioPhoneNumber);
        callFormData.append('Twiml', twiml);

        const callResponse = await fetch(twilioCallUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: callFormData.toString(),
        });

        const callData = await callResponse.json();
        console.log('[VoiceCall] Twilio response:', callData);

        if (callResponse.ok) {
          voiceCallResult = { success: true };
          console.log('[VoiceCall] Call initiated successfully');
        } else {
          voiceCallResult = { 
            success: false, 
            error: callData.message || 'Failed to initiate voice call' 
          };
          console.error('[VoiceCall] Failed:', callData);
        }
      } catch (error) {
        voiceCallResult = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
        console.error('[VoiceCall] Exception:', error);
      }
    }

    const allSuccessful = results.every(r => r.success);
    const someSuccessful = results.some(r => r.success);

    return new Response(
      JSON.stringify({ 
        success: allSuccessful,
        partial: !allSuccessful && someSuccessful,
        results,
        voiceCall: voiceCallResult
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('SMS Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send SMS' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
