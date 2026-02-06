import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Radio, CheckCircle } from "lucide-react";

const Welcome = () => {
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

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center px-6 py-8 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)",
      }}
    >
      {/* Subtle pattern overlay */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Main content */}
      <div className="flex flex-col items-center text-center z-10 animate-fade-in max-w-md w-full">
        
        {/* App Icon/Logo */}
        <div className="relative mb-8">
          <div 
            className="w-[100px] h-[100px] rounded-3xl bg-gradient-to-br from-blue-400/20 to-blue-600/20 flex items-center justify-center backdrop-blur-sm border border-white/10"
            style={{
              boxShadow: "0 0 60px rgba(59, 130, 246, 0.3), 0 0 30px rgba(59, 130, 246, 0.2)",
            }}
          >
            <div className="relative">
              <Shield className="w-12 h-12 text-white animate-pulse" style={{ animationDuration: "3s" }} />
              <Radio className="w-5 h-5 text-blue-300 absolute -right-1 -top-1" />
            </div>
          </div>
        </div>

        {/* App Name */}
        <h1 
          className="text-[42px] font-bold text-white tracking-wide"
          style={{ letterSpacing: "0.02em" }}
        >
          Guardian Alert
        </h1>

        {/* Tagline */}
        <p className="text-xl text-slate-300 mt-2">
          Your 24/7 Emergency Guardian
        </p>

        {/* Description */}
        <p className="text-base text-slate-400 mt-4 max-w-[400px] leading-relaxed">
          AI-powered natural disaster detection for people with disabilities
        </p>

        {/* Trust Indicator */}
        <div className="flex items-center gap-2 mt-6 text-sm text-slate-400">
          <CheckCircle className="w-4 h-4 text-blue-400" />
          <span>Protecting lives with intelligent monitoring</span>
        </div>

        {/* CTA Button */}
        <Button 
          className="w-full max-w-[400px] mt-8 py-6 text-lg font-bold rounded-lg transition-all duration-200 hover:scale-[1.02]"
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            boxShadow: "0 4px 20px rgba(59, 130, 246, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)",
          }}
          onClick={() => navigate("/onboarding/how-it-works")}
        >
          Get Protected
        </Button>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <p className="text-xs text-slate-500">
          Trusted safety monitoring
        </p>
      </div>
    </div>
  );
};

export default Welcome;
