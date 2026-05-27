import React, { useState } from "react";
import { AtSign, ChevronDown, ChevronUp, Lock, Moon, Sparkles, Sun, UserRound } from "lucide-react";
import { Spinner } from "../components/ui/Spinner";
import { authService } from "../services/authService";
import type { UserRole } from "../types/user";
import { useTheme } from "../hooks/useTheme";

export default function LoginPage() {
  const { theme, toggleTheme, themeLabel } = useTheme();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("family");
  const [loadingAction, setLoadingAction] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const brandLogo = theme === "pink" ? "/brand/logo-gemb-blue-small.jpeg" : "/brand/logo-gemb-icon.png";

  const handleGoogle = async () => {
    setError(null);
    setLoadingAction("google");
    try {
      await authService.signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar sesion con Google.");
      setLoadingAction(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingAction("email");

    try {
      if (isLogin) {
        await authService.login(email, password);
      } else {
        if (!name.trim()) throw new Error("Escribe tu nombre para crear la cuenta.");
        await authService.register(email, password, name, role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos completar el ingreso.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-app px-4 py-6 text-app-strong sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="glass-panel order-2 rounded-[2rem] p-5 sm:p-7 lg:order-1">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={brandLogo}
                  alt="Gimnasio Emocional Mentes Brillantes"
                  className={`${theme === "pink" ? "h-12 w-20 bg-white object-contain p-1" : "h-12 w-12 object-cover"} rounded-2xl shadow-lg`}
                />
                <div>
                  <p className="m-0 text-xs font-black uppercase text-app-accent">Gimnasio Emocional</p>
                  <p className="m-0 text-sm font-bold text-app-muted">Mentes Brillantes</p>
                </div>
              </div>
              <button type="button" onClick={toggleTheme} className="btn-secondary min-h-10 px-3" aria-label="Cambiar tema">
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                <span className="hidden sm:inline">{themeLabel}</span>
              </button>
            </div>

            <div className="mb-8">
              <h1 className="m-0 text-4xl font-black leading-tight tracking-tight sm:text-5xl">Agenda Mentes Brillantes</h1>
              <p className="mt-4 text-lg font-semibold text-app-muted">Familia, sesiones, tareas y proposito en un solo lugar</p>
              <p className="mt-3 text-sm leading-relaxed text-app-faint">Organiza tu dia con calma, claridad y conciencia.</p>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-bold text-red-500">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={!!loadingAction}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:opacity-70"
              >
                {loadingAction === "google" ? <Spinner className="h-5 w-5 text-slate-700" /> : <GoogleIcon />}
                Continuar con Google
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEmailForm((value) => !value);
                  setError(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-app-soft bg-app-soft px-4 py-3 text-sm font-bold text-app-muted hover:text-app-strong"
              >
                {isLogin ? "Entrar con correo" : "Crear cuenta con correo"}
                {showEmailForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {showEmailForm && (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-3xl border border-app-soft bg-app-soft p-4">
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-app-panel p-1">
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className={`rounded-xl px-3 py-2 text-sm font-black ${isLogin ? "bg-app-soft text-app-strong" : "text-app-faint"}`}
                  >
                    Ingresar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className={`rounded-xl px-3 py-2 text-sm font-black ${!isLogin ? "bg-app-soft text-app-strong" : "text-app-faint"}`}
                  >
                    Crear cuenta
                  </button>
                </div>

                {!isLogin && (
                  <Field label="Nombre completo" icon={<UserRound size={17} />}>
                    <input className="input-field pl-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" required />
                  </Field>
                )}

                <Field label="Correo electronico" icon={<AtSign size={17} />}>
                  <input className="input-field pl-11" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" required />
                </Field>

                <Field label="Contrasena" icon={<Lock size={17} />}>
                  <input className="input-field pl-11" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" required />
                </Field>

                {!isLogin && (
                  <label className="block">
                    <span className="section-label mb-2 block">Rol</span>
                    <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                      <option value="family">Familiar</option>
                      <option value="coach">Coach</option>
                      <option value="admin">Administrador</option>
                      <option value="viewer">Lector</option>
                    </select>
                  </label>
                )}

                <button type="submit" disabled={!!loadingAction} className="btn-primary w-full">
                  {loadingAction === "email" ? <Spinner className="h-5 w-5" /> : isLogin ? "Entrar con correo" : "Crear cuenta con correo"}
                </button>
              </form>
            )}
          </section>

          <section className="order-1 flex flex-col items-center justify-center lg:order-2">
            <div className="relative w-full max-w-xl">
              <div className="mx-auto mb-4 hidden max-w-xs justify-center rounded-3xl border border-app-soft bg-app-panel p-3 shadow-xl backdrop-blur sm:flex">
                <img
                  src={theme === "pink" ? "/brand/logo-gemb-blue-small.jpeg" : "/brand/logo-gemb-gold-small.jpeg"}
                  alt="Mentes Brillantes"
                  className="max-h-20 w-full object-contain"
                />
              </div>
              <img src="/brand/login-visual.png" alt="Agenda familiar y emocional" className="mx-auto max-h-[640px] rounded-[2rem] object-contain drop-shadow-2xl" />
              <div className="mx-auto mt-4 max-w-md rounded-3xl border border-app-soft bg-app-panel px-5 py-4 text-center shadow-xl backdrop-blur">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-app-strong bg-app-soft px-3 py-1 text-xs font-black text-app-accent">
                  <Sparkles size={14} />
                  Calma para organizar lo importante
                </div>
                <p className="m-0 text-sm leading-relaxed text-app-muted">
                  Una agenda simple para coordinar reuniones, tareas, recordatorios, sesiones y momentos de familia.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="section-label mb-2 block">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-app-faint">{icon}</span>
        {children}
      </span>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.6 5.1C9.4 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
