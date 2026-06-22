import { LogOut, Smartphone, UserRound, Users } from "lucide-react";
import { Card } from "../components/ui/Card";
import { useTheme } from "../hooks/useTheme";
import { authService } from "../services/authService";
import type { AppTheme } from "../types/theme";
import type { UserProfile } from "../types/user";

interface SettingsPageProps {
  profile: UserProfile;
  onThemeChange: (theme: AppTheme) => Promise<void>;
  onGoToWorkspaces: () => void;
}

export default function SettingsPage({ profile, onThemeChange, onGoToWorkspaces }: SettingsPageProps) {
  const { theme } = useTheme();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="section-label mb-2">Preferencias</p>
        <h2 className="m-0 text-3xl font-black tracking-tight text-app-strong">Ajustes</h2>
        <p className="mt-2 text-sm text-app-muted">Personaliza tu agenda y revisa tu perfil.</p>
      </div>

      <Card className="flex items-center justify-center">
        <img src={theme === "pink" ? "/brand/logo-gemb-blue-small.jpeg" : "/brand/logo-gemb-gold-small.jpeg"} alt="Gimnasio Emocional Mentes Brillantes" className="max-h-28 w-full object-contain" />
      </Card>

      <Card className="flex flex-col gap-5">
        <h3 className="m-0 text-lg font-black text-app-strong">Mi perfil</h3>
        <div className="flex items-center gap-4">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt={profile.name} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white" style={{ backgroundColor: profile.color || "#d7b46a" }}>
              {profile.name ? profile.name.slice(0, 2).toUpperCase() : <UserRound size={24} />}
            </div>
          )}
          <div className="min-w-0">
            <p className="m-0 truncate text-xl font-black text-app-strong">{profile.name}</p>
            <p className="m-0 mt-1 truncate text-sm text-app-muted">{profile.email}</p>
            <p className="mt-2 inline-flex rounded-full border border-app-soft bg-app-soft px-3 py-1 text-xs font-black text-app-accent">Rol: {profile.role}</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h3 className="m-0 text-lg font-black text-app-strong">Tema visual</h3>
          <p className="mt-1 text-sm text-app-muted">Elige como quieres ver la agenda en este dispositivo.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ThemeChoice active={theme === "dark"} title="Noche Dorada" description="Azul noche, negro suave y detalles dorados." onClick={() => onThemeChange("dark")} />
          <ThemeChoice active={theme === "pink"} title="Pink Brillante" description="Rosa suave, lavanda y acentos elegantes." onClick={() => onThemeChange("pink")} />
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-app-accent" />
          <h3 className="m-0 text-lg font-black text-app-strong">Agendas y personas</h3>
        </div>
        <p className="m-0 text-sm leading-relaxed text-app-muted">
          Crea agendas compartidas e invita a otras personas para trabajar juntas. Cada quien tiene además su agenda personal.
        </p>
        <button type="button" onClick={onGoToWorkspaces} className="btn-secondary">
          <Users size={16} />
          Administrar agendas
        </button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone size={18} className="text-app-accent" />
          <h3 className="m-0 text-lg font-black text-app-strong">Instalar en el celular</h3>
        </div>
        <p className="m-0 text-sm leading-relaxed text-app-muted">
          En Android: abre el menú del navegador y elige "Instalar app" o "Agregar a pantalla de inicio". En iPhone (Safari): toca Compartir y luego "Agregar a inicio". Quedará como una app más.
        </p>
      </Card>

      <button type="button" onClick={() => authService.logout()} className="btn-danger-soft">
        <LogOut size={16} />
        Cerrar sesion
      </button>
    </div>
  );
}

function ThemeChoice({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-4 text-left transition ${active ? "border-app-strong bg-app-soft" : "border-app-soft bg-app-panel hover:bg-app-soft"}`}
    >
      <p className="m-0 text-sm font-black text-app-strong">{title}</p>
      <p className="m-0 mt-1 text-xs leading-relaxed text-app-muted">{description}</p>
    </button>
  );
}
