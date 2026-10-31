'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/storeContext';
import { 
  Link2, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Zap,
  Globe2,
  BarChart3,
  Smartphone,
  Check
} from 'lucide-react';
import { Button } from './ui/button';

interface AuthViewProps {
  initialMode?: 'login' | 'signup';
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ 
  initialMode = 'login', 
  onSuccess 
}) => {
  const router = useRouter();
  const { login, signup } = useStore();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please provide both your email address and password.');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please provide your full name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must contain at least 6 characters.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(cleanEmail, password);
        if (!res.success) {
          setError(res.error || 'Invalid email or password. Please verify your credentials.');
          setIsLoading(false);
          return;
        }
      } else {
        const res = await signup(name.trim(), cleanEmail, password);
        if (!res.success) {
          setError(res.error || 'Failed to create account. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    {
      title: 'Ultra-low Latency Redirection',
      desc: 'Edge-cached DNS routing with sub-25ms global response times.',
      icon: Zap,
    },
    {
      title: 'Real-Time Analytics & Telemetry',
      desc: 'Accurate geographic, device, referrer, and unique visitor metrics.',
      icon: BarChart3,
    },
    {
      title: 'App Deep Linking (OpenInApp)',
      desc: 'Direct mobile app open routes for Instagram, YouTube, and Amazon.',
      icon: Smartphone,
    },
    {
      title: 'Custom Branded Domains',
      desc: 'Automatic SSL certificates and domain isolation for each team.',
      icon: Globe2,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f4fae8] text-[#1a1a1a] flex flex-col justify-between antialiased selection:bg-primary-container/10 selection:text-primary-ink relative overflow-hidden">
      
      {/* Ambient background blur elements matching app theme */}
      <div className="absolute -top-24 left-1/4 w-96 h-96 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-24 w-96 h-96 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-1/3 w-[30rem] h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 group transition"
        >
          <div className="w-8 h-8 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-md shadow-lime-500/30 group-hover:scale-105 transition-transform">
            <Link2 className="w-4 h-4" />
          </div>
          <span className="text-base font-bold text-[#1a1a1a] tracking-tight">
            TinyURL<span className="text-primary-ink">.app</span>
          </span>
        </Link>

        <Link
          href="/"
          className="text-xs font-semibold text-[#666666] hover:text-[#1a1a1a] px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-[#e3e3e3] transition"
        >
          ← Back to Homepage
        </Link>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex-1 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center w-full">
          
          {/* Left Column: Brand Showcase & Value Proposition */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-lime-50 border border-lime-200 text-primary-ink text-xs font-semibold shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Generation Link Management Platform</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#1a1a1a] leading-[1.15]">
                Shorten, analyze, and automate links at <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-ink to-lime-500">cloud scale</span>.
              </h1>
              
              <p className="text-sm sm:text-base text-[#666666] max-w-xl leading-relaxed">
                Empower your business with smart device routing, custom branded domains, QR code studio, and privacy-first analytics with zero tracking bloat.
              </p>
            </div>

            {/* Feature List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((b, idx) => {
                const IconComponent = b.icon;
                return (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl bg-white border border-[#e3e3e3] shadow-sm shadow-lime-500/5 hover:border-lime-200 transition space-y-1.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-lime-50 text-primary-ink flex items-center justify-center mb-2">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-[#1a1a1a]">{b.title}</h3>
                    <p className="text-[11px] text-[#666666] leading-relaxed">{b.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Trust Indicator Metrics */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-[#666666]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-[#1a1a1a]">99.99%</span> Uptime SLA
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-[#1a1a1a]">No Credit Card</span> Required
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-[#1a1a1a]">Instant</span> Setup
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="bg-white rounded-xl border border-[#e3e3e3] p-6 sm:p-8 shadow-2xl shadow-lime-500/10 space-y-6 relative backdrop-blur-xl">
              
              {/* Top Accent Gradient Bar */}
              <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-lime-500 via-lime-500 to-lime-500 rounded-full" />

              {/* Mode Toggle Header */}
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">
                  {mode === 'login' ? 'Welcome back' : 'Create an account'}
                </h2>
                <p className="text-xs text-[#666666]">
                  {mode === 'login' 
                    ? 'Enter your credentials to manage your links & workspace'
                    : 'Start creating fast links with enterprise analytics'}
                </p>
              </div>

              {/* Tab Selector */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#fafafa] border border-[#e3e3e3] rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                  className={`py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-[#1a1a1a] shadow-xs'
                      : 'text-[#666666] hover:text-[#1a1a1a]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
                  className={`py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-white text-[#1a1a1a] shadow-xs'
                      : 'text-[#666666] hover:text-[#1a1a1a]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{error}</span>
                </div>
              )}

              {/* Success Alert */}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{successMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#1a1a1a]">Full Name</label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Alex Morgan"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 bg-white border border-[#e3e3e3] hover:border-[#dcdcdc] focus:border-primary-strong focus:ring-2 focus:ring-primary-strong/15 rounded-lg text-xs text-[#1a1a1a] placeholder-[#666666]/50 outline-none transition"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#1a1a1a]">Work Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 pl-10 pr-3 bg-white border border-[#e3e3e3] hover:border-[#dcdcdc] focus:border-primary-strong focus:ring-2 focus:ring-primary-strong/15 rounded-lg text-xs text-[#1a1a1a] placeholder-[#666666]/50 outline-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#1a1a1a]">Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setSuccessMsg('Password reset instructions sent to your email.')}
                        className="text-[11px] font-medium text-primary-ink hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 pl-10 pr-10 bg-white border border-[#e3e3e3] hover:border-[#dcdcdc] focus:border-primary-strong focus:ring-2 focus:ring-primary-strong/15 rounded-lg text-xs text-[#1a1a1a] placeholder-[#666666]/50 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#1a1a1a] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <p className="text-[11px] text-[#666666]">Minimum 6 characters with secure salted hash.</p>
                  )}
                </div>

                {mode === 'login' && (
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-[#e3e3e3] text-primary-ink focus:ring-primary-strong cursor-pointer"
                      />
                      <span className="text-xs text-[#666666]">Keep me signed in</span>
                    </label>
                  </div>
                )}

                {/* Primary Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="lg"
                  className="w-full h-11 bg-primary-container hover:bg-lime-500 text-on-primary rounded-lg text-xs font-bold shadow-md shadow-lime-500/20 transition cursor-pointer"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{mode === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>{mode === 'login' ? 'Sign In to Workspace' : 'Get Started Free'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>

              {/* Trust Footer */}
              <div className="pt-3 border-t border-[#e3e3e3] flex items-center justify-between text-[11px] text-[#666666]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>256-Bit SSL Encryption</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary-ink shrink-0" />
                  <span>SOC2 & GDPR Compliant</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 border-t border-[#e3e3e3]/60 text-xs text-[#666666] flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>© 2026 TinyURL.app. Built for high-throughput link infrastructure.</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-[#1a1a1a] transition">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-[#1a1a1a] transition">Terms of Service</Link>
          <Link href="/" className="hover:text-[#1a1a1a] transition">Documentation</Link>
        </div>
      </footer>

    </div>
  );
};
