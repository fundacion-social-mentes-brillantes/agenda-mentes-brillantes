import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import { useEvents } from "./hooks/useEvents";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { Layout } from "./components/layout/Layout";
import type { PageType } from "./components/layout/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import DayPage from "./pages/DayPage";
import EventFormPage from "./pages/EventFormPage";
import SettingsPage from "./pages/SettingsPage";
import WorkspacePage from "./pages/WorkspacePage";
import type { CalendarEvent } from "./types/event";
import { Spinner } from "./components/ui/Spinner";
import { authService } from "./services/authService";
import { workspaceService } from "./services/workspaceService";
import type { AppTheme } from "./types/theme";

function AppContent() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { setTheme } = useTheme();
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loading: workspacesLoading,
    error: workspacesError
  } = useWorkspaces(user);
  const { events, loading: eventsLoading, createEvent, updateEvent, setEventDone, deleteEvent } = useEvents(activeWorkspaceId);

  const [activePage, setActivePage] = useState<PageType>("dashboard");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const inviteHandledRef = useRef(false);

  // Procesa el enlace de invitación (?invite=...&code=...) una sola vez tras iniciar sesión.
  useEffect(() => {
    if (!user || inviteHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const wsId = params.get("invite");
    const code = params.get("code");
    if (!wsId || !code) return;

    inviteHandledRef.current = true;
    (async () => {
      try {
        const ws = await workspaceService.joinWorkspace(user, wsId, code);
        setActiveWorkspaceId(ws.id);
        setActivePage("dashboard");
        setInviteNotice(`Te uniste a la agenda "${ws.name}".`);
        // Limpiamos la URL solo si funcionó (así, si falla, recargar reintenta).
        window.history.replaceState({}, "", window.location.pathname);
        window.setTimeout(() => setInviteNotice(null), 6000);
      } catch (error) {
        console.error("No se pudo procesar la invitación", error);
        setInviteNotice(
          "No pudimos unirte: el enlace no es válido o la agenda ya no existe. Pídele a quien te invitó que te reenvíe el enlace y vuelve a abrirlo."
        );
      }
    })();
  }, [user, setActiveWorkspaceId]);

  const handlePageChange = (page: PageType) => {
    if (page !== "event-form") {
      setEditingEvent(null);
      setSelectedDate(null);
    }
    setActivePage(page);
  };

  const handleCreate = () => {
    setEditingEvent(null);
    setSelectedDate(new Date());
    setActivePage("event-form");
  };

  const handleThemeChange = async (theme: AppTheme) => {
    setTheme(theme);
    if (profile?.uid) {
      try {
        await authService.updateUserTheme(profile.uid, theme);
        await refreshProfile();
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-app text-app-strong">
        <Spinner className="h-10 w-10 text-app-accent" />
        <p className="mt-4 text-sm font-bold text-app-muted">Iniciando Agenda Mentes Brillantes...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  if (workspacesLoading && !activeWorkspace) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-app text-app-strong">
        <Spinner className="h-10 w-10 text-app-accent" />
        <p className="mt-4 text-sm font-bold text-app-muted">Preparando tu agenda...</p>
      </div>
    );
  }

  if (!workspacesLoading && workspaces.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-app px-6 text-center text-app-strong">
        <p className="m-0 text-lg font-black">No pudimos cargar tu agenda</p>
        <p className="mt-3 max-w-md text-sm text-app-muted">
          {workspacesError ||
            "Si es la primera vez con la nueva versión, revisa que se publicaron las reglas de Firebase (guía rápida, paso 1) y vuelve a intentar."}
        </p>
        <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-6">
          Reintentar
        </button>
        <button type="button" onClick={() => authService.logout()} className="btn-secondary mt-3">
          Cerrar sesión
        </button>
      </div>
    );
  }

  const renderActivePage = () => {
    if (activePage !== "workspaces" && activePage !== "event-form" && eventsLoading && events.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center py-24">
          <Spinner className="h-8 w-8 text-app-accent" />
          <p className="mt-2 text-xs font-bold text-app-muted">Sincronizando agenda en tiempo real...</p>
        </div>
      );
    }

    switch (activePage) {
      case "dashboard":
        return (
          <DashboardPage
            events={events}
            profile={profile}
            workspaceName={activeWorkspace?.name}
            setActivePage={(page) => handlePageChange(page as PageType)}
            setEditingEvent={setEditingEvent}
            onToggleDone={setEventDone}
            onDeleteEvent={deleteEvent}
          />
        );
      case "calendar":
        return (
          <CalendarPage
            events={events}
            setActivePage={(page) => handlePageChange(page as PageType)}
            setEditingEvent={setEditingEvent}
            setSelectedDate={setSelectedDate}
            onToggleDone={setEventDone}
            onDeleteEvent={deleteEvent}
          />
        );
      case "day":
        return (
          <DayPage
            events={events}
            setActivePage={(page) => handlePageChange(page as PageType)}
            setEditingEvent={setEditingEvent}
            onToggleDone={setEventDone}
            onDeleteEvent={deleteEvent}
          />
        );
      case "event-form":
        return (
          <EventFormPage
            editingEvent={editingEvent}
            selectedDate={selectedDate}
            workspaceId={activeWorkspaceId}
            workspaceName={activeWorkspace?.name}
            profile={profile}
            setActivePage={(page) => handlePageChange(page as PageType)}
            onCreateEvent={createEvent}
            onUpdateEvent={updateEvent}
          />
        );
      case "workspaces":
        return (
          <WorkspacePage
            user={user}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={setActiveWorkspaceId}
          />
        );
      case "settings":
        return <SettingsPage profile={profile} onThemeChange={handleThemeChange} onGoToWorkspaces={() => handlePageChange("workspaces")} />;
      default:
        return <div>Página no encontrada.</div>;
    }
  };

  return (
    <Layout
      activePage={activePage}
      setActivePage={handlePageChange}
      onCreate={handleCreate}
      workspaces={workspaces}
      activeWorkspace={activeWorkspace}
      onSelectWorkspace={setActiveWorkspaceId}
    >
      {inviteNotice && (
        <div className="mb-5 rounded-3xl border border-app-accent bg-app-soft px-4 py-3 text-sm font-bold text-app-accent shadow-sm">{inviteNotice}</div>
      )}
      {renderActivePage()}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
