"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectParam = params.get("redirect");
  const redirect = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";

  const { signIn, signInWithGoogle, signUp, user } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, router, redirect]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } =
      tab === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, displayName || email.split("@")[0]);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="w-full max-w-[420px]">
      {/* Logo / Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-[14px] bg-[#6B4C4C] mb-4">
          <span className="text-white text-[18px] font-[700]">L</span>
        </div>
        <h1 className="text-[22px] font-[700] text-[#2A1F1A] tracking-[-0.02em]">Lyzr Marketing Dashboard</h1>
        <p className="text-[14px] text-[#7A6A60] mt-1">Sign in with your @lyzr.ai account</p>
      </div>

      {/* Card */}
      <div className="rounded-[24px] border border-[#D4CBC0] bg-white p-8 shadow-[0_8px_40px_rgba(40,20,10,.08)]">
        {/* Google Button */}
        <button
          type="button"
          onClick={async () => {
            setError(null);
            setBusy(true);
            const { error: err } = await signInWithGoogle();
            setBusy(false);
            if (err) setError(err);
          }}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 rounded-[12px] border border-[#D4CBC0] bg-white px-4 py-3 text-[15px] font-[500] text-[#2A1F1A] hover:border-[#6B4C4C] hover:shadow-[0_2px_8px_rgba(107,76,76,.1)] transition-all disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#E8E0D8]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-[12px] text-[#A89A8E] uppercase tracking-[0.1em]">or continue with email</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-[10px] border border-[#E8E0D8] p-1 mb-5">
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={`flex-1 rounded-[8px] py-2 text-[13px] font-[600] transition-all ${tab === "signin" ? "bg-[#6B4C4C] text-white shadow-sm" : "text-[#7A6A60] hover:text-[#2A1F1A]"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={`flex-1 rounded-[8px] py-2 text-[13px] font-[600] transition-all ${tab === "signup" ? "bg-[#6B4C4C] text-white shadow-sm" : "text-[#7A6A60] hover:text-[#2A1F1A]"}`}
          >
            Create account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-[12px] font-[600] text-[#7A6A60] uppercase tracking-[0.08em] mb-1.5">Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-[10px] border border-[#D4CBC0] bg-[#FAFAF8] px-4 py-2.5 text-[14px] text-[#2A1F1A] placeholder:text-[#C4B8AC] outline-none focus:border-[#6B4C4C] focus:ring-2 focus:ring-[rgba(107,76,76,.1)] transition-all"
              />
            </div>
          )}
          <div>
            <label className="block text-[12px] font-[600] text-[#7A6A60] uppercase tracking-[0.08em] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@lyzr.ai"
              className="w-full rounded-[10px] border border-[#D4CBC0] bg-[#FAFAF8] px-4 py-2.5 text-[14px] text-[#2A1F1A] placeholder:text-[#C4B8AC] outline-none focus:border-[#6B4C4C] focus:ring-2 focus:ring-[rgba(107,76,76,.1)] transition-all"
            />
          </div>
          <div>
            <label className="block text-[12px] font-[600] text-[#7A6A60] uppercase tracking-[0.08em] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full rounded-[10px] border border-[#D4CBC0] bg-[#FAFAF8] px-4 py-2.5 text-[14px] text-[#2A1F1A] placeholder:text-[#C4B8AC] outline-none focus:border-[#6B4C4C] focus:ring-2 focus:ring-[rgba(107,76,76,.1)] transition-all"
            />
          </div>

          {error && (
            <div className="rounded-[10px] border border-[rgba(220,38,38,.2)] bg-[rgba(220,38,38,.04)] px-4 py-2.5">
              <p className="text-[13px] text-[#DC2626]">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[10px] bg-[#6B4C4C] px-4 py-3 text-[14px] font-[600] text-white hover:bg-[#5A3D3D] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Please wait…" : tab === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-[12px] text-[#A89A8E] mt-6">
        Only @lyzr.ai emails are allowed. Contact admin for access.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-[#F9F5F1] via-[#F2EDE8] to-[#EBE4DC] p-4">
      <Suspense fallback={<div className="text-[13px] text-[#7A6A60]">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
