import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const HowItWorks = () => {
  const navigate = useNavigate();

  // Redirect to home if user has already completed onboarding
  useEffect(() => {
    const data = localStorage.getItem("guardian_data");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.onboardingComplete) {
          navigate("/home", { replace: true });
        }
      } catch (e) {
        // Invalid data, let user continue onboarding
      }
    }
  }, [navigate]);

  const features = [
    {
      icon: "🎤",
      title: "Always Listening",
      description: "AI continuously monitors for natural disasters and emergency sounds"
    },
    {
      icon: "⚡",
      title: "Instant Alerts",
      description: "Personalized alerts in visual, audio, or haptic format based on your needs"
    },
    {
      icon: "📱",
      title: "Auto Notification",
      description: "Emergency contacts get your location automatically via SMS"
    }
  ];

  return (
    <div className="guardian-container items-center justify-center text-center px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        {/* Pulsing microphone icon */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-5xl animate-pulse">🎤</span>
          </div>
          {/* Pulse rings */}
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-30" />
        </div>
        
        {/* Main heading */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            How Guardian Alert Protects You
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Guardian Alert monitors for natural disasters 24/7 using AI. No manual activation needed.
          </p>
        </div>

        {/* Feature cards */}
        <div className="w-full space-y-3">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="p-4 border border-border bg-card hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Privacy reassurance */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>Guardian Alert only listens for emergency sounds. We don't record or store any audio.</span>
        </div>

        {/* Continue button */}
        <Button 
          variant="guardian" 
          size="xl" 
          className="w-full mt-2"
          onClick={() => navigate("/onboarding/disability")}
        >
          I Understand →
        </Button>
      </div>
    </div>
  );
};

export default HowItWorks;
