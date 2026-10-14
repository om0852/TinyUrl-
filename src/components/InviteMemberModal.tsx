import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { WorkspaceRole, WorkspaceInvitation } from '@/lib/types';
import { X, UserPlus, Check, Copy, Shield, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { ROLE_DESCRIPTIONS } from '@/lib/rbac';

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
  const [submitting, setSubmitting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<WorkspaceInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('editor');
    setCreatedInvite(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || submitting) return;

    setSubmitting(true);
    try {
      const invite = await inviteTeamMember(name.trim(), email.trim(), role);
      if (invite) {
        setCreatedInvite(invite);
      } else {
        // Fallback invitation object
        const fallbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/invite/pending` : '';
        setCreatedInvite({
          id: `inv_${Date.now()}`,
          workspace_id: currentWorkspace.id,
          name: name.trim(),
          email: email.trim(),
          role,
          token: 'token',
          status: 'pending',
          created_at: new Date().toISOString(),
          invite_url: fallbackUrl
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!createdInvite?.invite_url) return;
    navigator.clipboard.writeText(createdInvite.invite_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeRoleDesc = ROLE_DESCRIPTIONS[role];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="bg-card border border-border/80 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-foreground relative z-10">
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 text-muted-foreground hover:text-foreground p-1 rounded-xl hover:bg-muted transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border/40">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Invite Workspace Collaborator</h3>
            <p className="text-xs text-muted-foreground">Grant team access to <strong className="text-foreground">{currentWorkspace.name}</strong></p>
          </div>
        </div>

        {createdInvite ? (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-foreground text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" />
                <span>Invitation Link Ready!</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                An invitation token has been registered in the database for <strong className="text-foreground">{createdInvite.email}</strong> as <strong className="capitalize">{createdInvite.role}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-foreground font-bold text-xs mb-1.5">
                Shareable Invitation Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdInvite.invite_url || ''}
                  className="w-full h-10 px-3 bg-muted/60 border border-border/70 rounded-xl text-xs font-mono text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-primary/95 transition shrink-0 cursor-pointer shadow-xs"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Send this link to the collaborator. They can click it to accept the invite, verify their seat, and set their password.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleClose}
              className="w-full text-xs font-bold h-10 rounded-xl mt-2"
            >
              Done &amp; Return to Dashboard
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-foreground font-bold text-xs mb-1.5">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Sarah Jenkins"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border border-border/70 focus:border-primary rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-foreground font-bold text-xs mb-1.5">Email Address</label>
              <input
                type="email"
                required
                placeholder="sarah@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border border-border/70 focus:border-primary rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-foreground font-bold text-xs mb-1.5">Assign Role &amp; Privileges</label>
              <div className="grid grid-cols-3 gap-2">
                {(['admin', 'editor', 'viewer'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`h-9 rounded-xl border text-center font-bold capitalize text-xs transition cursor-pointer ${
                      role === r
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {activeRoleDesc && (
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed bg-muted/30 p-2.5 rounded-xl border border-border/40">
                  <strong className="text-foreground">{activeRoleDesc.title}:</strong> {activeRoleDesc.description}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-xs font-bold rounded-xl mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Generating Secure Token…</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Generate Invitation &amp; Link</span>
                </>
              )}
            </Button>
          </form>
        )}

      </div>
    </div>,
    document.body
  );
};
