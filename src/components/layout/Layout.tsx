import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { ReactNode } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  HeartHandshake,
  Home,
  ListChecks,
  Lock,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { authService } from "../../services/authService";
import type { AppTheme } from "../../types/theme";
import type { WorkspaceWithRole } from "../../types/workspace";

export type PageType = "dashboard" | "calendar" | "coach" | "day" | "event-form" | "settings" | "workspaces";

interface LayoutProps {
  children: ReactNode;
  activePage: PageType;
  setActivePage: (page: PageType) => void;
  onCreate: () => void;
  workspaces: WorkspaceWithRole[];
  activeWorkspace: WorkspaceWithRole | null;
  onSelectWorkspace: (id: string) => void;
}

interface NavItem {
  id: PageType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Hoy", icon: Home },
  { id: "calendar", label: "Calendario", icon: Calendar },
  { id: "coach", label: "Sesiones coach", icon: HeartHandshake },
  { id: "day", label: "Agenda", icon: ListChecks },
  { id: "workspaces", label: "Agendas", icon: Users },
  { id: "settings", label: "Ajustes", icon: Settings }
];

const mobileNavItems: NavItem[] = [
  { id: "dashboard", label: "Hoy", icon: Home },
  { id: "calendar", label: "Calendario", icon: Calendar },
  { id: "coach", label: "Coach", icon: HeartHandshake },
  { id: "day", label: "Agenda", icon: ListChecks }
];

export function Layout({ children, activePage, setActivePage, onCreate, workspaces, activeWorkspace, onSelectWorkspace }: LayoutProps) {
  const { profile, profileSyncWarning, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const goTo = (page: PageType) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  const handleSelectWorkspace = (id: string) => {
    onSelectWorkspace(id);
    setSidebarOpen(false);
  };

  return (
    <div className="app-shell flex min-h-screen flex-col text-app-strong md:flex-row">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-app-soft bg-app-panel px-4 py-3 backdrop-blur-xl md:hidden">
        <BrandBlock compact />
        <div className="flex items-center gap-2">
          <WorkspaceSwitcher workspaces={workspaces} activeWorkspace={activeWorkspace} onSelect={handleSelectWorkspace} onManage={() => goTo("workspaces")} compact />
          <button type="button" onClick={() => setSidebarOpen((value) => !value)} className="rounded-xl border border-app-soft bg-app-soft p-2 text-app-muted">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {sidebarOpen && <button type="button" aria-label="Cerrar menu" className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col justify-between overflow-y-auto border-r border-app-soft bg-app-panel p-5 shadow-2xl backdrop-blur-xl transition-transform duration-300 md:sticky md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-6">
          <BrandBlock />

          <div className="hidden md:block">
            <WorkspaceSwitcher workspaces={workspaces} activeWorkspace={activeWorkspace} onSelect={handleSelectWorkspace} onManage={() => goTo("workspaces")} />
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.id)}
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

          <button
            type="button"
            onClick={() => {
              onCreate();
              setSidebarOpen(false);
            }}
            className="btn-primary w-full"
          >
            <Plus size={18} />
            Nuevo evento
          </button>
        </div>

        <div className="space-y-4 border-t border-app-soft pt-4">
          <ThemeSelector theme={theme} onChange={handleThemeChange} />
          <UserSummary />
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10">
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="app-scrollbar min-h-0 flex-1 overflow-y-auto pb-24 md:max-h-screen md:pb-0">
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {profileSyncWarning && (
            <div className="mb-5 rounded-3xl border border-app-strong bg-app-soft px-4 py-3 text-sm font-bold text-app-muted shadow-sm">
              <span className="text-app-accent">Entraste correctamente.</span> Estamos sincronizando tus datos. {profileSyncWarning}
            </div>
          )}
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-app-soft bg-app-panel px-2 py-2 shadow-2xl backdrop-blur-xl md:hidden">
        {mobileNavItems.slice(0, 2).map((item) => (
          <MobileNavItem key={item.id} item={item} active={activePage === item.id} onClick={() => setActivePage(item.id)} />
        ))}

        <div className="relative flex min-w-12 flex-col items-center gap-1 text-[10px] font-black text-app-accent">
          <button
            type="button"
            onClick={onCreate}
            className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full border-4 border-app bg-app-accent text-slate-950 shadow-xl transition active:scale-95"
            aria-label="Crear evento"
          >
            <Plus size={26} />
          </button>
          <span className="-mt-5">Nuevo</span>
        </div>

        {mobileNavItems.slice(2).map((item) => (
          <MobileNavItem key={item.id} item={item} active={activePage === item.id} onClick={() => setActivePage(item.id)} />
        ))}
      </nav>
    </div>
  );
}

function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onSelect,
  onManage,
  compact = false
}: {
  workspaces: WorkspaceWithRole[];
  activeWorkspace: WorkspaceWithRole | null;
  onSelect: (id: string) => void;
  onManage: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const label = activeWorkspace?.name || "Mi agenda";
  const dotColor = activeWorkspace?.color || "#d7b46a";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-2xl border border-app-soft bg-app-soft px-3 font-black text-app-strong ${compact ? "min-h-10 max-w-[42vw] text-xs" : "w-full min-h-11 text-sm"}`}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
        <span className="truncate">{label}</span>
        <ChevronDown size={15} className="ml-auto shrink-0 text-app-faint" />
      </button>

      {open && (
        <div className={`glass-panel absolute z-50 mt-2 rounded-2xl p-2 ${compact ? "right-0 w-64" : "left-0 right-0"}`}>
          <p className="section-label px-2 py-1">Tus agendas</p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  onSelect(ws.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-app-muted hover:bg-app-soft hover:text-app-strong"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ws.color || "#d7b46a" }} />
                <span className="truncate">{ws.name}</span>
                {ws.kind === "personal" && <Lock size={12} className="text-app-faint" />}
                {activeWorkspace?.id === ws.id && <Check size={15} className="ml-auto text-app-accent" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onManage();
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-app-soft px-3 py-2 text-left text-sm font-black text-app-accent hover:bg-app-soft"
          >
            <Users size={15} />
            Crear o compartir agenda
          </button>
        </div>
      )}
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

function ThemeSelector({ theme, onChange }: { theme: AppTheme; onChange: (theme: AppTheme) => void }) {
  return (
    <div className="rounded-3xl border border-app-soft bg-app-soft p-2">
      <p className="section-label mb-2 px-2">Tema visual</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onChange("dark")} className={`flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-black ${theme === "dark" ? "bg-app-panel text-app-accent" : "text-app-faint"}`}>
          <Moon size={14} /> Noche
        </button>
        <button type="button" onClick={() => onChange("pink")} className={`flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-black ${theme === "pink" ? "bg-app-panel text-app-accent" : "text-app-faint"}`}>
          <Sun size={14} /> Pink
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

function MobileNavItem({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={onClick} className={`flex min-w-12 flex-col items-center gap-1 rounded-2xl px-2 py-1 text-[10px] font-black ${active ? "text-app-accent" : "text-app-faint"}`}>
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
