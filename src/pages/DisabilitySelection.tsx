import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DisabilityOption {
  id: string;
  icon: string;
  label: string;
}

const disabilityOptions: DisabilityOption[] = [
  { id: "deaf", icon: "🔇", label: "Deaf or hard of hearing" },
  { id: "blind", icon: "👁️", label: "Blind or low vision" },
  { id: "nonverbal", icon: "🗣️", label: "Cannot speak" },
  { id: "mobility", icon: "♿", label: "Mobility limitations" },
  { id: "cognitive", icon: "🧠", label: "Cognitive disability" },
  { id: "multiple", icon: "✅", label: "Multiple disabilities" },
];

const DisabilitySelection = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = () => {
    if (selected) {
      localStorage.setItem("guardian_disability", selected);
      navigate("/onboarding/contacts");
    }
  };

  return (
    <div className="guardian-container">
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <h1 className="guardian-heading">What describes you?</h1>
          <p className="guardian-subtext">We'll customize alerts for your needs</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {disabilityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 min-h-[120px]",
                selected === option.id
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              <span className="text-3xl" role="img" aria-label={option.label}>
                {option.icon}
              </span>
              <span className={cn(
                "text-sm font-medium text-center leading-tight",
                selected === option.id ? "text-primary" : "text-foreground"
              )}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6">
        <Button 
          variant="guardian" 
          size="xl" 
          className="w-full"
          disabled={!selected}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default DisabilitySelection;
