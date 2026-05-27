import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { 
  Home, 
  Calendar, 
  Plus, 
  Sparkles, 
  Settings, 
  LogOut, 
  Sun, 
  Moon,
  Menu,
  X,
  User as UserIcon
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { authService } from "../../services/authService";

export type PageType = "dashboard" | "calendar" | "day" | "event-form" | "settings";

interface LayoutProps {
  children: ReactNode;
  activePage: PageType;
  setActivePage: (page: PageType) => void;
}

interface NavItem {
  id: PageType;
  label: string;
  icon: React.ComponentType<any>;
  isAction?: boolean;
}

export function Layout({ children, activePage, setActivePage }: LayoutProps) {
  const { profile } = useAuth();
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("theme") === "dark" || 
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Hoy", icon: Home },
    { id: "calendar", label: "Calendario", icon: Calendar },
    { id: "event-form", label: "Nuevo", icon: Plus, isAction: true },
    { id: "day", label: "Sesiones", icon: Sparkles },
    { id: "settings", label: "Ajustes", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/60 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm">
            MB
          </div>
          <span className="font-bold text-slate-900 dark:text-white tracking-wide">Mentes Brillantes</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Backdrop for mobile menu */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar for Desktop & Mobile drawer */}
      <aside className={`
        fixed md:sticky top-0 left-0 bottom-0 z-50
        w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800/60
        flex flex-col justify-between p-6
        transform transition-transform duration-300 md:transform-none
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="flex flex-col gap-8">
          {/* Logo / Header */}
          <div className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-800/40">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-violet-500/20">
              MB
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white leading-tight tracking-tight m-0 text-base">Mentes Brillantes</h1>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Gimnasio Emocional</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              
              if (item.isAction) {
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActivePage(item.id);
                      setSidebarOpen(false);
                    }}
                    className="mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 active:scale-98 transition-all"
                  >
                    <Icon size={16} />
                    <span>Nuevo Evento</span>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePage(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400" 
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon size={18} className={isActive ? "stroke-[2.5px]" : "stroke-[1.8px]"} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout footer */}
        <div className="flex flex-col gap-4 border-t border-slate-50 dark:border-slate-800/40 pt-4">
          {/* Quick theme toggle for desktop */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="hidden md:flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span>Modo {darkMode ? "Claro" : "Oscuro"}</span>
          </button>

          <div className="flex items-center gap-3 px-2 py-1">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold uppercase text-sm border-2 border-white dark:border-slate-800 shadow-sm"
              style={{ backgroundColor: profile?.color || "#8b5cf6" }}
            >
              {profile?.name ? profile.name.slice(0, 2) : <UserIcon size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-900 dark:text-white truncate m-0">{profile?.name || "Cargando..."}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate m-0 capitalize">{profile?.role || "miembro"}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 transition-all font-medium"
          >
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 overflow-y-auto max-h-screen">
        <div className="max-w-6xl w-full mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800/60 px-4 py-2 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          if (item.isAction) {
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className="w-12 h-12 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/30 active:scale-90 transition-all -translate-y-4 border-4 border-slate-50 dark:border-slate-950"
                aria-label="Nuevo evento"
              >
                <Plus size={24} className="stroke-[2.5px]" />
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                isActive 
                  ? "text-violet-600 dark:text-violet-400" 
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <Icon size={20} className={isActive ? "stroke-[2.3px]" : "stroke-[1.8px]"} />
              <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}
