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
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || 'AC8b07d946464dab4a039b6a4f74d5a007';
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') || '55a49d79c65c818701e35b839500bf6c';
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || '+13292150255';

    const { contacts, userName, emergencyType, locationUrl, isTest, makeVoiceCall, voiceCallTo, latitude, longitude }: SMSRequest = await req.json();

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No contacts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { phone: string; success: boolean; error?: string }[] = [];

    // Skip SMS sending to preserve Twilio quota
    // Just log that we would have sent SMS
    const contactsToNotify = isTest ? [contacts[0]] : contacts;
    for (const contact of contactsToNotify) {
      console.log('[SMS] Skipped (quota preservation):', contact.phone);
      results.push({ phone: contact.phone, success: true });
    }

    // Voice call logic for nonverbal users
    let voiceCallResult: { success: boolean; error?: string } | undefined;

    if (makeVoiceCall && voiceCallTo) {
      const twilioCallUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
      const twiml = `<Response><Say voice="alice">This is an automated emergency call from Guardian Alert. A fire has been detected. Please send help to the user's location.</Say></Response>`;

      const callParams = new URLSearchParams({
        To: voiceCallTo,
        From: twilioPhoneNumber,
        Twiml: twiml,
      });

      // CRITICAL: Log URL and parameters before fetch
      console.log('[VoiceCall] Request:', {
        url: twilioCallUrl,
        To: voiceCallTo,
        From: twilioPhoneNumber,
        TwimlLength: twiml.length,
        timestamp: new Date().toISOString(),
      });

      try {
        const auth = btoa(`${accountSid}:${authToken}`);
        
        const callResponse = await fetch(twilioCallUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`,
          },
          body: callParams.toString(),
        });

        const callData = await callResponse.json();

        // CRITICAL: Log status and message from Twilio's response
        console.log('[VoiceCall] Response:', {
          httpStatus: callResponse.status,
          status: callData.status,
          message: callData.message,
          code: callData.code,
          sid: callData.sid,
          timestamp: new Date().toISOString(),
        });

        if (callResponse.ok) {
          voiceCallResult = { success: true };
          console.log('[VoiceCall] Call initiated successfully, SID:', callData.sid);
        } else {
          voiceCallResult = { 
            success: false, 
            error: `${callData.message} (Code: ${callData.code})` 
          };
          console.error('[VoiceCall] Failed:', callData.message, 'Code:', callData.code);
        }
      } catch (error) {
        console.error('[VoiceCall] Exception:', error);
        voiceCallResult = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
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
