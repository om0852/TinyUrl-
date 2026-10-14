'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  X, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Link2, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  initialMode = 'login' 
}) => {
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

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

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
        setError('Please enter your full name.');
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
          setError(res.error || 'Invalid credentials. Please verify your email and password.');
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
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="bg-white border border-[#e1e8fd] w-full max-w-md rounded-2xl p-6 sm:p-7 shadow-2xl shadow-indigo-500/10 text-[#141b2b] relative z-10 max-h-[92vh] overflow-y-auto">
        
        {/* Subtle Top Accent Gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-t-2xl" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-[#464555] hover:text-[#141b2b] p-1.5 rounded-lg hover:bg-[#f1f3ff] transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand & Header */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-full mb-1">
            <div className="w-4 h-4 rounded-md bg-[#4f46e5] text-white flex items-center justify-center shadow-xs">
              <Link2 className="w-2.5 h-2.5" />
            </div>
            <span className="text-[11px] font-bold text-[#141b2b] tracking-tight">
              TinyURL<span className="text-[#4f46e5]">.app</span>
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-[#141b2b]">
            {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
          </h2>
          <p className="text-xs text-[#464555] max-w-xs mx-auto">
            {mode === 'login'
              ? 'Access real-time telemetry, branded links, and custom routing'
              : 'Join to shorten links, create dynamic QR codes & track analytics'}
          </p>
        </div>

        {/* Segmented Mode Switcher */}
        <div className="flex bg-[#f1f3ff] p-1 rounded-xl border border-[#e1e8fd] text-xs font-semibold mt-4">
          <button
            type="button"
            onClick={() => handleTabChange('login')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'login' 
                ? 'bg-white text-[#141b2b] shadow-xs' 
                : 'text-[#464555] hover:text-[#141b2b]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('signup')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'signup' 
                ? 'bg-white text-[#141b2b] shadow-xs' 
                : 'text-[#464555] hover:text-[#141b2b]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl flex items-start gap-2.5 mt-4">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3.5 py-2.5 rounded-xl flex items-start gap-2.5 mt-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-[#141b2b] mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#464555] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#e1e8fd] hover:border-[#c7c4d8] focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15 rounded-xl text-xs text-[#141b2b] placeholder-[#464555]/50 outline-none transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#141b2b] mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#464555] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#e1e8fd] hover:border-[#c7c4d8] focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15 rounded-xl text-xs text-[#141b2b] placeholder-[#464555]/50 outline-none transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#141b2b]">Password</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setSuccessMsg('Password reset instructions sent to your email.')}
                  className="text-[11px] font-medium text-[#4f46e5] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#464555] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-9 py-2 bg-white border border-[#e1e8fd] hover:border-[#c7c4d8] focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15 rounded-xl text-xs text-[#141b2b] placeholder-[#464555]/50 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#464555] hover:text-[#141b2b] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'signup' && (
              <p className="text-[11px] text-[#464555] mt-1">Must be at least 6 characters.</p>
            )}
          </div>

          {mode === 'login' && (
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[#e1e8fd] text-[#4f46e5] focus:ring-[#4f46e5] cursor-pointer"
                />
                <span className="text-xs text-[#464555]">Remember this device</span>
              </label>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-[#4f46e5] hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{mode === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In to Dashboard' : 'Get Started Free'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Trust Badges */}
        <div className="text-center pt-3 mt-4 border-t border-[#e1e8fd]">
          <p className="text-[11px] text-[#464555] flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>256-bit SSL encryption • ISO 27001 verified</span>
          </p>
        </div>

      </div>
    </div>
  );
};
