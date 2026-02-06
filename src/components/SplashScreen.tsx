import { useEffect, useState } from "react";
import { Shield, Radio } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

const SplashScreen = ({ onComplete, duration = 1500 }: SplashScreenProps) => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, duration - 300);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  return (
    <div 
      className={`
        fixed inset-0 z-[100] flex flex-col items-center justify-center
        transition-opacity duration-300
        ${isFading ? "opacity-0" : "opacity-100"}
      `}
      style={{
        background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)",
      }}
    >
      {/* Logo */}
      <div className="relative mb-6">
        <div 
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-400/20 to-blue-600/20 flex items-center justify-center backdrop-blur-sm border border-white/10 animate-pulse"
          style={{
            boxShadow: "0 0 60px rgba(59, 130, 246, 0.4), 0 0 30px rgba(59, 130, 246, 0.2)",
            animationDuration: "2s",
          }}
        >
          <div className="relative">
            <Shield className="w-12 h-12 text-white" />
            <Radio className="w-5 h-5 text-blue-300 absolute -right-1 -top-1" />
          </div>
        </div>
      </div>

      {/* App Name */}
      <h1 className="text-3xl font-bold text-white tracking-wide mb-8">
        Guardian Alert
      </h1>

      {/* Loading Spinner */}
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-sm text-slate-400">
          Initializing AI Protection...
        </span>
      </div>
    </div>
  );
};

export default SplashScreen;
