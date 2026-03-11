import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Mail,
  Lock,
  User,
  LogIn,
  UserPlus,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.js";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
  /** Token pre-filled when opening the modal for password reset via link */
  resetToken?: string;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const SLIDE = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.2 },
};

// ── Component ─────────────────────────────────────────────────────────────────

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = "login",
  resetToken = "",
}) => {
  const [mode, setMode] = useState<AuthMode>(defaultMode);

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [upiId, setUpiId] = useState("");

  // Forgot-password fields
  const [forgotSent, setForgotSent] = useState(false);

  // Reset-password fields
  const [token, setToken] = useState(resetToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Shared UI state
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  // ── Sync with external changes ────────────────────────────────────────────

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    setToken(resetToken);
  }, [resetToken]);

  // ── Scroll Lock ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  // ── Clear state when modal opens / mode changes ───────────────────────────

  const switchMode = (next: AuthMode) => {
    setError("");
    setMode(next);
  };

  // Reset all per-mode state when modal closes
  const handleClose = () => {
    setError("");
    setEmail("");
    setPassword("");
    setName("");
    setUpiId("");
    setForgotSent(false);
    setNewPassword("");
    setConfirmPw("");
    setResetDone(false);
    setMode(defaultMode);
    onClose();
  };

  if (!isOpen) return null;

  // ── Titles / icons per mode ───────────────────────────────────────────────

  const META: Record<AuthMode, { title: string; icon: React.ReactNode }> = {
    login: {
      title: "Welcome Back",
      icon: <LogIn className="h-5 w-5 text-[#003366] dark:text-[#FFC000]" />,
    },
    register: {
      title: "Create an Account",
      icon: <UserPlus className="h-5 w-5 text-[#003366] dark:text-[#FFC000]" />,
    },
    forgot: {
      title: "Forgot Password",
      icon: <KeyRound className="h-5 w-5 text-[#003366] dark:text-[#FFC000]" />,
    },
    reset: {
      title: "Set New Password",
      icon: <KeyRound className="h-5 w-5 text-[#003366] dark:text-[#FFC000]" />,
    },
  };

  // ── Submit handlers ───────────────────────────────────────────────────────

  const handleLoginRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, name, upi_id: upiId };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      login(data.token, data.user);
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setForgotSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    if (!token.trim()) {
      setError("Reset token is missing. Please use the link from your email.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setResetDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Shared UI pieces ──────────────────────────────────────────────────────

  const ErrorBanner = ({ msg }: { msg: string }) => (
    <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-900/50 text-center font-medium">
      {msg}
    </div>
  );

  const TextField = ({
    label,
    icon,
    type = "text",
    value,
    onChange,
    placeholder,
    required = false,
    minLength,
  }: {
    label: string;
    icon: React.ReactNode;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    required?: boolean;
    minLength?: number;
  }) => (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-1.5">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                     transition-all text-text-main placeholder:text-text-muted/60"
        />
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl
                   w-full max-w-md overflow-hidden border border-white/20 dark:border-slate-700/50"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-2">
            {(mode === "forgot" || mode === "reset") && (
              <button
                onClick={() => switchMode("login")}
                className="p-1 mr-1 rounded-lg hover:bg-primary-hover text-text-muted transition-colors"
                aria-label="Back to login"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {META[mode].icon}
            <h2 className="text-xl font-bold text-text-main">
              {META[mode].title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-text-muted hover:text-primary rounded-full hover:bg-primary-hover transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Body — animated mode transitions ────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* ── Login / Register ─────────────────────────────────────────── */}
          {(mode === "login" || mode === "register") && (
            <motion.form
              key={mode}
              {...SLIDE}
              onSubmit={handleLoginRegister}
              className="p-6 space-y-4"
            >
              {error && <ErrorBanner msg={error} />}

              {mode === "register" && (
                <TextField
                  label="Full Name"
                  icon={<User className="h-5 w-5 text-text-muted" />}
                  value={name}
                  onChange={setName}
                  placeholder="John Doe"
                  required
                />
              )}

              <TextField
                label="BITS Email"
                icon={<Mail className="h-5 w-5 text-text-muted" />}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="f2023xxxx@pilani.bits-pilani.ac.in"
                required
              />

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-text-muted">
                    Password
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                               transition-all text-text-main"
                  />
                </div>
              </div>

              {mode === "register" && (
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">
                    UPI ID{" "}
                    <span className="text-text-muted/60 font-normal">
                      (Optional, for payouts)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="name@upi"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                               transition-all text-text-main"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-2 bg-primary hover:bg-primary-hover text-black rounded-xl font-bold
                           text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70
                           disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading
                  ? "Processing…"
                  : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
              </button>
            </motion.form>
          )}

          {/* ── Forgot Password ──────────────────────────────────────────── */}
          {mode === "forgot" && !forgotSent && (
            <motion.form
              key="forgot"
              {...SLIDE}
              onSubmit={handleForgotPassword}
              className="p-6 space-y-4"
            >
              <p className="text-sm text-text-muted leading-relaxed">
                Enter the email address associated with your account and we'll
                send you a password reset link.
              </p>

              {error && <ErrorBanner msg={error} />}

              <TextField
                label="BITS Email"
                icon={<Mail className="h-5 w-5 text-text-muted" />}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="f2023xxxx@pilani.bits-pilani.ac.in"
                required
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-black rounded-xl font-bold
                           text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70
                           disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? "Sending…" : "Send Reset Link"}
              </button>
            </motion.form>
          )}

          {/* ── Forgot — success state ───────────────────────────────────── */}
          {mode === "forgot" && forgotSent && (
            <motion.div
              key="forgot-sent"
              {...SLIDE}
              className="p-8 flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-main mb-1">
                  Check your inbox
                </h3>
                <p className="text-sm text-text-muted leading-relaxed max-w-xs">
                  If an account with <strong>{email}</strong> exists, we've sent
                  a reset link. It expires in 30 minutes.
                </p>
              </div>
              <p className="text-xs text-text-muted">
                Didn't receive it?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setForgotSent(false);
                    setError("");
                  }}
                  className="text-primary font-semibold hover:underline"
                >
                  Try again
                </button>
              </p>
            </motion.div>
          )}

          {/* ── Reset Password ───────────────────────────────────────────── */}
          {mode === "reset" && !resetDone && (
            <motion.form
              key="reset"
              {...SLIDE}
              onSubmit={handleResetPassword}
              className="p-6 space-y-4"
            >
              <p className="text-sm text-text-muted leading-relaxed">
                Choose a strong new password for your account.
              </p>

              {error && <ErrorBanner msg={error} />}

              {/* Show token field only if it wasn't pre-filled from URL */}
              {!resetToken && (
                <TextField
                  label="Reset Token"
                  icon={<KeyRound className="h-5 w-5 text-text-muted" />}
                  value={token}
                  onChange={setToken}
                  placeholder="Paste the token from your email"
                  required
                />
              )}

              {/* New password with show/hide toggle */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted pointer-events-none" />
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                               transition-all text-text-main"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
                    aria-label={showNewPw ? "Hide password" : "Show password"}
                  >
                    {showNewPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted pointer-events-none" />
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repeat your new password"
                    required
                    className={`w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl text-sm
                                focus:outline-none focus:ring-2 focus:ring-primary transition-all text-text-main
                                ${
                                  confirmPw && confirmPw !== newPassword
                                    ? "border-red-400 focus:ring-red-400"
                                    : "border-border focus:border-primary"
                                }`}
                  />
                </div>
                {confirmPw && confirmPw !== newPassword && (
                  <p className="text-xs text-red-500 mt-1 ml-1 font-medium">
                    Passwords don't match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  isLoading || !!(confirmPw && confirmPw !== newPassword)
                }
                className="w-full py-3 bg-primary hover:bg-primary-hover text-black rounded-xl font-bold
                           text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70
                           disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? "Updating…" : "Update Password"}
              </button>
            </motion.form>
          )}

          {/* ── Reset — success state ────────────────────────────────────── */}
          {mode === "reset" && resetDone && (
            <motion.div
              key="reset-done"
              {...SLIDE}
              className="p-8 flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-main mb-1">
                  Password updated!
                </h3>
                <p className="text-sm text-text-muted leading-relaxed max-w-xs">
                  Your password has been changed successfully. You can now sign
                  in with your new password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetDone(false);
                  switchMode("login");
                }}
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-black rounded-xl font-bold
                           text-sm transition-all shadow-md"
              >
                Sign In Now
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer (login / register only) ──────────────────────────────── */}
        {(mode === "login" || mode === "register") && (
          <div className="p-6 border-t border-border bg-background space-y-4">
            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-text-muted">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={() => (window.location.href = "/api/auth/google")}
              className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-slate-50
                         border border-slate-200 rounded-xl font-bold text-slate-800 text-sm
                         transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>

            {/* Mode toggle */}
            <p className="text-sm text-text-muted text-center">
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <button
                type="button"
                onClick={() =>
                  switchMode(mode === "login" ? "register" : "login")
                }
                className="font-semibold text-primary hover:underline"
              >
                {mode === "login" ? "Sign up" : "Log in"}
              </button>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
