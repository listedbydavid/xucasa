import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordValid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!passwordValid) {
      setError("Password must be at least 8 characters with an uppercase letter, lowercase letter, and digit.");
      setLoading(false);
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-10 pr-10 py-3 bg-background border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors";

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="text-reset-invalid">Invalid Reset Link</h1>
          <p className="text-muted-foreground mb-6">This password reset link is invalid or missing a token. Please request a new one.</p>
          <button
            onClick={() => setLocation("/auth")}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
            data-testid="button-goto-login"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="text-reset-success">Password Reset Complete</h1>
          <p className="text-muted-foreground mb-6">Your password has been updated successfully. You can now sign in with your new password.</p>
          <button
            onClick={() => setLocation("/auth")}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
            data-testid="button-goto-login-after-reset"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-reset-title">Set new password</h1>
          <p className="text-muted-foreground mt-2">Choose a strong password for your account</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                required
                minLength={8}
                className={inputClass}
                data-testid="input-reset-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={8}
                className={`${inputClass} pr-4`}
                data-testid="input-reset-confirm-password"
              />
            </div>

            {password.length > 0 && (
              <div className="space-y-1 text-xs" data-testid="password-requirements">
                <p className={password.length >= 8 ? "text-green-600" : "text-muted-foreground"}>
                  {password.length >= 8 ? "\u2713" : "\u2022"} At least 8 characters
                </p>
                <p className={/[A-Z]/.test(password) ? "text-green-600" : "text-muted-foreground"}>
                  {/[A-Z]/.test(password) ? "\u2713" : "\u2022"} One uppercase letter
                </p>
                <p className={/[a-z]/.test(password) ? "text-green-600" : "text-muted-foreground"}>
                  {/[a-z]/.test(password) ? "\u2713" : "\u2022"} One lowercase letter
                </p>
                <p className={/[0-9]/.test(password) ? "text-green-600" : "text-muted-foreground"}>
                  {/[0-9]/.test(password) ? "\u2713" : "\u2022"} One digit
                </p>
                {confirmPassword.length > 0 && (
                  <p className={passwordsMatch ? "text-green-600" : "text-destructive"}>
                    {passwordsMatch ? "\u2713" : "\u2717"} Passwords match
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" data-testid="text-reset-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !passwordValid || !passwordsMatch}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="button-reset-submit"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Reset password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
