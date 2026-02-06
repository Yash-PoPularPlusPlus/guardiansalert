import { useNavigate, useLocation } from "react-router-dom";
import { Shield, Clock, Settings } from "lucide-react";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/home", icon: Shield, label: "Home" },
    { path: "/activity", icon: Clock, label: "Activity" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 py-3 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              className={`
                flex flex-col items-center gap-1 min-h-[48px] min-w-[64px] px-3 py-2
                rounded-lg transition-all duration-200
                active:scale-95
                ${isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }
              `}
              onClick={() => navigate(path)}
            >
              <Icon className="w-5 h-5" />
              <span className={`text-xs ${isActive ? "font-medium" : ""}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
