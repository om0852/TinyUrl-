import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL || '';

const fallbackClient = Object.assign(
  async () => [],
  {
    query: async () => []
  }
);

export type PostgresClient = Omit<ReturnType<typeof neon>, 'query'> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: <T = Record<string, any>>(queryText: string, params?: unknown[]) => Promise<T[]>;
};

export const sql: PostgresClient = connectionString 
  ? (neon(connectionString) as unknown as PostgresClient)
  : (fallbackClient as unknown as PostgresClient);

/**
 * Auto-initializes PostgreSQL tables in Neon if they do not exist yet.
 */
export async function initializeDatabase() {
  if (!connectionString) {
    return { success: false, error: 'DATABASE_URL environment variable is not configured.' };
  }
  try {
    // 0. Users & Auth
    await sql.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        role VARCHAR(32) DEFAULT 'owner',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`);

    // 1. Workspaces
    await sql.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        plan VARCHAR(32) DEFAULT 'pro',
        role VARCHAR(32) DEFAULT 'owner',
        owner_email VARCHAR(255),
        owner_id VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await sql.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);`).catch(() => {});
    await sql.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_id VARCHAR(64);`).catch(() => {});


    // 2. Custom Domains
    await sql.query(`
      CREATE TABLE IF NOT EXISTS domains (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64),
        hostname VARCHAR(255) UNIQUE NOT NULL,
        verified BOOLEAN DEFAULT false,
        ssl_status VARCHAR(32) DEFAULT 'pending',
        is_primary BOOLEAN DEFAULT false,
        verify_token VARCHAR(128),
        ownership_verified BOOLEAN DEFAULT false,
        routing_verified BOOLEAN DEFAULT false,
        root_redirect_url TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await sql.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS verify_token VARCHAR(128);`).catch(() => {});
    await sql.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS ownership_verified BOOLEAN DEFAULT false;`).catch(() => {});
    await sql.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS routing_verified BOOLEAN DEFAULT false;`).catch(() => {});
    await sql.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS root_redirect_url TEXT;`).catch(() => {});
    await sql.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);`).catch(() => {});

    // 3. Campaigns
    await sql.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        target_clicks INT DEFAULT 10000,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Links table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS links (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64),
        domain_id VARCHAR(64),
        campaign_id VARCHAR(64),
        title VARCHAR(255) NOT NULL,
        short_code VARCHAR(128) UNIQUE NOT NULL,
        custom_slug VARCHAR(128),
        destination_url TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'active',
        clicks_count INT DEFAULT 0,
        tags JSONB DEFAULT '[]'::jsonb,
        rules JSONB DEFAULT '[]'::jsonb,
        password_hash VARCHAR(255),
        expires_at TIMESTAMPTZ,
        max_clicks INT,
        is_flagged BOOLEAN DEFAULT false,
        risk_score INT DEFAULT 0,
        utm_source VARCHAR(128),
        utm_medium VARCHAR(128),
        utm_campaign VARCHAR(128),
        utm_term VARCHAR(128),
        utm_content VARCHAR(128),
        og_title VARCHAR(255),
        og_description TEXT,
        og_image_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Index on short_code and custom_slug for instant lookups
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_links_short_code ON links (short_code);
    `);
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_links_custom_slug ON links (custom_slug);
    `);

    // Migration: ensure new link configuration columns exist
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS redirect_type VARCHAR(32) DEFAULT 'direct';`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS http_status_code INT DEFAULT 301;`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS notes TEXT;`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS shield_protection BOOLEAN DEFAULT false;`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS hide_referrer BOOLEAN DEFAULT false;`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS channel VARCHAR(128);`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS og_title VARCHAR(255);`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS og_description TEXT;`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS og_image_url TEXT;`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS is_public_stats BOOLEAN DEFAULT true;`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS broken_code INT;`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS broken_reason VARCHAR(255);`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ;`).catch(() => {});
    await sql.query(`ALTER TABLE links ADD COLUMN IF NOT EXISTS fallback_url TEXT;`).catch(() => {});

    // 5. Click Events table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS click_events (
        id VARCHAR(64) PRIMARY KEY,
        link_id VARCHAR(64),
        short_code VARCHAR(128),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        ip_hash VARCHAR(128),
        country VARCHAR(128) DEFAULT 'United States',
        country_code VARCHAR(16) DEFAULT 'US',
        region VARCHAR(128),
        city VARCHAR(128) DEFAULT 'San Francisco',
        device VARCHAR(64) DEFAULT 'mobile',
        os VARCHAR(64) DEFAULT 'iOS',
        browser VARCHAR(64) DEFAULT 'Safari',
        referrer VARCHAR(255) DEFAULT 'Direct / None',
        language VARCHAR(64) DEFAULT 'en-US',
        user_agent TEXT,
        utm_source VARCHAR(128),
        utm_medium VARCHAR(128),
        utm_campaign VARCHAR(128),
        utm_term VARCHAR(128),
        utm_content VARCHAR(128),
        destination_url TEXT,
        is_bot BOOLEAN DEFAULT false,
        is_unique BOOLEAN DEFAULT true,
        latency_ms INT DEFAULT 20
      );
    `);

    // Migration: ensure new columns exist if table was created previously
    await sql.query(`ALTER TABLE click_events ADD COLUMN IF NOT EXISTS region VARCHAR(128);`).catch(() => {});
    await sql.query(`ALTER TABLE click_events ADD COLUMN IF NOT EXISTS language VARCHAR(64) DEFAULT 'en-US';`).catch(() => {});
    await sql.query(`ALTER TABLE click_events ADD COLUMN IF NOT EXISTS user_agent TEXT;`).catch(() => {});
    await sql.query(`ALTER TABLE click_events ADD COLUMN IF NOT EXISTS utm_source VARCHAR(128);`).catch(() => {});
    await sql.query(`ALTER TABLE click_events ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(128);`).catch(() => {});
    await sql.query(`ALTER TABLE click_events ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(128);`).catch(() => {});
    await sql.query(`ALTER TABLE click_events ADD COLUMN IF NOT EXISTS utm_term VARCHAR(128);`).catch(() => {});
    await sql.query(`ALTER TABLE click_events ADD COLUMN IF NOT EXISTS utm_content VARCHAR(128);`).catch(() => {});
    await sql.query(`ALTER TABLE click_events ADD COLUMN IF NOT EXISTS destination_url TEXT;`).catch(() => {});
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_clicks_short_code ON click_events (short_code);`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_clicks_timestamp ON click_events (timestamp);`);

    // 6. API Keys table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64),
        name VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(32) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        permissions JSONB DEFAULT '["links:read", "links:write"]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used TIMESTAMPTZ
      )
    `);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys (workspace_id)`);

    // 7. Webhooks table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64),
        url TEXT NOT NULL,
        events JSONB DEFAULT '["link.created", "link.clicked"]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        secret VARCHAR(128),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // 8. Workspace Members
    await sql.query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'editor',
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(workspace_id, email)
      )
    `);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON workspace_members (workspace_id)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_workspace_members_email ON workspace_members (email)`);

    // 9. Workspace Invitations
    await sql.query(`
      CREATE TABLE IF NOT EXISTS workspace_invitations (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        inviter_email VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'editor',
        token VARCHAR(128) UNIQUE NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        accepted_at TIMESTAMPTZ
      )
    `);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_invitations_token ON workspace_invitations (token)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_invitations_ws ON workspace_invitations (workspace_id)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns (workspace_id)`);

    // 10. Bulk Import & Export Jobs
    await sql.query(`
      CREATE TABLE IF NOT EXISTS bulk_jobs (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        user_email VARCHAR(255),
        operation VARCHAR(32) NOT NULL DEFAULT 'import',
        batch_name VARCHAR(255) NOT NULL,
        total_rows INT DEFAULT 0,
        success_count INT DEFAULT 0,
        error_count INT DEFAULT 0,
        error_details JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(32) DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_bulk_jobs_workspace ON bulk_jobs (workspace_id);`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_bulk_jobs_created ON bulk_jobs (created_at DESC);`);

    // 11. Client Portals (White-Label Client Accounts)
    await sql.query(`
      CREATE TABLE IF NOT EXISTS client_portals (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255),
        status VARCHAR(32) DEFAULT 'active',
        custom_domain VARCHAR(255),
        brand_logo_url TEXT,
        brand_color VARCHAR(32) DEFAULT '#4f46e5',
        can_view_analytics BOOLEAN DEFAULT true,
        can_edit_destination_url BOOLEAN DEFAULT false,
        can_create_links BOOLEAN DEFAULT false,
        max_links_quota INT DEFAULT 10,
        assigned_link_ids JSONB DEFAULT '[]'::jsonb,
        assigned_campaign_ids JSONB DEFAULT '[]'::jsonb,
        assigned_channel VARCHAR(64),
        total_logins INT DEFAULT 0,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(workspace_id, email)
      );
    `);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_client_portals_ws ON client_portals (workspace_id);`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_client_portals_email ON client_portals (email);`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_client_portals_domain ON client_portals (custom_domain);`);

    return { success: true };
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
    return { success: false, error };
  }
}
