'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { X, Layers, Plus, Check } from 'lucide-react';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ isOpen, onClose }) => {
  const { createWorkspace } = useStore();
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createWorkspace(name.trim(), plan);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setName('');
      onClose();
    }, 1000);
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#008296]/20 text-[#008296] rounded-xl flex items-center justify-center border border-[#008296]/30 shrink-0">
            <Layers className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Create New Workspace Team</h3>
            <p className="text-xs text-slate-300">Group members, short links, and campaigns under a dedicated workspace</p>
          </div>
        </div>

        {success ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 font-bold justify-center">
            <Check className="w-5 h-5" /> Workspace Created & Switched!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Team / Workspace Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Marketing Ops Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Select Tier Plan</label>
              <div className="grid grid-cols-3 gap-2">
                {(['free', 'pro', 'enterprise'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`py-2 px-3 rounded-xl border text-center font-bold capitalize transition ${
                      plan === p
                        ? 'bg-[#008296] text-white border-[#008296]'
                        : 'bg-[#052536] text-slate-300 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 tinyurl-btn-teal text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40 text-xs mt-2"
            >
              <Plus className="w-4 h-4" /> Create Workspace
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
