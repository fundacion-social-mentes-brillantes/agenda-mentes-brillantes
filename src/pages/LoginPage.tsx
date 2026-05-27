import React, { useState } from "react";
import { authService } from "../services/authService";
import { Spinner } from "../components/ui/Spinner";
import type { UserRole } from "../types/user";
import { Sparkles, Mail, Lock, User as UserIcon } from "lucide-react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  
  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("family");

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await authService.login(email, password);
      } else {
        if (!name.trim()) {
          throw new Error("El nombre es requerido");
        }
        await authService.register(email, password, name, role);
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Ocurrió un error inesperado";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        errorMsg = "Credenciales incorrectas. Verifica tu correo y contraseña.";
      } else if (err.code === "auth/email-already-in-use") {
        errorMsg = "Este correo electrónico ya está registrado.";
      } else if (err.code === "auth/weak-password") {
        errorMsg = "La contraseña debe tener al menos 6 caracteres.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12 transition-colors duration-200">
      
      {/* Decorative blurred background shapes */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-violet-300 dark:bg-violet-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-300 dark:bg-indigo-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 p-8 shadow-xl">
        
        {/* Branding header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 mb-4">
            <Sparkles size={28} className="animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white m-0 tracking-tight">
            Mentes Brillantes
          </h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            Gimnasio Emocional &bull; Agenda Interna
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl mb-6">
          <button
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
              isLogin 
                ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-white shadow-xs" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
              !isLogin 
                ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-white shadow-xs" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 mb-6 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Name Field (Only on Sign Up) */}
          {!isLogin && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Nombre Completo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <UserIcon size={18} />
                </span>
                <input
                  id="name"
                  type="text"
                  placeholder="Tu nombre completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 focus:border-violet-500 focus:bg-white dark:focus:bg-slate-950 outline-none text-sm transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Correo Electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Mail size={18} />
              </span>
              <input
                id="email"
                type="email"
                placeholder="ejemplo@mentesbrillantes.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 focus:border-violet-500 focus:bg-white dark:focus:bg-slate-950 outline-none text-sm transition-all"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock size={18} />
              </span>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 focus:border-violet-500 focus:bg-white dark:focus:bg-slate-950 outline-none text-sm transition-all"
                required
              />
            </div>
          </div>

          {/* Role Field (Only on Sign Up) */}
          {!isLogin && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="role" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Rol
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 focus:border-violet-500 focus:bg-white dark:focus:bg-slate-950 outline-none text-sm transition-all"
              >
                <option value="family">Familiar</option>
                <option value="coach">Coach</option>
                <option value="admin">Administrador</option>
                <option value="viewer">Lector</option>
              </select>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md shadow-violet-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Spinner className="w-5 h-5 text-white" />
            ) : isLogin ? (
              "Ingresar"
            ) : (
              "Crear Cuenta"
            )}
          </button>

        </form>

      </div>
    </div>
  );
}
