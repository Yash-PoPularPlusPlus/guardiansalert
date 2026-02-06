import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, FileText, CheckCircle, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  getDetectionLog, 
  type DetectionLogEntry 
} from "@/utils/detectionLog";
import { getEmergencyContacts } from "@/hooks/useSmsNotification";

type FilterType = "all" | "automatic" | "manual";

const Activity = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>("all");
  const [activityLog, setActivityLog] = useState<DetectionLogEntry[]>([]);
  const [contactCount, setContactCount] = useState(0);

  useEffect(() => {
    setActivityLog(getDetectionLog());
    setContactCount(getEmergencyContacts().length);
  }, []);

  const filteredLog = activityLog.filter(entry => {
    if (filter === "all") return true;
    return entry.source === filter;
  });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString([], { 
      weekday: "short", 
      month: "short", 
      day: "numeric" 
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: "numeric", 
      minute: "2-digit" 
    });
  };

  const getEventIcon = (source: DetectionLogEntry["source"]) => {
    if (source === "automatic") {
      return <Flame className="w-5 h-5 text-destructive" />;
    }
    return <FileText className="w-5 h-5 text-primary" />;
  };

  const getEventDescription = (entry: DetectionLogEntry) => {
    const typeLabels = {
      fire: "Fire alarm",
      earthquake: "Earthquake alert",
      flood: "Flood warning"
    };
    
    if (entry.source === "automatic") {
      return `${typeLabels[entry.type]} detected`;
    }
    return `${typeLabels[entry.type]} reported manually`;
  };

  const getActionTaken = (entry: DetectionLogEntry) => {
    if (contactCount > 0) {
      return `Alert triggered, SMS sent to ${contactCount} contact${contactCount !== 1 ? 's' : ''}`;
    }
    return "Alert triggered";
  };

  // Group entries by date
  const groupedEntries = filteredLog.reduce((groups, entry) => {
    const dateKey = formatDate(entry.timestamp);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(entry);
    return groups;
  }, {} as Record<string, DetectionLogEntry[]>);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/home")}
          className="shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">Activity History</h1>
      </header>

      {/* Filter Tabs */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="flex-1"
          >
            All
          </Button>
          <Button
            variant={filter === "automatic" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("automatic")}
            className="flex-1"
          >
            🔥 Fire Alarms
          </Button>
          <Button
            variant={filter === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("manual")}
            className="flex-1"
          >
            📝 Manual
          </Button>
        </div>
      </div>

      {/* Activity List */}
      <main className="flex-1 px-4 py-4 overflow-y-auto">
        {filteredLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No activity yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Guardian Alert is monitoring for your safety. Any detected emergencies will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEntries).map(([date, entries]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {date}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Entries for this date */}
                <div className="space-y-3">
                  {entries.map((entry, index) => (
                    <Card key={`${entry.timestamp}-${index}`} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          {/* Icon */}
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            {getEventIcon(entry.source)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-sm font-semibold text-foreground">
                                  {getEventDescription(entry)}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {formatTime(entry.timestamp)}
                                </p>
                              </div>
                              <Badge 
                                variant="secondary" 
                                className="shrink-0 bg-primary/10 text-primary border-0"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Resolved
                              </Badge>
                            </div>

                            {/* Action taken */}
                            <div className="mt-2 pt-2 border-t border-border">
                              <p className="text-xs text-muted-foreground">
                                {getActionTaken(entry)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Activity;
