'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

const inputCls =
  'w-full h-[38px] px-3 bg-surface-container-low text-on-surface rounded-md text-xs border-[0.5px] border-outline-variant placeholder:text-outline outline-none focus:border-on-surface-variant';

function ClientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Already signed in? The portal cookie is the session, so ask the server rather than browser storage
  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/portal/resources', { cache: 'no-store' })
      .then(res => { if (res.ok && !cancelled) router.replace('/portal/dashboard'); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Sign-in failed. Please try again.');
        setLoading(false);
        return;
      }
      router.replace('/portal/dashboard');
    } catch {
      setErrorMessage('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="grid size-[44px] place-items-center rounded-md bg-surface-container text-on-surface-variant mb-3">
          <Building2 className="w-5 h-5" />
        </div>
        <h1 className="text-base font-semibold text-on-surface">Client portal</h1>
        <p className="text-xs text-outline mt-1">Sign in to see your links and clicks.</p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border-[0.5px] border-outline-variant p-6">
        {errorMessage && (
          <div role="alert" className="mb-4 px-3 py-2 rounded-md bg-error/10 text-error flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <label className="block">
            <span className="block text-xs font-medium text-on-surface mb-1.5">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-on-surface mb-1.5">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-outline hover:text-on-surface cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[38px] rounded-md bg-primary-container text-on-primary font-medium hover:bg-primary transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <>Sign in <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>
        </form>
      </div>

      <p className="text-[11px] text-outline text-center mt-4">
        Forgot your password? Ask your agency to reset it.
      </p>
    </div>
  );
}

export default function ClientPortalLoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface p-4">
      <Suspense fallback={<div className="w-6 h-6 border-2 border-outline-variant border-t-on-surface rounded-full animate-spin" />}>
        <ClientLoginForm />
      </Suspense>
    </div>
  );
}
