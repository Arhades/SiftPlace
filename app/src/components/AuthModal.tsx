import React, { useState } from "react";
import { X, Mail, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        onSuccess();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
          }
        });
        if (signUpError) throw signUpError;
        
        if (data.session) {
          onSuccess();
        } else {
          setMessage("Verification email sent! Please check your inbox to complete sign up.");
        }
      }
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message || "Google OAuth failed.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-sift-fade">
      <div className="relative w-full max-w-md bg-lowest border-2 border-line rounded-3xl p-6 sm:p-8 shadow-lg">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-8 w-8 rounded-full border border-line bg-surface text-muted hover:text-ink flex items-center justify-center cursor-pointer transition active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Mascot / Title */}
        <div className="text-center mb-6">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full sf-avatar mb-3">
            ☀️
          </span>
          <h3 className="text-xl font-black text-ink">
            {isLogin ? "Welcome Back to SiftPlace" : "Create your account"}
          </h3>
          <p className="text-xs text-muted mt-1 font-medium">
            {isLogin 
              ? "Sign in to sync your saved student housing options" 
              : "Save listings and commute budgets across devices"}
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-line mb-6">
          <button
            onClick={() => { setIsLogin(true); setError(""); setMessage(""); }}
            className={`flex-1 pb-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
              isLogin ? "border-primary text-primary-dim font-black" : "border-transparent text-muted"
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(""); setMessage(""); }}
            className={`flex-1 pb-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
              !isLogin ? "border-primary text-primary-dim font-black" : "border-transparent text-muted"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error / Success notices */}
        {error && (
          <div className="mb-4 text-xs font-bold text-error bg-error-soft rounded-xl px-4 py-2.5">
            ⚠️ {error}
          </div>
        )}
        {message && (
          <div className="mb-4 text-xs font-bold text-ok bg-ok-soft rounded-xl px-4 py-2.5">
            ✓ {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5 pl-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="email"
                required
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sf-field pl-11"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted mb-1.5 pl-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="sf-field pl-11"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="sf-cta w-full py-3.5 text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line"></div></div>
          <span className="relative bg-lowest px-3 text-[10px] uppercase font-bold text-muted">Or continue with</span>
        </div>

        {/* Google OAuth Option */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 text-xs font-bold rounded-2xl border-2 border-line bg-lowest hover:bg-surface-c transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.466 0-6.277-2.85-6.277-6.36s2.81-6.358 6.277-6.358c1.614 0 3.085.606 4.215 1.597l3.056-3.1C18.91 2.213 15.82 1 12.24 1c-6.21 0-11.24 5.08-11.24 11.34s5.03 11.34 11.24 11.34c6.48 0 11.56-4.63 11.56-11.34 0-.756-.068-1.485-.22-2.057H12.24z"
            />
          </svg>
          Google Account
        </button>

        <p className="text-[10px] text-center text-muted mt-6 font-medium">
          By signing up, you agree to our verified listing guarantee. We will never sell or share your student contact details.
        </p>
      </div>
    </div>
  );
}
