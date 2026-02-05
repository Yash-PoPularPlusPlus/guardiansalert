import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  accountSid: string;
  authToken: string;
  twilioPhoneNumber: string;
  contacts: { name: string; phone: string }[];
  userName: string;
  emergencyType: string;
  locationUrl: string;
  isTest?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      accountSid, 
      authToken, 
      twilioPhoneNumber, 
      contacts, 
      userName, 
      emergencyType, 
      locationUrl,
      isTest 
    }: SMSRequest = await req.json();

    // Validate required fields
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Twilio credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No contacts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentTime = new Date().toLocaleString();
    const results: { phone: string; success: boolean; error?: string }[] = [];

    // Send SMS to each contact
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

    const allSuccessful = results.every(r => r.success);
    const someSuccessful = results.some(r => r.success);

    return new Response(
      JSON.stringify({ 
        success: allSuccessful,
        partial: !allSuccessful && someSuccessful,
        results 
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
