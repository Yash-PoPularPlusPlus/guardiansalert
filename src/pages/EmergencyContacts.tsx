import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface Contact {
  name: string;
  phone: string;
}

const EmergencyContacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([
    { name: "", phone: "" },
    { name: "", phone: "" },
  ]);

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

  // Load saved contacts on mount
  useEffect(() => {
    const saved = localStorage.getItem("guardian_contacts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setContacts(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved contacts");
      }
    }
  }, []);

  // Save contacts whenever they change
  const saveContacts = (updatedContacts: Contact[]) => {
    localStorage.setItem("guardian_contacts", JSON.stringify(updatedContacts));
  };

  const addContact = () => {
    if (contacts.length < 3) {
      const updated = [...contacts, { name: "", phone: "" }];
      setContacts(updated);
      saveContacts(updated);
    }
  };

  const removeContact = (index: number) => {
    if (contacts.length > 1) {
      const updated = contacts.filter((_, i) => i !== index);
      setContacts(updated);
      saveContacts(updated);
    }
  };

  const updateContact = (index: number, field: keyof Contact, value: string) => {
    const updated = [...contacts];
    updated[index][field] = value;
    setContacts(updated);
    saveContacts(updated);
  };

  const hasValidContact = contacts.some(
    (c) => c.name.trim() !== "" && c.phone.trim() !== ""
  );

  const handleComplete = () => {
    const validContacts = contacts.filter(
      (c) => c.name.trim() !== "" && c.phone.trim() !== ""
    );
    
    const disabilities = localStorage.getItem("guardian_disabilities");
    
    const data = {
      disabilities: disabilities ? JSON.parse(disabilities) : [],
      contacts: validContacts,
      onboardingComplete: true,
    };
    
    localStorage.setItem("guardian_data", JSON.stringify(data));
    navigate("/home");
  };

  return (
    <div className="guardian-container">
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <h1 className="guardian-heading">Who should we notify in an emergency?</h1>
          <p className="guardian-subtext">Add up to 3 contacts</p>
        </div>

        <div className="space-y-4">
          {contacts.map((contact, index) => (
            <div 
              key={index} 
              className="p-4 rounded-xl border border-border bg-card space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Contact {index + 1}
                </span>
                {contacts.length > 1 && (
                  <button
                    onClick={() => removeContact(index)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove contact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`name-${index}`}>Name</Label>
                  <Input
                    id={`name-${index}`}
                    placeholder="e.g. Mom, John"
                    value={contact.name}
                    onChange={(e) => updateContact(index, "name", e.target.value)}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor={`phone-${index}`}>Phone</Label>
                  <Input
                    id={`phone-${index}`}
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={contact.phone}
                    onChange={(e) => updateContact(index, "phone", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {contacts.length < 3 && (
          <button
            onClick={addContact}
            className="flex items-center gap-2 text-primary font-medium hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add Another Contact
          </button>
        )}
      </div>

      <div className="pt-6">
        <Button 
          variant="guardian" 
          size="xl" 
          className="w-full"
          disabled={!hasValidContact}
          onClick={handleComplete}
        >
          Complete Setup
        </Button>
      </div>
    </div>
  );
};

export default EmergencyContacts;
