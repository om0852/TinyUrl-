'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { X, Layers, Check } from 'lucide-react';
import { Button } from './ui/button';

import { InfoTooltip } from './ui/InfoTooltip';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="bg-card border border-border/60 w-full max-w-md rounded-xl p-6 shadow-2xl space-y-5 text-foreground relative z-10">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border/40">
          <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0 border border-primary/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Create New Workspace</h3>
            <p className="text-xs text-muted-foreground">Organize link infrastructure and team privileges</p>
          </div>
        </div>

        {success ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-xs flex items-center gap-2 font-bold justify-center">
            <Check className="w-4 h-4 text-emerald-500" /> Workspace Created &amp; Activated!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-foreground font-semibold text-xs mb-1.5 flex items-center">
                <span>Workspace Name</span>
                <InfoTooltip text="Unique organization or team workspace to isolate links, custom domains, and analytics." />
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Growth &amp; Security Operations"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <div>
              <label className="text-foreground font-semibold text-xs mb-1.5 flex items-center">
                <span>Select Tier Plan</span>
                <InfoTooltip text="Choose your workspace subscription tier. All plans provide high performance edge routing." />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['free', 'pro', 'enterprise'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`h-9 rounded-lg border text-center font-bold capitalize text-xs transition cursor-pointer ${
                      plan === p
                        ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25'
                        : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-xs font-bold mt-2"
            >
              Create Workspace
            </Button>
          </form>
        )}

      </div>
    </div>
  );
};
