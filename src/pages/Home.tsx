import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, CheckCircle, AlertTriangle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import VisualAlert from "@/components/VisualAlert";
import AudioAlert from "@/components/AudioAlert";

const Home = () => {
  const navigate = useNavigate();
  const [isComplete, setIsComplete] = useState(false);
  const [showVisualAlert, setShowVisualAlert] = useState(false);
  const [showAudioAlert, setShowAudioAlert] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem("guardian_data");
    if (!data) {
      navigate("/");
      return;
    }
    
    const parsed = JSON.parse(data);
    if (parsed.onboardingComplete) {
      setIsComplete(true);
    }
  }, [navigate]);

  if (!isComplete) return null;

  return (
    <>
      {showVisualAlert && (
        <VisualAlert 
          emergencyType="fire" 
          onDismiss={() => setShowVisualAlert(false)} 
        />
      )}
      
      {showAudioAlert && (
        <AudioAlert 
          emergencyType="fire" 
          onDismiss={() => setShowAudioAlert(false)} 
        />
      )}
      
      <div className="guardian-container items-center justify-center text-center">
        <div className="flex flex-col items-center gap-6 max-w-sm">
          <div className="w-24 h-24 rounded-full bg-[hsl(var(--guardian-success-light))] flex items-center justify-center animate-in zoom-in duration-500">
            <CheckCircle className="w-12 h-12 text-[hsl(var(--guardian-success))]" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Setup complete!
            </h1>
            <p className="guardian-subtext text-lg">
              You're protected.
            </p>
          </div>

          <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Guardian Alert Active</span>
          </div>

          <div className="flex flex-col gap-3 mt-8 w-full">
            <Button 
              variant="destructive"
              className="gap-2"
              onClick={() => setShowVisualAlert(true)}
            >
              <AlertTriangle className="w-4 h-4" />
              Test Visual Alert (Deaf)
            </Button>
            
            <Button 
              variant="destructive"
              className="gap-2"
              onClick={() => setShowAudioAlert(true)}
            >
              <Volume2 className="w-4 h-4" />
              Test Audio Alert (Blind)
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
