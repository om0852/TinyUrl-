/**
 * High-performance API Client for TinyURL Shortener Platform
 * Supports both API Key Bearer / x-api-key headers, multi-tenant workspace context,
 * and handles all endpoints natively with standard fetch.
 */

export class TinyUrlClient {
  constructor(config = {}) {
    this.apiUrl = (config.apiUrl || 'http://localhost:3000').replace(/\/+$/, '');
    this.apiKey = (config.apiKey || '').trim();
    // Empty means "the API key's own workspace", looked up on the first request
    // (keys only work in the workspace they were created in; ws_default is not shared any more)
    this.workspaceId = (config.workspaceId || '').trim();
    this._workspaceLookup = null;
  }

  /**
   * Workspace for this client: the configured one, or the API key's own workspace
   */
  async resolveWorkspace() {
    if (this.workspaceId || !this.apiKey) return this.workspaceId;
    if (!this._workspaceLookup) {
      this._workspaceLookup = fetch(`${this.apiUrl}/api/v1/api-keys?whoami=1`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.apiKey}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d?.success && d.key?.workspace_id) this.workspaceId = d.key.workspace_id;
          return this.workspaceId;
        })
        .catch(() => this.workspaceId);
    }
    return this._workspaceLookup;
  }

  /**
   * Internal HTTP request dispatcher
   */
  async request(endpoint, options = {}) {
    // Methods build their URL and body before the key's workspace is known; fill it in here
    const ws = options.workspaceId || await this.resolveWorkspace();
    if (ws) {
      endpoint = endpoint.replace(/([?&]workspace_id=)(?=&|$)/, `$1${encodeURIComponent(ws)}`);
      if (options.body && typeof options.body === 'object' && 'workspace_id' in options.body && !options.body.workspace_id) {
        options.body = { ...options.body, workspace_id: ws };
      }
    }
    const url = `${this.apiUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = {
      'Accept': 'application/json',
      ...(ws ? { 'x-workspace-id': ws } : {}),
      ...options.headers
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['x-api-key'] = this.apiKey;
    }

    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      let json;
      const text = await response.text();
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!response.ok) {
        const errorMsg = json?.error || json?.message || `HTTP ${response.status} ${response.statusText}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = json;
        throw err;
      }

      return json;
    } catch (err) {
      if (err.status) throw err;
      const connectionErr = new Error(`Failed to connect to ${this.apiUrl}: ${err.message}`);
      connectionErr.original = err;
      throw connectionErr;
    }
  }

  // --- Links & Shortening ---

  async shorten(payload) {
    return this.request('/api/v1/shorten', {
      method: 'POST',
      body: {
        workspace_id: this.workspaceId,
        ...payload
      }
    });
  }

  async listLinks(params = {}) {
    const qs = new URLSearchParams();
    qs.set('workspace_id', params.workspaceId || this.workspaceId);
    if (params.code) qs.set('code', params.code);
    return this.request(`/api/v1/links?${qs.toString()}`, { method: 'GET' });
  }

  async getLink(codeOrSlug) {
    const qs = new URLSearchParams({ code: codeOrSlug });
    return this.request(`/api/v1/links?${qs.toString()}`, { method: 'GET' });
  }

  async updateLink(payload) {
    return this.request('/api/v1/links', {
      method: 'PATCH',
      body: {
        workspace_id: this.workspaceId,
        ...payload
      }
    });
  }

  async deleteLink(idOrCode) {
    const qs = new URLSearchParams({ id: idOrCode });
    return this.request(`/api/v1/links?${qs.toString()}`, { method: 'DELETE' });
  }

  async bulkImport(items, batchName) {
    return this.request('/api/v1/links/bulk', {
      method: 'POST',
      body: {
        workspace_id: this.workspaceId,
        batch_name: batchName || `CLI Batch ${new Date().toLocaleDateString()}`,
        items
      }
    });
  }

  async getLinkHealth(workspaceId) {
    const ws = workspaceId || this.workspaceId;
    return this.request(`/api/v1/links/health?workspace_id=${encodeURIComponent(ws)}`, { method: 'GET' });
  }

  async probeLinkHealth(params = {}) {
    return this.request('/api/v1/links/health', {
      method: 'POST',
      body: {
        workspace_id: params.workspaceId || this.workspaceId,
        link_id: params.linkId
      }
    });
  }

  async unlockProtectedLink(code, password) {
    return this.request('/api/v1/links/unlock', {
      method: 'POST',
      body: { code, password }
    });
  }

  // --- Analytics ---

  async getAnalytics(params = {}) {
    const qs = new URLSearchParams();
    if (params.code) qs.set('code', params.code);
    if (params.workspaceId || (!params.code && this.workspaceId)) {
      qs.set('workspace_id', params.workspaceId || this.workspaceId);
    }
    return this.request(`/api/v1/analytics?${qs.toString()}`, { method: 'GET' });
  }

  async resetAnalytics(params = {}) {
    return this.request('/api/v1/analytics/reset', {
      method: 'POST',
      body: {
        workspace_id: params.workspaceId || (!params.linkId && !params.shortCode ? this.workspaceId : undefined),
        link_id: params.linkId,
        short_code: params.shortCode
      }
    });
  }

  // --- Marketing Campaigns ---

  async listCampaigns(workspaceId) {
    const ws = workspaceId || this.workspaceId;
    return this.request(`/api/v1/campaigns?workspace_id=${encodeURIComponent(ws)}`, { method: 'GET' });
  }

  async createCampaign(payload) {
    return this.request('/api/v1/campaigns', {
      method: 'POST',
      body: {
        workspace_id: this.workspaceId,
        ...payload
      }
    });
  }

  async deleteCampaign(id) {
    const qs = new URLSearchParams({ id });
    return this.request(`/api/v1/campaigns?${qs.toString()}`, { method: 'DELETE' });
  }

  // --- Custom Domains ---

  async listDomains(workspaceId) {
    const ws = workspaceId || this.workspaceId;
    return this.request(`/api/v1/domains?workspace_id=${encodeURIComponent(ws)}`, { method: 'GET' });
  }

  async addDomain(payload) {
    return this.request('/api/v1/domains', {
      method: 'POST',
      body: {
        workspace_id: this.workspaceId,
        ...payload
      }
    });
  }

  async verifyDomain(hostnameOrId) {
    return this.request('/api/v1/domains', {
      method: 'PATCH',
      body: {
        workspace_id: this.workspaceId,
        hostname: hostnameOrId,
        id: hostnameOrId
      }
    });
  }

  async probeDomain(domain) {
    const qs = new URLSearchParams({ domain });
    return this.request(`/api/v1/domains/probe?${qs.toString()}`, { method: 'GET' });
  }

  async deleteDomain(idOrHostname) {
    const qs = new URLSearchParams({ id: idOrHostname });
    return this.request(`/api/v1/domains?${qs.toString()}`, { method: 'DELETE' });
  }

  // --- API Keys ---

  async listApiKeys(workspaceId) {
    const ws = workspaceId || this.workspaceId;
    return this.request(`/api/v1/api-keys?workspace_id=${encodeURIComponent(ws)}`, { method: 'GET' });
  }

  async createApiKey(payload) {
    return this.request('/api/v1/api-keys', {
      method: 'POST',
      body: {
        workspace_id: this.workspaceId,
        ...payload
      }
    });
  }

  async revokeApiKey(id) {
    const qs = new URLSearchParams({ id });
    return this.request(`/api/v1/api-keys?${qs.toString()}`, { method: 'DELETE' });
  }

  // --- Webhooks ---

  async listWebhooks(workspaceId) {
    const ws = workspaceId || this.workspaceId;
    return this.request(`/api/v1/webhooks?workspace_id=${encodeURIComponent(ws)}`, { method: 'GET' });
  }

  async createWebhook(payload) {
    return this.request('/api/v1/webhooks', {
      method: 'POST',
      body: {
        workspace_id: this.workspaceId,
        ...payload
      }
    });
  }

  async testWebhook(id) {
    return this.request('/api/v1/webhooks/test', {
      method: 'POST',
      body: { webhook_id: id, workspace_id: this.workspaceId }
    });
  }

  async deleteWebhook(id) {
    const qs = new URLSearchParams({ id });
    return this.request(`/api/v1/webhooks?${qs.toString()}`, { method: 'DELETE' });
  }

  // --- Workspaces & Members ---

  async listWorkspaces(params = {}) {
    const qs = new URLSearchParams();
    if (params.id) qs.set('id', params.id);
    if (params.email) qs.set('email', params.email);
    return this.request(`/api/v1/workspaces?${qs.toString()}`, { method: 'GET' });
  }

  async createWorkspace(payload) {
    return this.request('/api/v1/workspaces', {
      method: 'POST',
      body: payload
    });
  }

  async listMembers(workspaceId) {
    const ws = workspaceId || this.workspaceId;
    return this.request(`/api/v1/workspaces/members?workspace_id=${encodeURIComponent(ws)}`, { method: 'GET' });
  }

  async inviteMember(payload) {
    return this.request('/api/v1/workspaces/members', {
      method: 'POST',
      body: {
        workspace_id: this.workspaceId,
        ...payload
      }
    });
  }

  async removeMember(payload = {}) {
    const qs = new URLSearchParams();
    if (payload.id) qs.set('id', payload.id);
    if (payload.email) {
      qs.set('email', payload.email);
      qs.set('workspace_id', payload.workspace_id || this.workspaceId);
    }
    return this.request(`/api/v1/workspaces/members?${qs.toString()}`, { method: 'DELETE' });
  }

  // --- Security & Cache Health ---

  async runSecurityAudit(params = {}) {
    return this.request('/api/v1/security/audit', {
      method: 'POST',
      body: {
        workspace_id: params.workspaceId || this.workspaceId,
        link_ids: params.linkIds
      }
    });
  }

  async getCacheHealth() {
    return this.request('/api/v1/cache/health', { method: 'GET' });
  }

  // --- Client Portals ---

  async listClients(workspaceId) {
    const ws = workspaceId || this.workspaceId;
    return this.request(`/api/v1/clients?workspace_id=${encodeURIComponent(ws)}`, { method: 'GET' });
  }

  async createClient(payload) {
    return this.request('/api/v1/clients', {
      method: 'POST',
      body: {
        workspace_id: this.workspaceId,
        ...payload
      }
    });
  }
}
