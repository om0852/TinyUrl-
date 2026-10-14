import { WorkspaceRole } from './types';

export type Permission =
  | 'links:create'
  | 'links:edit'
  | 'links:delete'
  | 'campaigns:create'
  | 'campaigns:delete'
  | 'members:invite'
  | 'members:remove'
  | 'domains:manage'
  | 'api_keys:manage'
  | 'settings:manage'
  | 'export:data';

export const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  owner: [
    'links:create',
    'links:edit',
    'links:delete',
    'campaigns:create',
    'campaigns:delete',
    'members:invite',
    'members:remove',
    'domains:manage',
    'api_keys:manage',
    'settings:manage',
    'export:data'
  ],
  admin: [
    'links:create',
    'links:edit',
    'links:delete',
    'campaigns:create',
    'campaigns:delete',
    'members:invite',
    'members:remove',
    'domains:manage',
    'api_keys:manage',
    'export:data'
  ],
  editor: [
    'links:create',
    'links:edit',
    'campaigns:create',
    'export:data'
  ],
  viewer: [
    'export:data'
  ]
};

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, { title: string; badgeColor: string; description: string }> = {
  owner: {
    title: 'Workspace Owner',
    badgeColor: 'bg-primary-container text-on-primary',
    description: 'Full administrative authority: can manage workspace billing, delete resources, invite/remove members, and manage all links & campaigns.'
  },
  admin: {
    title: 'Workspace Admin',
    badgeColor: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    description: 'Operational manager: can invite members, create/delete campaigns, manage custom domains, and configure links.'
  },
  editor: {
    title: 'Campaign Editor',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    description: 'Content creator: can create and customize short links, create marketing campaigns, and review traffic metrics. Cannot remove team members or alter domains.'
  },
  viewer: {
    title: 'Read-only Viewer',
    badgeColor: 'bg-zinc-500/10 text-zinc-600 border border-zinc-500/20',
    description: 'Stakeholder / auditor: can view live links, campaign progress, and analytics reports. Cannot create, edit, or delete items.'
  }
};

export function hasPermission(role: WorkspaceRole | string | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const normalizedRole = role.toLowerCase() as WorkspaceRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole] || [];
  return permissions.includes(permission);
}
