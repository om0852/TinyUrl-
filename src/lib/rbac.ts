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
  | 'clients:manage'
  | 'analytics:read'
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
    'clients:manage',
    'analytics:read',
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
    'clients:manage',
    'analytics:read',
    'export:data'
  ],
  editor: [
    'links:create',
    'links:edit',
    'campaigns:create',
    'analytics:read',
    'export:data'
  ],
  viewer: [
    'analytics:read',
    'export:data'
  ]
};

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, { title: string; badgeColor: string; description: string }> = {
  owner: {
    title: 'Workspace Owner',
    badgeColor: 'bg-primary-container text-on-primary',
    description: 'Everything, including workspace settings and deletion.'
  },
  admin: {
    title: 'Workspace Admin',
    badgeColor: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    description: 'Manage links, campaigns, members, domains and API keys.'
  },
  editor: {
    title: 'Campaign Editor',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    description: 'Create and edit links and campaigns, and see analytics.'
  },
  viewer: {
    title: 'Read-only Viewer',
    badgeColor: 'bg-zinc-500/10 text-zinc-600 border border-zinc-500/20',
    description: 'View links and analytics only.'
  }
};

export function hasPermission(role: WorkspaceRole | string | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const normalizedRole = role.toLowerCase() as WorkspaceRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole] || [];
  return permissions.includes(permission);
}
