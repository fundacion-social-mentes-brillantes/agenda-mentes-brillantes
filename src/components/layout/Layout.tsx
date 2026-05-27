import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  Calendar,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  Video,
  X
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { authService } from "../../services/authService";
import type { EventType } from "../../types/event";
import type { AppTheme } from "../../types/theme";

export type PageType = "dashboard" | "calendar" | "day" | "event-form" | "settings";

interface LayoutProps {
  children: ReactNode;
  activePage: PageType;
  setActivePage: (page: PageType) => void;
  onQuickCreate: (type: EventType) => void;
}

interface NavItem {
  id: PageType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Hoy", icon: Home },
  { id: "calendar", label: "Calendario", icon: Calendar },
  { id: "day", label: "Agenda", icon: ListChecks },
  { id: "settings", label: "Ajustes", icon: Settings }
];

const quickItems: { type: EventType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { type: "other", label: "Evento rapido", icon: Plus },
  { type: "reminder", label: "Recordatorio", icon: Bell },
  { type: "meeting", label: "Reunion", icon: Video },
  { type: "task", label: "Tarea", icon: ListChecks },
  { type: "session", label: "Sesion", icon: Sparkles }
];

export function Layout({ children, activePage, setActivePage, onQuickCreate }: LayoutProps) {
  const { profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    if (profile?.theme && profile.theme !== theme) {
      setTheme(profile.theme);
    }
  }, [profile?.theme]);

  const handleThemeChange = async (nextTheme: AppTheme) => {
    setTheme(nextTheme);
    if (profile?.uid) {
      try {
        await authService.updateUserTheme(profile.uid, nextTheme);
        await refreshProfile();
      } catch (error) {
        console.error("Error saving theme:", error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleQuick = (type: EventType) => {
    setQuickOpen(false);
    setSidebarOpen(false);
    onQuickCreate(type);
  };

  return (
    <div className="app-shell flex min-h-screen flex-col text-app-strong md:flex-row">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-app-soft bg-app-panel px-5 py-3 backdrop-blur-xl md:hidden">
        <BrandBlock compact />
        <div className="flex items-center gap-2">
          <ThemeButton theme={theme} onChange={handleThemeChange} compact />
          <button type="button" onClick={() => setSidebarOpen((value) => !value)} className="rounded-xl border border-app-soft bg-app-soft p-2 text-app-muted">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {sidebarOpen && <button type="button" aria-label="Cerrar menu" className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col justify-between border-r border-app-soft bg-app-panel p-5 shadow-2xl backdrop-blur-xl transition-transform duration-300 md:sticky md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-7">
          <BrandBlock />

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActivePage(item.id);
                    setSidebarOpen(false);
                    setQuickOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-extrabold transition ${
                    active ? "bg-app-soft text-app-accent" : "text-app-muted hover:bg-app-soft hover:text-app-strong"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="relative">
            <button type="button" onClick={() => setQuickOpen((value) => !value)} className="btn-primary w-full">
              <Plus size={18} />
              Nuevo
            </button>
            {quickOpen && (
              <QuickCreateMenu className="absolute left-0 right-0 top-14 z-20" onSelect={handleQuick} />
            )}
          </div>
        </div>

        <div className="space-y-4 border-t border-app-soft pt-4">
          <ThemeSelector theme={theme} onChange={handleThemeChange} />
          <UserSummary />
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10">
            <LogOut size={18} />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <main className="app-scrollbar min-h-0 flex-1 overflow-y-auto pb-24 md:max-h-screen md:pb-0">
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-app-soft bg-app-panel px-3 py-2 shadow-2xl backdrop-blur-xl md:hidden">
        {navItems.slice(0, 2).map((item) => (
          <MobileNavItem key={item.id} item={item} active={activePage === item.id} onClick={() => setActivePage(item.id)} />
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setQuickOpen((value) => !value)}
            className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full border-4 border-app bg-app-accent text-slate-950 shadow-xl transition active:scale-95"
            aria-label="Crear"
          >
            <Plus size={26} />
          </button>
          {quickOpen && <QuickCreateMenu className="fixed bottom-20 left-4 right-4 z-50" onSelect={handleQuick} />}
        </div>

        {navItems.slice(2).map((item) => (
          <MobileNavItem key={item.id} item={item} active={activePage === item.id} onClick={() => setActivePage(item.id)} />
        ))}
      </nav>
    </div>
  );
}

function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "border-b border-app-soft pb-5"}`}>
      <img src="/brand/logo-gemb-icon.png" alt="Agenda Mentes Brillantes" className={`${compact ? "h-9 w-9" : "h-12 w-12"} rounded-2xl object-cover shadow-lg`} />
      <div className="min-w-0">
        <h1 className={`${compact ? "text-sm" : "text-base"} m-0 truncate font-black leading-tight text-app-strong`}>Agenda Mentes Brillantes</h1>
        {!compact && <p className="m-0 mt-1 text-xs font-semibold text-app-faint">Gimnasio Emocional</p>}
      </div>
    </div>
  );
}

function ThemeButton({ theme, onChange, compact = false }: { theme: AppTheme; onChange: (theme: AppTheme) => void; compact?: boolean }) {
  const next = theme === "dark" ? "pink" : "dark";
  return (
    <button type="button" onClick={() => onChange(next)} className={`btn-secondary ${compact ? "min-h-10 px-3" : ""}`}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {!compact && <span>{theme === "dark" ? "Pink Brillante" : "Noche Dorada"}</span>}
    </button>
  );
}

function ThemeSelector({ theme, onChange }: { theme: AppTheme; onChange: (theme: AppTheme) => void }) {
  return (
    <div className="rounded-3xl border border-app-soft bg-app-soft p-2">
      <p className="section-label mb-2 px-2">Tema visual</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onChange("dark")} className={`rounded-2xl px-3 py-2 text-xs font-black ${theme === "dark" ? "bg-app-panel text-app-accent" : "text-app-faint"}`}>
          Noche Dorada
        </button>
        <button type="button" onClick={() => onChange("pink")} className={`rounded-2xl px-3 py-2 text-xs font-black ${theme === "pink" ? "bg-app-panel text-app-accent" : "text-app-faint"}`}>
          Pink Brillante
        </button>
      </div>
    </div>
  );
}

function UserSummary() {
  const { profile } = useAuth();
  const initials = getInitials(profile?.name || profile?.email || "MB");

  return (
    <div className="flex items-center gap-3 rounded-3xl border border-app-soft bg-app-soft p-3">
      {profile?.photoURL ? (
        <img src={profile.photoURL} alt={profile.name} className="h-11 w-11 rounded-full object-cover" />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: profile?.color || "#d7b46a" }}>
          {profile?.name || profile?.email ? initials : <UserRound size={18} />}
        </div>
      )}
      <div className="min-w-0">
        <p className="m-0 truncate text-sm font-black text-app-strong">{profile?.name || "Usuario"}</p>
        <p className="m-0 truncate text-xs font-semibold text-app-faint">{profile?.email || "Agenda"}</p>
      </div>
    </div>
  );
}

function QuickCreateMenu({ className, onSelect }: { className?: string; onSelect: (type: EventType) => void }) {
  return (
    <div className={`glass-panel rounded-3xl p-2 ${className || ""}`}>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-5 md:grid-cols-1">
        {quickItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onSelect(item.type)}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black text-app-muted hover:bg-app-soft hover:text-app-strong"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-soft text-app-accent">
                <Icon size={17} />
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileNavItem({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={onClick} className={`flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-1 text-[10px] font-black ${active ? "text-app-accent" : "text-app-faint"}`}>
      <Icon size={20} />
      <span>{item.label}</span>
    </button>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
