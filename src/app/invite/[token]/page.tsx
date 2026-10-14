'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Link2, 
  ShieldCheck, 
  UserCheck, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Lock, 
  Building2,
  Users
} from 'lucide-react';
import { ROLE_DESCRIPTIONS } from '@/lib/rbac';
import { WorkspaceRole } from '@/lib/types';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

interface InvitationData {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  inviter_email: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  expires_at?: string;
}

export default function InviteAcceptPage({ params }: InvitePageProps) {
  const router = useRouter();
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch invitation details
  useEffect(() => {
    if (!token) return;

    fetch(`/api/v1/invitations?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json();
        if (res.ok && data.success && data.invitation) {
          setInvitation(data.invitation);
          setName(data.invitation.name || '');
        } else {
          setError(data.error || 'Failed to verify invitation.');
        }
      })
      .catch(() => {
        setError('Network error while verifying invitation. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/v1/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password: password.trim()
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.user && data.workspace) {
        setSuccess(true);

        // Store active session and workspace
        try {
          localStorage.setItem('url_shortener_user', JSON.stringify(data.user));
          localStorage.setItem('url_shortener_current_workspace_id', data.workspace.id);
          
          const rawWs = localStorage.getItem('url_shortener_workspaces');
          let wsList = [];
          if (rawWs) {
            try { wsList = JSON.parse(rawWs); } catch {}
          }
          if (!wsList.some((w: { id: string }) => w.id === data.workspace.id)) {
            wsList.unshift(data.workspace);
            localStorage.setItem('url_shortener_workspaces', JSON.stringify(wsList));
          }
          window.dispatchEvent(new Event('url_shortener_sync'));
        } catch {}

        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        setSubmitError(data.error || 'Failed to accept invitation.');
      }
    } catch {
      setSubmitError('An unexpected network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleMeta = invitation ? ROLE_DESCRIPTIONS[invitation.role] || ROLE_DESCRIPTIONS.editor : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between items-center relative overflow-hidden px-4 py-8">
      
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header Logo */}
      <header className="w-full flex justify-center pb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card shadow-xs border border-border/60">
          <Link2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold tracking-tight text-foreground">TinyURL</span>
          <span className="text-[11px] px-1.5 py-0.2 rounded font-mono bg-muted text-muted-foreground">Team Portal</span>
        </div>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-md my-auto">
        <div className="bg-card/90 backdrop-blur-md border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative">

          {/* Loading State */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
              <h2 className="text-lg font-bold">Verifying Invitation…</h2>
              <p className="text-xs text-muted-foreground">Checking security token &amp; workspace privileges</p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold">Invitation Not Found</h2>
              <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
              <button
                onClick={() => router.push('/')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-sm cursor-pointer"
              >
                Go to Homepage
              </button>
            </div>
          )}

          {/* Success State */}
          {!loading && success && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Welcome to the Team!</h2>
              <p className="text-xs text-muted-foreground">
                You have joined <strong className="text-foreground">{invitation?.workspace_name}</strong> as <strong className="capitalize">{invitation?.role}</strong>.
              </p>
              <div className="inline-flex items-center gap-2 text-xs text-primary font-semibold animate-pulse pt-2">
                <span>Entering Workspace Dashboard…</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Active Accept Form */}
          {!loading && !error && !success && invitation && (
            <div className="space-y-6">
              
              {/* Workspace Badge Header */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Workspace Collaboration</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Join {invitation.workspace_name}
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">{invitation.inviter_email}</span> has invited you to collaborate.
                </p>
              </div>

              {/* Role & Permissions Card */}
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">Assigned Seat:</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary text-primary-foreground">
                    {invitation.role}
                  </span>
                </div>
                {roleMeta && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {roleMeta.description}
                  </p>
                )}
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Join Form */}
              <form onSubmit={handleAccept} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full h-10 px-3.5 bg-background border border-border/80 focus:border-primary rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Invited Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={invitation.email}
                    className="w-full h-10 px-3.5 bg-muted/60 border border-border/40 rounded-xl text-xs text-muted-foreground font-mono outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center justify-between">
                    <span>Account Password</span>
                    <span className="text-[11px] text-muted-foreground font-normal">Min. 6 chars</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter or set your password"
                      className="w-full h-10 pl-3.5 pr-10 bg-background border border-border/80 focus:border-primary rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
                    />
                    <Lock className="w-4 h-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-primary/20 transition active:scale-[0.98] cursor-pointer disabled:opacity-50 mt-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      <span>Activating Membership…</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Accept Invite &amp; Enter Workspace</span>
                    </>
                  )}
                </button>
              </form>

            </div>
          )}

        </div>
      </main>

      {/* Footer Note */}
      <footer className="text-center text-xs text-muted-foreground pt-6">
        <span>Protected by enterprise-grade cryptographic token verification &amp; PBKDF2 authentication</span>
      </footer>

    </div>
  );
}
