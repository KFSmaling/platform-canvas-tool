import { useState } from "react";
import { useAuth } from "./shared/services/auth.service";
import { useTheme } from "./shared/hooks/useTheme";
import { useAppConfig } from "./shared/context/AppConfigContext";
import LogoBrand from "./shared/components/LogoBrand";

export default function LoginScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const { brandName } = useTheme();
  const { label: appLabel } = useAppConfig();
  const [mode, setMode]       = useState("login");   // "login" | "register" | "reset"
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo]       = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await signIn({ email, password });
        if (error) {
          if (error.message.includes("Email not confirmed")) {
            setError("Je e-mail is nog niet bevestigd. Controleer je inbox en klik op de bevestigingslink.");
          } else if (error.message.includes("Invalid login credentials")) {
            setError("E-mailadres of wachtwoord is onjuist.");
          } else {
            setError(error.message);
          }
        }
      } else if (mode === "register") {
        const { error } = await signUp({ email, password });
        if (error) {
          setError(error.message);
        } else {
          setInfo("Account aangemaakt! Je kunt nu direct inloggen.");
          setMode("login");
        }
      } else if (mode === "reset") {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message);
        } else {
          setInfo("Reset-link verzonden. Controleer je inbox (ook je spamfolder).");
          setMode("login");
        }
      }
    } catch (err) {
      setError("Er is iets misgegaan. Controleer je internetverbinding en probeer opnieuw.");
      console.error("Auth fout:", err);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
    setInfo(null);
  };

  const titles = {
    login:    "Inloggen",
    register: "Account aanmaken",
    reset:    "Wachtwoord vergeten",
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] flex flex-col">

      {/* Header */}
      <header className="h-20 bg-[var(--color-primary)] flex items-center shadow-md">
        <div className="px-6 flex items-center justify-center h-full border-r border-white/10">
          <div className="bg-white rounded px-2 py-1">
            <LogoBrand
              variant="dark"
              imgClassName="h-8 w-auto object-contain"
              textClassName="text-[var(--color-primary)] font-bold text-base tracking-wide px-1"
            />
          </div>
        </div>
        <div className="px-6">
          <h1 className="text-[13px] font-bold tracking-[0.16em] uppercase text-white leading-none">{appLabel("app.title", "Business Transformation Workbench")}</h1>
          <p className="text-[10px] tracking-[0.12em] text-[var(--color-accent)] mt-1.5 uppercase font-semibold">{appLabel("app.subtitle", "Platform voor strategie tot executie")}</p>
        </div>
      </header>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          <div className="bg-white rounded-sm shadow-lg border-t-4 border-[var(--color-primary)] overflow-hidden">

            {/* Card header */}
            <div className="px-8 py-7 bg-[var(--color-primary)]">
              <h2 className="text-white font-black text-base uppercase tracking-widest">
                {titles[mode]}
              </h2>
              <p className="text-white/40 text-[11px] mt-1 uppercase tracking-wider">
                {brandName} — {appLabel("login.internal_use", "intern gebruik")}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-sm px-4 py-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {info && (
                <div className="bg-green-50 border border-green-200 rounded-sm px-4 py-3">
                  <p className="text-green-700 text-sm">{info}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  E-mailadres
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder={appLabel("login.email_placeholder", "naam@example.com")}
                  className="w-full border border-slate-200 rounded-sm px-4 py-3 text-sm text-slate-800 outline-none focus:border-[var(--color-analysis)] transition-colors bg-slate-50"
                />
              </div>

              {mode !== "reset" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Wachtwoord
                    </label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => switchMode("reset")}
                        className="text-xs text-[var(--color-primary)] hover:text-[var(--color-success)] font-semibold transition-colors"
                      >
                        Wachtwoord vergeten?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Minimaal 6 tekens"
                    className="w-full border border-slate-200 rounded-sm px-4 py-3 text-sm text-slate-800 outline-none focus:border-[var(--color-analysis)] transition-colors bg-slate-50"
                  />
                </div>
              )}

              {mode === "reset" && (
                <p className="text-sm text-slate-500">
                  Vul je e-mailadres in. Je ontvangt een link om je wachtwoord opnieuw in te stellen.
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-success)] text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
              >
                {loading
                  ? "Bezig…"
                  : mode === "login"
                    ? "Inloggen"
                    : mode === "register"
                      ? "Account aanmaken"
                      : "Reset-link versturen"}
              </button>

            </form>

            {/* Mode toggle */}
            <div className="px-8 pb-7 border-t border-slate-100 pt-5 space-y-2">
              {mode !== "login" && (
                <p className="text-sm text-slate-500 text-center">
                  Al een account?{" "}
                  <button onClick={() => switchMode("login")} className="text-[var(--color-primary)] font-bold hover:text-[var(--color-success)] transition-colors">
                    Inloggen
                  </button>
                </p>
              )}
              {mode !== "register" && (
                <p className="text-sm text-slate-500 text-center">
                  Nog geen account?{" "}
                  <button onClick={() => switchMode("register")} className="text-[var(--color-primary)] font-bold hover:text-[var(--color-success)] transition-colors">
                    Aanmaken
                  </button>
                </p>
              )}
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400 mt-6 uppercase tracking-widest">
            {brandName} · {appLabel("login.confidential", "Vertrouwelijk")}
          </p>
        </div>
      </div>
    </div>
  );
}
