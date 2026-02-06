import { AlertTriangle, WifiOff, Radio } from "lucide-react";

interface StatusBannerProps {
  type: "sensor-waiting" | "offline";
  onDismiss?: () => void;
}

const StatusBanner = ({ type }: StatusBannerProps) => {
  if (type === "sensor-waiting") {
    return (
      <div className="bg-muted/50 border border-border rounded-lg p-3 mx-4 mb-4">
        <div className="flex items-center gap-3">
          <Radio className="w-5 h-5 text-muted-foreground animate-pulse" />
          <div className="flex-1">
            <span className="text-sm font-medium text-muted-foreground">
              Waiting for sensor data...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "offline") {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mx-4 mb-4">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-destructive" />
          <div className="flex-1">
            <span className="text-sm font-medium text-destructive">
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
