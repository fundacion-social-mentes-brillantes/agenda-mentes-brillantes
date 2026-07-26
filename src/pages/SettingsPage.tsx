import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, LogOut, Smartphone, UserRound, Users } from "lucide-react";
import { Card } from "../components/ui/Card";
import { useTheme } from "../hooks/useTheme";
import { authService } from "../services/authService";
import { activarPush, desactivarPush, estadoPush, guardarPreferencias, leerPreferencias, pushSoportado } from "../lib/push";
import type { AppTheme } from "../types/theme";
import type { UserProfile } from "../types/user";

interface SettingsPageProps {
  profile: UserProfile;
  /** Agenda del equipo: ahí se guarda la suscripción de avisos de cada persona. */
  notifyWorkspaceId: string | null;
  onThemeChange: (theme: AppTheme) => Promise<void>;
  onGoToWorkspaces: () => void;
}

export default function SettingsPage({ profile, notifyWorkspaceId, onThemeChange, onGoToWorkspaces }: SettingsPageProps) {
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
            <img src={profile.photoURL} alt={profile.name} referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
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

      <NotificationsCard profile={profile} workspaceId={notifyWorkspaceId} />

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

function NotificationsCard({ profile, workspaceId }: { profile: UserProfile; workspaceId: string | null }) {
  const soportado = pushSoportado();
  const [permiso, setPermiso] = useState<NotificationPermission | "unsupported">(
    soportado ? Notification.permission : "unsupported"
  );
  const [suscrito, setSuscrito] = useState(false);
  const [antes, setAntes] = useState(true);
  const [resumen, setResumen] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [otroAparato, setOtroAparato] = useState(false);

  // Al abrir Ajustes: mira si este dispositivo ya está suscrito y qué avisos eligió.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!soportado) return;
      const est = await estadoPush();
      if (!vivo) return;
      setPermiso(est.permiso);
      setSuscrito(est.suscrito);
      if (workspaceId && profile.uid) {
        const prefs = await leerPreferencias(workspaceId, profile.uid);
        if (!vivo) return;
        setAntes(prefs.notifyBefore);
        setResumen(prefs.notifyDaily);
        // Solo hay UNA suscripción guardada por persona. Si la guardada es la de otro
        // aparato, aquí NO van a llegar avisos: hay que decirlo en vez de mentir.
        const esteAparato = !!est.endpoint && est.endpoint === prefs.endpoint;
        setSuscrito(est.suscrito && esteAparato);
        setOtroAparato(!!prefs.endpoint && prefs.endpoint !== est.endpoint);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [soportado, workspaceId, profile.uid]);

  const activar = async () => {
    if (!workspaceId || !profile.uid) {
      setAviso("Espera un momento a que cargue tu agenda y vuelve a intentar.");
      return;
    }
    setOcupado(true);
    setAviso(null);
    try {
      const r = await activarPush(workspaceId, profile.uid);
      if (r.ok) {
        setSuscrito(true);
        setOtroAparato(false);
        setPermiso("granted");
        // Se releen: activarPush respeta lo que la persona ya había elegido antes.
        const prefs = await leerPreferencias(workspaceId, profile.uid);
        setAntes(prefs.notifyBefore);
        setResumen(prefs.notifyDaily);
        setAviso("¡Listo! Este dispositivo ya recibirá los avisos.");
      } else {
        setAviso(r.motivo || "No pudimos activar los avisos en este dispositivo.");
        setPermiso(soportado ? Notification.permission : "unsupported");
      }
    } finally {
      setOcupado(false);
    }
  };

  const desactivar = async () => {
    if (!workspaceId || !profile.uid) return;
    setOcupado(true);
    try {
      await desactivarPush(workspaceId, profile.uid);
      setSuscrito(false);
      setAviso("Avisos desactivados en este dispositivo.");
    } finally {
      setOcupado(false);
    }
  };

  const cambiarPref = useCallback(
    async (campo: "notifyBefore" | "notifyDaily", valor: boolean) => {
      if (campo === "notifyBefore") setAntes(valor);
      else setResumen(valor);
      if (!workspaceId || !profile.uid) return;
      try {
        await guardarPreferencias(workspaceId, profile.uid, { [campo]: valor });
      } catch {
        setAviso("No pudimos guardar el cambio. Revisa tu conexión.");
      }
    },
    [workspaceId, profile.uid]
  );

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        {suscrito ? <Bell size={18} className="text-app-accent" /> : <BellOff size={18} className="text-app-accent" />}
        <h3 className="m-0 text-lg font-black text-app-strong">Avisos en el celular</h3>
      </div>
      <p className="m-0 text-sm leading-relaxed text-app-muted">
        Recibe los avisos aunque tengas la app cerrada. Por ahora llegan a <strong>un solo aparato</strong>: el último donde
        los actives.
      </p>

      {soportado && otroAparato && !suscrito && (
        <p className="m-0 rounded-2xl border border-app-soft bg-app-soft px-3 py-2 text-sm font-bold text-app-accent">
          Tus avisos están activos en otro aparato. Toca “Activar” para traerlos a este.
        </p>
      )}

      {!soportado && (
        <p className="m-0 text-sm font-bold text-app-muted">Este dispositivo o navegador no permite avisos.</p>
      )}

      {soportado && permiso === "denied" && (
        <p className="m-0 text-sm font-bold text-app-muted">
          Están bloqueados. Actívalos en los ajustes del navegador (candado junto a la dirección → Notificaciones → Permitir) y
          vuelve a intentar.
        </p>
      )}

      {soportado && suscrito && (
        <>
          <p className="m-0 inline-flex rounded-full border border-app-soft bg-app-soft px-3 py-1 text-xs font-black text-app-accent">
            Activados en este dispositivo ✓
          </p>
          <div className="space-y-2">
            <Interruptor
              activo={antes}
              titulo="15 minutos antes"
              descripcion="Un aviso justo antes de cada evento, para no llegar tarde."
              onToggle={() => void cambiarPref("notifyBefore", !antes)}
            />
            <Interruptor
              activo={resumen}
              titulo="Resumen de la mañana"
              descripcion="A las 7:00 a. m., la lista de todo lo que tienes hoy."
              onToggle={() => void cambiarPref("notifyDaily", !resumen)}
            />
          </div>
        </>
      )}

      {soportado && permiso !== "denied" && !suscrito && (
        <button type="button" onClick={() => void activar()} disabled={ocupado} className="btn-secondary">
          <Bell size={16} />
          {ocupado ? "Activando..." : "Activar avisos en este dispositivo"}
        </button>
      )}

      {soportado && suscrito && (
        <button type="button" onClick={() => void desactivar()} disabled={ocupado} className="btn-secondary">
          <BellOff size={16} />
          {ocupado ? "Un momento..." : "Desactivar en este dispositivo"}
        </button>
      )}

      {aviso && <p className="m-0 text-sm font-bold text-app-accent">{aviso}</p>}

      <p className="m-0 rounded-2xl border border-app-soft bg-app-soft px-3 py-2 text-xs leading-relaxed text-app-muted">
        <strong>En iPhone:</strong> primero agrega la app a la pantalla de inicio (Safari → Compartir → "Agregar a inicio") y
        activa los avisos desde ahí. Si la abres solo en el navegador, iPhone no los permite.
      </p>
    </Card>
  );
}

function Interruptor({
  activo,
  titulo,
  descripcion,
  onToggle
}: {
  activo: boolean;
  titulo: string;
  descripcion: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={activo}
      className={`flex w-full items-center justify-between gap-4 rounded-3xl border p-4 text-left transition ${
        activo ? "border-app-strong bg-app-soft" : "border-app-soft bg-app-panel hover:bg-app-soft"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-black text-app-strong">{titulo}</span>
        <span className="mt-1 block text-xs leading-relaxed text-app-muted">{descripcion}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${activo ? "bg-app-accent" : "bg-app-soft border border-app-soft"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${activo ? "left-[1.375rem]" : "left-0.5"}`}
        />
      </span>
    </button>
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
