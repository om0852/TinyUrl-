import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { WorkspaceRole, WorkspaceInvitation } from '@/lib/types';
import { X, UserPlus, Check, Copy, Shield, ExternalLink, Sparkles, Mail } from 'lucide-react';
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
      // On failure the store shows the reason and the form stays open to retry
      if (invite) setCreatedInvite(invite);
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
      <div className="bg-card border-[0.5px] border-outline-variant w-full max-w-md rounded-xl p-6 sm:p-7 shadow-2xl space-y-5 text-foreground relative z-10">
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-outline-variant">
          <div className="w-10 h-10 bg-primary/10 text-primary-ink rounded-lg flex items-center justify-center shrink-0 border border-primary-strong/20">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Invite to {currentWorkspace.name}</h3>
          </div>
        </div>

        {createdInvite ? (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-foreground text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" />
                <span>Invite created</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Send <strong className="text-foreground">{createdInvite.email}</strong> this link to join as <span className="capitalize">{createdInvite.role}</span>.
              </p>
            </div>

            <div>
              <label className="block text-foreground font-bold text-xs mb-1.5">
                Invite link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdInvite.invite_url || ''}
                  className="w-full h-10 px-3 bg-muted/60 border-[0.5px] border-outline-variant rounded-lg text-xs font-mono text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-primary/95 transition shrink-0 cursor-pointer shadow-xs"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <a
                href={`mailto:${encodeURIComponent(createdInvite.email)}?subject=${encodeURIComponent(`Invitation to join ${currentWorkspace.name} on TinyUrl`)}&body=${encodeURIComponent(`Hi ${createdInvite.name},\n\nYou have been invited to collaborate on our TinyUrl workspace "${currentWorkspace.name}" as an ${createdInvite.role}.\n\nAccept your invite here:\n${createdInvite.invite_url}\n\nThis invitation link expires in 7 days.`)}`}
                className="w-full sm:w-1/2 h-10 px-3 rounded-lg bg-secondary/80 hover:bg-secondary text-foreground text-xs font-semibold flex items-center justify-center gap-2 border-[0.5px] border-outline-variant transition cursor-pointer"
              >
                <Mail className="w-4 h-4 text-primary-ink shrink-0" />
                <span>Send by email</span>
              </a>
              <Button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-1/2 text-xs font-bold h-10 rounded-lg"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-foreground font-bold text-xs mb-1.5">Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Sarah Jenkins"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border-[0.5px] border-outline-variant focus:border-primary-strong rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-foreground font-bold text-xs mb-1.5">Email</label>
              <input
                type="email"
                required
                placeholder="sarah@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border-[0.5px] border-outline-variant focus:border-primary-strong rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-foreground font-bold text-xs mb-1.5">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(['admin', 'editor', 'viewer'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`h-9 rounded-lg border text-center font-bold capitalize text-xs transition cursor-pointer ${
                      role === r
                        ? 'bg-primary text-primary-foreground border-primary-strong shadow-xs'
                        : 'bg-muted/40 text-muted-foreground border-outline-variant hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {activeRoleDesc && (
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-outline-variant">
                  {activeRoleDesc.description}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-xs font-bold rounded-lg mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Creating…</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create invite link</span>
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
