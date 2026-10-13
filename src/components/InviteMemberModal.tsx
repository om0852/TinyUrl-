'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { WorkspaceRole } from '@/lib/types';
import { X, UserPlus, Check } from 'lucide-react';
import { Button } from './ui/button';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ isOpen, onClose }) => {
  const { inviteTeamMember, currentWorkspace } = useStore();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    inviteTeamMember(name, email, role);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setName('');
      setEmail('');
      onClose();
    }, 1000);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border border-border/60 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 text-foreground relative z-10">
        
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
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Invite Team Member</h3>
            <p className="text-xs text-muted-foreground">Grant access to <strong className="text-foreground">{currentWorkspace.name}</strong></p>
          </div>
        </div>

        {success ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-xs flex items-center gap-2 font-bold justify-center">
            <Check className="w-4 h-4 text-emerald-500" /> Member Added Successfully!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-foreground font-semibold text-xs mb-1.5">Member Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Sarah Jenkins"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold text-xs mb-1.5">Email Address</label>
              <input
                type="email"
                required
                placeholder="sarah@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold text-xs mb-1.5">Access Role Privilege</label>
              <div className="grid grid-cols-3 gap-2">
                {(['admin', 'editor', 'viewer'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`h-9 rounded-lg border text-center font-bold capitalize text-xs transition cursor-pointer ${
                      role === r
                        ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25'
                        : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-xs font-bold mt-2"
            >
              Send Workspace Invite
            </Button>
          </form>
        )}

      </div>
    </div>,
    document.body
  );
};
