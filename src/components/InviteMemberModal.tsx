'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { WorkspaceRole } from '@/lib/types';
import { X, UserPlus, Check } from 'lucide-react';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ isOpen, onClose }) => {
  const { inviteTeamMember, currentWorkspace } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

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
            <UserPlus className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Invite Team Member</h3>
            <p className="text-xs text-slate-300">Grant access to <strong className="text-white">{currentWorkspace.name}</strong></p>
          </div>
        </div>

        {success ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 font-bold justify-center">
            <Check className="w-5 h-5" /> Member Invited & Added to Workspace!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Member Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Sarah Jenkins"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="sarah@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Access Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white outline-none font-semibold"
              >
                <option value="owner">Owner (Full admin & billing access)</option>
                <option value="admin">Admin (Manage team & links)</option>
                <option value="editor">Editor (Create & edit short links)</option>
                <option value="viewer">Viewer (Read-only analytics access)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 tinyurl-btn-teal text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40 text-xs mt-2"
            >
              <UserPlus className="w-4 h-4" /> Send Workspace Invite
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
