'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { X, Lock, Mail, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, signup } = useStore();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (mode === 'login') {
      login(email, password);
    } else {
      signup(name || 'New User', email, password);
    }
    onClose();
  };

  const handleDemoSocial = (provider: string) => {
    if (mode === 'login') {
      login(`demo.${provider}@tinyurl.pro`, 'demo1234');
    } else {
      signup(`${provider.charAt(0).toUpperCase() + provider.slice(1)} User`, `demo.${provider}@tinyurl.pro`, 'demo1234');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#072e42] border border-[#0b4566] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 text-white relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#008296]/20 text-[#008296] rounded-xl mb-2 border border-[#008296]/30">
            <Lock className="w-6 h-6 text-cyan-300" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white font-sans">
            {mode === 'login' ? 'Welcome Back to TinyURL' : 'Create TinyURL Account'}
          </h2>
          <p className="text-xs text-slate-300">
            {mode === 'login'
              ? 'Access your analytics, workspaces, and custom links'
              : 'Start shortening links with team workspaces & custom domains'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#052536] p-1 rounded-xl border border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg transition ${
              mode === 'login' ? 'bg-[#008296] text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-lg transition ${
              mode === 'signup' ? 'bg-[#008296] text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up Free
          </button>
        </div>

        {/* Quick Social Buttons */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleDemoSocial('google')}
            className="flex items-center justify-center gap-2 py-2 px-3 bg-[#052536] hover:bg-[#07334a] border border-white/10 rounded-xl font-medium text-slate-200 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={() => handleDemoSocial('github')}
            className="flex items-center justify-center gap-2 py-2 px-3 bg-[#052536] hover:bg-[#07334a] border border-white/10 rounded-xl font-medium text-slate-200 transition"
          >
            <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>

        <div className="relative flex items-center justify-center my-2">
          <div className="border-t border-white/10 w-full"></div>
          <span className="bg-[#072e42] px-3 text-[10px] uppercase font-bold text-slate-400">or with email</span>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {mode === 'signup' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="alex@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 tinyurl-btn-teal text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40 text-xs mt-2"
          >
            <span>{mode === 'login' ? 'Sign In to Account' : 'Create Free Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-white/10 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 256-Bit SSL Encrypted Enterprise Auth
          </p>
        </div>

      </div>
    </div>
  );
};
