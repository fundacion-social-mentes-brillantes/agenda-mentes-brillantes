import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import { useEvents } from "./hooks/useEvents";
import { Layout } from "./components/layout/Layout";
import type { PageType } from "./components/layout/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import DayPage from "./pages/DayPage";
import EventFormPage from "./pages/EventFormPage";
import SettingsPage from "./pages/SettingsPage";
import type { CalendarEvent, EventType } from "./types/event";
import { Spinner } from "./components/ui/Spinner";
import { authService } from "./services/authService";
import type { AppTheme } from "./types/theme";

function AppContent() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { setTheme } = useTheme();
  const {
    events,
    loading: eventsLoading,
    createEvent,
    updateEvent,
    updateEventStatus,
    deleteEvent
  } = useEvents(!!user);

  const [activePage, setActivePage] = useState<PageType>("dashboard");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [initialEventType, setInitialEventType] = useState<EventType | null>(null);

  const handlePageChange = (page: PageType) => {
    if (page !== "event-form") {
      setEditingEvent(null);
      setSelectedDate(null);
      setInitialEventType(null);
    }
    setActivePage(page);
  };

  const handleQuickCreate = (type: EventType) => {
    setEditingEvent(null);
    setSelectedDate(new Date());
    setInitialEventType(type);
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

  const renderActivePage = () => {
    if (eventsLoading && events.length === 0) {
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
            initialType={initialEventType}
            profile={profile}
            setActivePage={(page) => handlePageChange(page as PageType)}
            onCreateEvent={createEvent}
            onUpdateEvent={updateEvent}
          />
        );
      case "settings":
        return <SettingsPage profile={profile} onThemeChange={handleThemeChange} />;
      default:
        return <div>Pagina no encontrada.</div>;
    }
  };

  return (
    <Layout activePage={activePage} setActivePage={handlePageChange} onQuickCreate={handleQuickCreate}>
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
