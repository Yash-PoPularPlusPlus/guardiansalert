import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Check, ShieldCheck } from "lucide-react";

const HowItWorks = () => {
  const navigate = useNavigate();

  const features = [
    { text: "Always listening - no need to activate" },
    { text: "Instant personalized alerts" },
    { text: "Automatic family notification" },
  ];

  return (
    <div className="guardian-container items-center justify-center text-center px-6">
      <div className="flex flex-col items-center gap-8 max-w-sm">
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
          <p className="text-lg font-medium text-primary">
            Guardian Alert listens for danger 24/7
          </p>
        </div>

        {/* Explanation text */}
        <p className="text-muted-foreground leading-relaxed">
          Using AI, we continuously monitor for fire alarms and emergency sounds. 
          When detected, you'll get an instant alert in the format that works best for you.
        </p>

        {/* Feature bullets */}
        <div className="w-full space-y-3">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="flex items-center gap-3 bg-card rounded-xl p-4 border border-border"
            >
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-foreground text-left">{feature.text}</span>
            </div>
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
          className="w-full mt-4"
          onClick={() => navigate("/onboarding/disability")}
        >
          I Understand →
        </Button>
      </div>
    </div>
  );
};

export default HowItWorks;
