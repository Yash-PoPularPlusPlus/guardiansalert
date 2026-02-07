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
  skipSms?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contacts, userName, emergencyType, locationUrl, isTest, makeVoiceCall, voiceCallTo, skipSms }: SMSRequest = await req.json();

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No contacts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { phone: string; success: boolean; error?: string }[] = [];
    const auth = btoa(`${accountSid}:${authToken}`);

    // Send SMS to emergency contacts (unless skipSms is true)
    if (!skipSms) {
      const contactsToNotify = isTest ? [contacts[0]] : contacts;
      const twilioSmsUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      for (const contact of contactsToNotify) {
        try {
          const messageBody = isTest
            ? `[TEST] Guardian Alert: This is a test message from ${userName}.`
            : `🚨 EMERGENCY: ${userName} needs help! A ${emergencyType} has been detected. Location: ${locationUrl}`;

          const smsParams = new URLSearchParams({
            To: contact.phone,
            From: twilioPhoneNumber,
            Body: messageBody,
          });

          const smsResponse = await fetch(twilioSmsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${auth}`,
            },
            body: smsParams.toString(),
          });

          const smsData = await smsResponse.json();

          if (smsResponse.ok) {
            results.push({ phone: contact.phone, success: true });
          } else {
            results.push({ phone: contact.phone, success: false, error: smsData.message });
          }
        } catch (error) {
          results.push({ phone: contact.phone, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    }

    // Voice call logic
    let voiceCallResult: { success: boolean; error?: string } | undefined;

    if (makeVoiceCall && voiceCallTo) {
      const twilioCallUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
      const twiml = `<Response><Say voice="alice">This is an automated emergency call from Guardian Alert. A fire has been detected. Please send help to the user's location.</Say></Response>`;

      const callParams = new URLSearchParams({
        To: voiceCallTo,
        From: twilioPhoneNumber,
        Twiml: twiml,
      });

      try {
        const callResponse = await fetch(twilioCallUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`,
          },
          body: callParams.toString(),
        });

        const callData = await callResponse.json();

        if (callResponse.ok) {
          voiceCallResult = { success: true };
        } else {
          voiceCallResult = { 
            success: false, 
            error: `${callData.message} (Code: ${callData.code})` 
          };
        }
      } catch (error) {
        voiceCallResult = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }

    const allSuccessful = results.length === 0 || results.every(r => r.success);
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
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send SMS' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
