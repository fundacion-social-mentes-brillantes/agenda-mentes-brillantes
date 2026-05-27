import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useEvents } from "./hooks/useEvents";
import { Layout } from "./components/layout/Layout";
import type { PageType } from "./components/layout/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import DayPage from "./pages/DayPage";
import EventFormPage from "./pages/EventFormPage";
import type { CalendarEvent } from "./types/event";
import { Spinner } from "./components/ui/Spinner";
import { Card } from "./components/ui/Card";
import { LogOut, ShieldAlert, User as UserIcon } from "lucide-react";
import { authService } from "./services/authService";

function AppContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const { 
    events, 
    loading: eventsLoading, 
    createEvent, 
    updateEvent, 
    updateEventStatus, 
    deleteEvent 
  } = useEvents();

  const [activePage, setActivePage] = useState<PageType>("dashboard");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Custom function to change page and clean up page-specific state
  const handlePageChange = (page: PageType) => {
    if (page !== "event-form") {
      setEditingEvent(null);
      setSelectedDate(null);
    }
    setActivePage(page);
  };

  // 1. Auth Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        <Spinner className="w-10 h-10 text-violet-600 dark:text-violet-400" />
        <p className="mt-4 font-semibold text-sm text-slate-500">Iniciando Gimnasio Emocional...</p>
      </div>
    );
  }

  // 2. Unauthenticated state -> Show Login
  if (!user || !profile) {
    return <LoginPage />;
  }

  // 3. Render content depending on activePage state
  const renderActivePage = () => {
    // If events are still loading initially, display a clean overlay spinner inside content
    if (eventsLoading && events.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-24">
          <Spinner className="w-8 h-8 text-violet-600" />
          <p className="mt-2 text-xs font-semibold text-slate-400">Sincronizando agenda en tiempo real...</p>
        </div>
      );
    }

    switch (activePage) {
      case "dashboard":
        return (
          <DashboardPage
            events={events}
            profile={profile}
            setActivePage={(page) => handlePageChange(page as PageType)}
            setEditingEvent={setEditingEvent}
            onUpdateStatus={updateEventStatus}
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
            onUpdateStatus={updateEventStatus}
            onDeleteEvent={deleteEvent}
          />
        );
      case "day":
        return (
          <DayPage
            events={events}
            setActivePage={(page) => handlePageChange(page as PageType)}
            setEditingEvent={setEditingEvent}
            onUpdateStatus={updateEventStatus}
            onDeleteEvent={deleteEvent}
          />
        );
      case "event-form":
        return (
          <EventFormPage
            editingEvent={editingEvent}
            selectedDate={selectedDate}
            profile={profile}
            setActivePage={(page) => handlePageChange(page as PageType)}
            onCreateEvent={createEvent}
            onUpdateEvent={updateEvent}
          />
        );
      case "settings":
        return (
          <div className="flex flex-col gap-6 max-w-2xl">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white m-0">Ajustes del Sistema</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configura tu perfil y conoce más sobre la aplicación.</p>
            </div>
            
            {/* User Profile Card */}
            <Card className="flex flex-col gap-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Mi Perfil</h3>
              <div className="flex items-center gap-4">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold uppercase text-2xl border-4 border-slate-50 dark:border-slate-800 shadow-sm"
                  style={{ backgroundColor: profile.color || "#8b5cf6" }}
                >
                  {profile.name ? profile.name.slice(0, 2) : <UserIcon size={24} />}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{profile.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{profile.email}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 mt-1 bg-violet-50 dark:bg-violet-950/40 px-2.5 py-0.5 rounded-full w-fit">
                    Rol: {profile.role}
                  </span>
                </div>
              </div>
            </Card>

            {/* Application Information Card */}
            <Card className="flex flex-col gap-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Gimnasio Emocional Mentes Brillantes</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed m-0">
                Esta agenda digital permite coordinar de manera interna las sesiones de coaching de vida, el seguimiento de tareas operativas de la fundación y los compromisos familiares.
              </p>
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/20 font-medium">
                <ShieldAlert size={16} />
                <span>Las modificaciones realizadas se actualizan en tiempo real para todos los miembros autorizados.</span>
              </div>
            </Card>

            {/* Logout Button */}
            <button
              onClick={async () => {
                await authService.logout();
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/25 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-sm font-semibold transition-all border border-red-150 dark:border-red-900/30"
            >
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>

          </div>
        );
      default:
        return <div>Página no encontrada.</div>;
    }
  };

  return (
    <Layout activePage={activePage} setActivePage={handlePageChange}>
      {renderActivePage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
