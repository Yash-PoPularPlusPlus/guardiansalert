import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="guardian-container items-center justify-center text-center">
      <div className="flex flex-col items-center gap-6 max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Guardian Alert
          </h1>
          <p className="guardian-subtext text-lg">
            Personalized emergency alerts. No one left behind.
          </p>
        </div>

        <Button 
          variant="guardian" 
          size="xl" 
          className="w-full mt-8"
          onClick={() => navigate("/onboarding/how-it-works")}
        >
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default Welcome;
