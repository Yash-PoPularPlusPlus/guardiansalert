import { AlertTriangle, Wifi, WifiOff, Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StatusBannerProps {
  type: "mic-denied" | "offline";
  onDismiss?: () => void;
}

const StatusBanner = ({ type, onDismiss }: StatusBannerProps) => {
  if (type === "mic-denied") {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mx-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
            <MicOff className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Action Required
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Microphone access is required for emergency detection. 
              Click the lock icon in your browser's address bar → Site settings → Allow microphone.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => window.location.reload()}
            >
              Retry Permission
            </Button>
          </div>
          {onDismiss && (
            <button 
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (type === "offline") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mx-4 mb-4">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-amber-500" />
          <div className="flex-1">
            <span className="text-sm font-medium text-amber-600">
              Offline – Protection Limited
            </span>
            <p className="text-xs text-muted-foreground">
              SMS alerts unavailable until connection is restored.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default StatusBanner;
