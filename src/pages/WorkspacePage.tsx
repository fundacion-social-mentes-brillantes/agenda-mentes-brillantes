import { useEffect, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import {
  Check,
  Copy,
  Crown,
  Link2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  UserRound,
  Users
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { workspaceService } from "../services/workspaceService";
import type { WorkspaceMember, WorkspaceWithRole } from "../types/workspace";

interface WorkspacePageProps {
  user: FirebaseUser;
  workspaces: WorkspaceWithRole[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
}

function buildInviteLink(ws: WorkspaceWithRole): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?invite=${ws.id}&code=${ws.joinCode || ""}&name=${encodeURIComponent(ws.name)}`;
}

export default function WorkspacePage({ user, workspaces, activeWorkspaceId, onSelectWorkspace }: WorkspacePageProps) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setMessage({ type: "error", text: "Escribe un nombre para la nueva agenda." });
      return;
    }
    setCreating(true);
    setMessage(null);
    try {
      const ws = await workspaceService.createSharedWorkspace(user, newName.trim());
      setNewName("");
      onSelectWorkspace(ws.id);
      setMessage({ type: "ok", text: `Agenda "${ws.name}" creada. Ya puedes invitar personas.` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "No se pudo crear la agenda." });
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setMessage({ type: "error", text: "Pega el código de invitación completo." });
      return;
    }
    setJoining(true);
    setMessage(null);
    // Si pegan un enlace completo, intentamos extraer id + code.
    let wsId = "";
    let codeOnly = code;
    const match = joinCode.match(/invite=([^&\s]+)[^]*code=([^&\s]+)/i);
    if (match) {
      wsId = decodeURIComponent(match[1]);
      codeOnly = decodeURIComponent(match[2]).toUpperCase();
    }
    try {
      if (!wsId) {
        throw new Error("Para unirte necesitas el enlace de invitación completo. Pídele a quien te invitó que te comparta el enlace.");
      }
      const ws = await workspaceService.joinWorkspace(user, wsId, codeOnly);
      setJoinCode("");
      onSelectWorkspace(ws.id);
      setMessage({ type: "ok", text: `Te uniste a "${ws.name}".` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "No pudimos unirte. Verifica el enlace." });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <p className="section-label mb-2">Colaboración</p>
        <h2 className="m-0 text-3xl font-black tracking-tight text-app-strong">Agendas y personas</h2>
        <p className="mt-2 text-sm text-app-muted">Tienes tu agenda personal y puedes crear agendas compartidas para trabajar con otras personas.</p>
      </div>

      {message && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600" : "border-red-500/25 bg-red-500/10 text-red-500"}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-app-accent"><Plus size={18} /></span>
            <h3 className="m-0 text-lg font-black text-app-strong">Crear agenda compartida</h3>
          </div>
          <p className="m-0 text-sm text-app-muted">Por ejemplo: "Familia", "Equipo fundación" o "Sesiones mamá".</p>
          <input className="input-field" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la agenda" />
          <button type="button" onClick={handleCreate} disabled={creating} className="btn-primary w-full">
            {creating ? <Spinner className="h-5 w-5" /> : <Plus size={17} />}
            Crear agenda
          </button>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-app-accent"><Link2 size={18} /></span>
            <h3 className="m-0 text-lg font-black text-app-strong">Unirme a una agenda</h3>
          </div>
          <p className="m-0 text-sm text-app-muted">Pega aquí el enlace de invitación que te compartieron.</p>
          <input className="input-field" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Pega el enlace de invitación" />
          <button type="button" onClick={handleJoin} disabled={joining} className="btn-secondary w-full">
            {joining ? <Spinner className="h-5 w-5" /> : <Users size={17} />}
            Unirme
          </button>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="m-0 text-lg font-black text-app-strong">Tus agendas</h3>
        {workspaces.map((ws) => (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            user={user}
            isActive={ws.id === activeWorkspaceId}
            onSelect={() => onSelectWorkspace(ws.id)}
            onNotify={setMessage}
          />
        ))}
      </div>
    </div>
  );
}

function WorkspaceCard({
  workspace,
  user,
  isActive,
  onSelect,
  onNotify
}: {
  workspace: WorkspaceWithRole;
  user: FirebaseUser;
  isActive: boolean;
  onSelect: () => void;
  onNotify: (msg: { type: "ok" | "error"; text: string } | null) => void;
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(workspace.name);
  const isOwner = workspace.myRole === "owner";
  const isShared = workspace.kind === "shared";

  useEffect(() => {
    if (!isShared) {
      setMembers([]);
      return;
    }
    const unsub = workspaceService.subscribeToMembers(workspace.id, setMembers);
    return () => unsub();
  }, [workspace.id, isShared]);

  const inviteLink = buildInviteLink(workspace);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      onNotify({ type: "error", text: "No se pudo copiar. Copia el enlace manualmente." });
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Te invito a la agenda "${workspace.name}" en Agenda Mentes Brillantes. Ábrelo aquí: ${inviteLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      await workspaceService.regenerateJoinCode(workspace.id);
      onNotify({ type: "ok", text: "Generamos un enlace nuevo. El anterior ya no funciona." });
    } catch {
      onNotify({ type: "error", text: "No se pudo regenerar el enlace." });
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (!nameDraft.trim()) return;
    setBusy(true);
    try {
      await workspaceService.renameWorkspace(workspace.id, nameDraft.trim());
      setRenaming(false);
      onNotify({ type: "ok", text: "Nombre actualizado." });
    } catch {
      onNotify({ type: "error", text: "No se pudo cambiar el nombre." });
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (uid: string) => {
    setBusy(true);
    try {
      await workspaceService.removeMember(workspace.id, uid);
      onNotify({ type: "ok", text: "Persona retirada de la agenda." });
    } catch {
      onNotify({ type: "error", text: "No se pudo retirar a la persona." });
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await workspaceService.leaveWorkspace(workspace.id, user.uid);
      onNotify({ type: "ok", text: `Saliste de "${workspace.name}".` });
    } catch {
      onNotify({ type: "error", text: "No se pudo salir de la agenda." });
    } finally {
      setBusy(false);
    }
  };

  const removeWorkspace = async () => {
    if (!window.confirm(`¿Eliminar la agenda "${workspace.name}" con todos sus eventos? Esto no se puede deshacer.`)) return;
    setBusy(true);
    try {
      await workspaceService.deleteWorkspace(workspace.id);
      onNotify({ type: "ok", text: "Agenda eliminada." });
    } catch {
      onNotify({ type: "error", text: "No se pudo eliminar la agenda." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: workspace.color || "#d7b46a" }} />
        {renaming ? (
          <div className="flex flex-1 items-center gap-2">
            <input className="input-field min-h-10 flex-1" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
            <button type="button" onClick={saveName} disabled={busy} className="btn-primary min-h-10 px-3">
              <Check size={16} />
            </button>
          </div>
        ) : (
          <h4 className="m-0 flex-1 text-lg font-black text-app-strong">{workspace.name}</h4>
        )}
        <span className="rounded-full border border-app-soft bg-app-soft px-2.5 py-1 text-xs font-black text-app-muted">
          {workspace.kind === "personal" ? "Personal" : isOwner ? "Dueño" : "Miembro"}
        </span>
        {isActive ? (
          <span className="rounded-full border border-app-accent bg-app-soft px-2.5 py-1 text-xs font-black text-app-accent">En uso</span>
        ) : (
          <button type="button" onClick={onSelect} className="btn-secondary min-h-9 px-3 text-xs">
            Usar esta agenda
          </button>
        )}
      </div>

      {isShared && (
        <>
          <div className="rounded-2xl border border-app-soft bg-app-soft p-3">
            <p className="section-label mb-2">Enlace de invitación</p>
            <p className="m-0 mb-3 break-all rounded-xl bg-app-panel p-2 text-xs font-semibold text-app-muted">{inviteLink}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyLink} className="btn-secondary min-h-10 flex-1 text-xs">
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copiado" : "Copiar enlace"}
              </button>
              <button type="button" onClick={shareWhatsApp} className="btn-secondary min-h-10 flex-1 text-xs">
                <Share2 size={15} />
                WhatsApp
              </button>
              {isOwner && (
                <button type="button" onClick={regenerate} disabled={busy} className="btn-secondary min-h-10 px-3 text-xs" title="Generar enlace nuevo">
                  <RefreshCw size={15} />
                </button>
              )}
            </div>
            <p className="m-0 mt-2 text-xs text-app-faint">Solo entra quien tenga este enlace. Si lo regeneras, el anterior deja de servir.</p>
          </div>

          <div>
            <p className="section-label mb-2">Personas ({members.length})</p>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.uid} className="flex items-center gap-3 rounded-2xl border border-app-soft bg-app-panel p-2.5">
                  {member.photoURL ? (
                    <img src={member.photoURL} alt={member.name} referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-app-soft text-app-accent">
                      <UserRound size={16} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 flex items-center gap-1 truncate text-sm font-bold text-app-strong">
                      {member.name}
                      {member.role === "owner" && <Crown size={13} className="text-app-accent" />}
                    </p>
                    <p className="m-0 truncate text-xs text-app-faint">{member.email}</p>
                  </div>
                  {isOwner && member.uid !== user.uid && (
                    <button type="button" onClick={() => removeMember(member.uid)} disabled={busy} className="rounded-xl p-2 text-app-faint hover:bg-red-500/10 hover:text-red-500" aria-label="Quitar">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-app-soft pt-3">
            {isOwner && (
              <button type="button" onClick={() => setRenaming((v) => !v)} className="btn-secondary min-h-10 text-xs">
                <Pencil size={15} />
                Cambiar nombre
              </button>
            )}
            {isOwner ? (
              <button type="button" onClick={removeWorkspace} disabled={busy} className="btn-danger-soft min-h-10 text-xs">
                <Trash2 size={15} />
                Eliminar agenda
              </button>
            ) : (
              <button type="button" onClick={leave} disabled={busy} className="btn-danger-soft min-h-10 text-xs">
                <LogOut size={15} />
                Salir de la agenda
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
