import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Mail,
  Lock,
  User,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.js";
import { apiRequest, API_BASE_URL } from "../utils/api.js";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
  resetToken?: string;
}

// ── Animation preset ──────────────────────────────────────────────────────────

const SLIDE = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.18 },
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ErrorBanner = ({ msg }: { msg: string }) => (
  <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-900/50 text-center font-medium">
    {msg}
  </div>
);

const InputField = ({
  label,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  minLength,
  rightSlot,
  error,
}: {
  label: string;
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  rightSlot?: React.ReactNode;
  error?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
        {icon}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className={`w-full pl-10 ${rightSlot ? "pr-10" : "pr-4"} py-3 bg-background border rounded-2xl text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                   transition-all text-text-main placeholder:text-text-muted/50
                   ${error ? "border-red-400 focus:ring-red-400" : "border-border"}`}
      />
      {rightSlot && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
          {rightSlot}
        </span>
      )}
    </div>
  </div>
);

// ── Google Button ─────────────────────────────────────────────────────────────

const GoogleButton = ({ label }: { label: string }) => (
  <button
    type="button"
    onClick={() => (window.location.href = '/api/auth/google')}
    className="w-full flex items-center justify-center gap-3 py-3.5 bg-white hover:bg-slate-50
               border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm
               transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
  >
    {/* Google SVG */}
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
    {label}
  </button>
);

// ── Divider ───────────────────────────────────────────────────────────────────

const OrDivider = () => (
  <div className="relative flex items-center gap-3">
    <div className="flex-1 border-t border-border" />
    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest whitespace-nowrap">
      or continue with email
    </span>
    <div className="flex-1 border-t border-border" />
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = "login",
  resetToken = "",
}) => {
  const [mode, setMode] = useState<AuthMode>(defaultMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [upiId, setUpiId] = useState("");

  const [forgotSent, setForgotSent] = useState(false);

  const [token, setToken] = useState(resetToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  useEffect(() => { setMode(defaultMode); }, [defaultMode]);
  useEffect(() => { setToken(resetToken); }, [resetToken]);

  // Scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isOpen]);

  const switchMode = (next: AuthMode) => { setError(""); setMode(next); };

  const handleClose = () => {
    setError(""); setEmail(""); setPassword(""); setName(""); setUpiId("");
    setForgotSent(false); setNewPassword(""); setConfirmPw(""); setResetDone(false);
    setMode(defaultMode);
    onClose();
  };

  if (!isOpen) return null;

  // ── Handlers (unchanged logic) ────────────────────────────────────────────

  const handleLoginRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { email, password, name, upi_id: upiId };
      const res = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      login(data.user);
      handleClose();
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try {
      const res = await apiRequest("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setForgotSent(true);
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPw) { setError("Passwords do not match."); return; }
    if (!token.trim()) { setError("Reset token is missing. Please use the link from your email."); return; }
    setIsLoading(true);
    try {
      const res = await apiRequest("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: token.trim(), new_password: newPassword }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setResetDone(true);
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isAuthMode = mode === "login" || mode === "register";

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-surface w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl
                   border border-border overflow-hidden
                   max-h-[92dvh] flex flex-col"
      >
        {/* ── Drag handle (mobile only) ── */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-border mx-auto mt-3 shrink-0" />

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto overscroll-contain flex-1">

          {/* ── Header ── */}
          <div className="px-6 pt-5 pb-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {(mode === "forgot" || mode === "reset") && (
                <button onClick={() => switchMode("login")}
                  className="p-1.5 rounded-xl hover:bg-background text-text-muted transition-colors mr-1"
                  aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <h2 className="text-xl font-black text-text-main tracking-tight">
                  {mode === "login" && "Welcome back"}
                  {mode === "register" && "Join OpenNotes"}
                  {mode === "forgot" && "Reset password"}
                  {mode === "reset" && "New password"}
                </h2>
                {isAuthMode && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {mode === "login" ? "Sign in to your account" : "Create your free account"}
                  </p>
                )}
              </div>
            </div>
            <button onClick={handleClose}
              className="p-2 text-text-muted hover:text-text-main rounded-xl hover:bg-background transition-colors shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Animated content ── */}
          <AnimatePresence mode="wait">

            {/* ════════════ LOGIN / REGISTER ════════════ */}
            {isAuthMode && (
              <motion.div key={mode} {...SLIDE} className="px-6 pb-6 space-y-4">

                {/* 0% fee promo — subtle */}
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    0% platform fees during launch phase 🎉
                  </p>
                </div>

                {/* ── GOOGLE — primary action, always on top ── */}
                <GoogleButton label={mode === "login" ? "Sign in with Google" : "Sign up with Google"} />

                {/* ── Divider ── */}
                <OrDivider />

                {/* ── Error banner ── */}
                {error && (
                  <div>
                    {error.includes("Google Login") ? (
                      <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-center space-y-2">
                        <p className="text-sm font-bold text-text-main">This account uses Google Sign-In</p>
                        <p className="text-xs text-text-muted">Use the "Sign in with Google" button above.</p>
                      </div>
                    ) : (
                      <ErrorBanner msg={error} />
                    )}
                    {error === "User not found" && mode === "login" && (
                      <button type="button" onClick={() => switchMode("register")}
                        className="w-full text-xs text-primary hover:underline font-semibold text-center py-1 mt-1">
                        No account? Sign up instead →
                      </button>
                    )}
                  </div>
                )}

                {/* ── Manual form ── */}
                <form onSubmit={handleLoginRegister} className="space-y-3">
                  {mode === "register" && (
                    <InputField label="Full Name"
                      icon={<User className="h-4 w-4" />}
                      value={name} onChange={setName}
                      placeholder="John Doe" required />
                  )}

                  <InputField label="BITS Email"
                    icon={<Mail className="h-4 w-4" />}
                    type="email" value={email} onChange={setEmail}
                    placeholder="f2023xxxx@pilani.bits-pilani.ac.in" required />

                  {/* Password row with inline "Forgot?" link */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Password</label>
                      {mode === "login" && (
                        <button type="button" onClick={() => switchMode("forgot")}
                          className="text-[11px] font-semibold text-primary hover:underline">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" required minLength={6}
                        className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-2xl text-sm
                                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                                   transition-all text-text-main" />
                    </div>
                  </div>

                  {mode === "register" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        UPI ID <span className="font-normal normal-case tracking-normal opacity-60">(optional, for payouts)</span>
                      </label>
                      <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)}
                        placeholder="name@upi"
                        className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-sm
                                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                                   transition-all text-text-main" />
                    </div>
                  )}

                  <button type="submit" disabled={isLoading}
                    className="w-full py-3.5 mt-1 bg-primary hover:bg-primary-hover text-black rounded-2xl
                               font-bold text-sm transition-all shadow-md disabled:opacity-60
                               disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isLoading
                      ? <><span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Processing…</>
                      : mode === "login" ? "Sign In" : "Create Account"
                    }
                  </button>
                </form>

                {/* ── Mode toggle ── */}
                <p className="text-sm text-text-muted text-center pt-1">
                  {mode === "login" ? "New to OpenNotes? " : "Already have an account? "}
                  <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}
                    className="font-bold text-primary hover:underline">
                    {mode === "login" ? "Create account" : "Sign in"}
                  </button>
                </p>
              </motion.div>
            )}

            {/* ════════════ FORGOT — form ════════════ */}
            {mode === "forgot" && !forgotSent && (
              <motion.form key="forgot" {...SLIDE} onSubmit={handleForgotPassword} className="px-6 pb-6 space-y-4">
                <p className="text-sm text-text-muted leading-relaxed">
                  Enter your BITS email and we'll send you a reset link. It expires in 30 minutes.
                </p>
                {error && <ErrorBanner msg={error} />}
                <InputField label="BITS Email"
                  icon={<Mail className="h-4 w-4" />}
                  type="email" value={email} onChange={setEmail}
                  placeholder="f2023xxxx@pilani.bits-pilani.ac.in" required />
                <button type="submit" disabled={isLoading}
                  className="w-full py-3.5 bg-primary hover:bg-primary-hover text-black rounded-2xl font-bold
                             text-sm transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
                  {isLoading
                    ? <><span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Sending…</>
                    : "Send Reset Link"
                  }
                </button>
              </motion.form>
            )}

            {/* ════════════ FORGOT — sent ════════════ */}
            {mode === "forgot" && forgotSent && (
              <motion.div key="forgot-sent" {...SLIDE} className="px-6 pb-8 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center mt-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main mb-1">Check your inbox</h3>
                  <p className="text-sm text-text-muted leading-relaxed max-w-xs">
                    If an account with <strong>{email}</strong> exists, we've sent a reset link.
                  </p>
                </div>
                <p className="text-xs text-text-muted">
                  Didn't get it?{" "}
                  <button type="button" onClick={() => { setForgotSent(false); setError(""); }}
                    className="text-primary font-semibold hover:underline">Try again</button>
                </p>
              </motion.div>
            )}

            {/* ════════════ RESET — form ════════════ */}
            {mode === "reset" && !resetDone && (
              <motion.form key="reset" {...SLIDE} onSubmit={handleResetPassword} className="px-6 pb-6 space-y-4">
                <p className="text-sm text-text-muted leading-relaxed">Choose a strong new password.</p>
                {error && <ErrorBanner msg={error} />}

                {!resetToken && (
                  <InputField label="Reset Token"
                    icon={<KeyRound className="h-4 w-4" />}
                    value={token} onChange={setToken}
                    placeholder="Paste token from email" required />
                )}

                {/* New password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                    <input type={showNewPw ? "text" : "password"} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters" required minLength={6}
                      className="w-full pl-10 pr-11 py-3 bg-background border border-border rounded-2xl text-sm
                                 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                                 transition-all text-text-main" />
                    <button type="button" onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
                      aria-label={showNewPw ? "Hide" : "Show"}>
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                    <input type={showNewPw ? "text" : "password"} value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Repeat new password" required
                      className={`w-full pl-10 pr-4 py-3 bg-background border rounded-2xl text-sm
                                  focus:outline-none focus:ring-2 transition-all text-text-main
                                  ${confirmPw && confirmPw !== newPassword
                          ? "border-red-400 focus:ring-red-400"
                          : "border-border focus:ring-primary focus:border-primary"}`} />
                  </div>
                  {confirmPw && confirmPw !== newPassword && (
                    <p className="text-xs text-red-500 ml-1 font-medium">Passwords don't match</p>
                  )}
                </div>

                <button type="submit" disabled={isLoading || !!(confirmPw && confirmPw !== newPassword)}
                  className="w-full py-3.5 bg-primary hover:bg-primary-hover text-black rounded-2xl font-bold
                             text-sm transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
                  {isLoading
                    ? <><span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Updating…</>
                    : "Update Password"
                  }
                </button>
              </motion.form>
            )}

            {/* ════════════ RESET — done ════════════ */}
            {mode === "reset" && resetDone && (
              <motion.div key="reset-done" {...SLIDE} className="px-6 pb-8 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center mt-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main mb-1">Password updated!</h3>
                  <p className="text-sm text-text-muted leading-relaxed max-w-xs">
                    You can now sign in with your new password.
                  </p>
                </div>
                <button type="button" onClick={() => { setResetDone(false); switchMode("login"); }}
                  className="px-8 py-3 bg-primary hover:bg-primary-hover text-black rounded-2xl font-bold text-sm transition-all shadow-md">
                  Sign In Now
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};