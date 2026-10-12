'use client';

import React, { useState } from 'react';
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
  Zap,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { login, signup } = useStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      if (mode === 'signup') {
        signup(name, email, password);
      } else {
        login(email, password);
      }
      setIsLoading(false);
      if (onSuccess) onSuccess();
    }, 400);
  };

  const handleDemoLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      login('alex@acme.com', 'password123');
      setIsLoading(false);
      if (onSuccess) onSuccess();
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 text-foreground antialiased relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] bg-card rounded-2xl border border-border/40 p-6 sm:p-8 shadow-xl space-y-6 relative z-10 backdrop-blur-xl">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full mb-1">
            <div className="w-5 h-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-md shadow-primary/30">
              <Link2 className="w-3 h-3" />
            </div>
            <span className="text-xs font-bold text-foreground tracking-tight">
              TinyURL<span className="text-primary">.app</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mode === 'login' ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {mode === 'login' 
              ? 'Enter your credentials to access your link infrastructure.' 
              : 'Start securing links with enterprise routing and zero-latency analytics.'}
          </p>
        </div>

        {/* Toggle Mode Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted/40 border border-border/40 rounded-lg">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`h-8 rounded-md text-xs font-semibold transition cursor-pointer ${
              mode === 'login' 
                ? 'bg-card text-foreground shadow-sm border border-border/60' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            className={`h-8 rounded-md text-xs font-semibold transition cursor-pointer ${
              mode === 'signup' 
                ? 'bg-card text-foreground shadow-sm border border-border/60' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 pl-9 pr-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-foreground">Password</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setError('Password reset link sent to registered email.')}
                  className="text-[11px] text-primary hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 pl-9 pr-9 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <Button
            type="submit"
            disabled={isLoading}
            size="lg"
            className="w-full text-xs font-bold"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In to Console' : 'Create Free Account'}</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-semibold text-muted-foreground">
            <span className="bg-card px-2">or quick access</span>
          </div>
        </div>

        {/* One-click Demo Login */}
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isLoading}
          className="w-full h-9 rounded-lg bg-muted/30 hover:bg-muted border border-border/60 text-xs font-medium text-foreground flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span>One-Click Demo Sign-In (Alex Morgan)</span>
        </button>

        {/* Security / Trust Badges */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Encrypted Session</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Cloud Edge Routing</span>
          </div>
        </div>

      </div>
    </div>
  );
};
