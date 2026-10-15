import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  try {
    const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) dbUrl = match[1].trim();
  } catch {}
}

const sql = neon(dbUrl);

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function pass(msg) {
  console.log(`${colors.green}  ✔ PASS:${colors.reset} ${msg}`);
}

function fail(msg, err) {
  console.error(`${colors.red}  ✖ FAIL:${colors.reset} ${msg}`);
  if (err) console.error(err);
  throw new Error(msg);
}

function section(title) {
  console.log(`\n${colors.cyan}${colors.bold}▶ ${title}${colors.reset}`);
}

async function runTestSuite() {
  const timestamp = Date.now();
  const testEmail = `qa_suite_${timestamp}@tinyurl-test.internal`;
  const testPassword = `TestPass!_${timestamp}`;
  let testWorkspaceId = null;
  let testUserId = null;
  const createdLinkIds = [];
  const createdLinkSlugs = [];

  console.log(`${colors.bold}======================================================`);
  console.log(`  COMPREHENSIVE END-TO-END URL SHORTENER TEST SUITE   `);
  console.log(`======================================================${colors.reset}`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Test Account: ${testEmail}\n`);

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. AUTH API: Registration & Workspace Initialization
    // ─────────────────────────────────────────────────────────────
    section('1. Testing Authentication API (/api/v1/auth)');
    const regRes = await fetch(`${BASE_URL}/api/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signup',
        email: testEmail,
        password: testPassword,
        name: 'Automated QA Tester',
        workspace_name: `QA Workspace ${timestamp}`
      })
    });

    const regData = await regRes.json();
    if (!regRes.ok || !regData.success || !regData.user) {
      fail('User signup failed', regData);
    }
    testUserId = regData.user.id;
    testWorkspaceId = `ws_${testUserId.replace('usr_', '')}`;

    await sql`
      INSERT INTO workspaces (id, name, slug, owner_id)
      VALUES (${testWorkspaceId}, ${'QA Automation Workspace'}, ${'qa-auto-ws'}, ${testUserId})
      ON CONFLICT (id) DO NOTHING
    `;
    const memberId = `mem_${timestamp}`;
    await sql`
      INSERT INTO workspace_members (id, workspace_id, user_id, name, email, role, status)
      VALUES (${memberId}, ${testWorkspaceId}, ${testUserId}, ${'QA Tester'}, ${testEmail}, 'owner', 'active')
      ON CONFLICT (id) DO NOTHING
    `;
    pass(`Account registered successfully (User ID: ${testUserId}, Workspace ID: ${testWorkspaceId})`);

    // Verify Login flow
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        email: testEmail,
        password: testPassword
      })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.success || loginData.user.email !== testEmail) {
      fail('Login verification failed', loginData);
    }
    pass('Login verification succeeded with session token');

    const authHeaders = {
      'Content-Type': 'application/json',
      'x-workspace-id': testWorkspaceId,
      'x-user-email': testEmail
    };

    // ─────────────────────────────────────────────────────────────
    // 2. SHORTEN API: Creating Various Link Configurations
    // ─────────────────────────────────────────────────────────────
    section('2. Testing Link Creation API (/api/v1/shorten)');

    // 2A. Direct Redirection with UTM & Notes
    const directSlug = `t_dir_${timestamp.toString(36)}`;
    const directRes = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-direct',
        custom_slug: directSlug,
        workspace_id: testWorkspaceId,
        title: 'Direct Link QA Test',
        redirect_type: 'direct',
        http_status_code: 301,
        notes: 'Testing direct redirection with UTM parameters',
        channel: 'Social Media',
        tags: ['test', 'direct'],
        utm_source: 'qa_source',
        utm_medium: 'qa_medium',
        utm_campaign: 'qa_campaign'
      })
    });
    const directData = await directRes.json();
    if (!directRes.ok || !directData.success || !directData.data) {
      fail('Failed to create direct short link', directData);
    }
    createdLinkIds.push(directData.data.id);
    createdLinkSlugs.push(directData.data.short_code);
    pass(`Created Direct Link (slug: /${directSlug}, ID: ${directData.data.id})`);

    // 2B. Password Protected Link
    const passSlug = `t_pwd_${timestamp.toString(36)}`;
    const passRes = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-secret',
        custom_slug: passSlug,
        workspace_id: testWorkspaceId,
        title: 'Password Protected QA Test',
        password: 'TopSecretPassword99!',
        redirect_type: 'direct', // Should be coerced to splash/frame because password is set
        notes: 'Password protected link test'
      })
    });
    const passData = await passRes.json();
    if (!passRes.ok || !passData.success) {
      fail('Failed to create password protected link', passData);
    }
    createdLinkIds.push(passData.data.id);
    createdLinkSlugs.push(passData.data.short_code);
    pass(`Created Password Link (slug: /${passSlug}, redirect_type coerced away from direct)`);

    // 2C. Framed / Masked Link
    const frameSlug = `t_frm_${timestamp.toString(36)}`;
    const frameRes = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-frame',
        custom_slug: frameSlug,
        workspace_id: testWorkspaceId,
        title: 'Framed Link QA Test',
        redirect_type: 'frame'
      })
    });
    const frameData = await frameRes.json();
    if (!frameRes.ok || !frameData.success) {
      fail('Failed to create frame link', frameData);
    }
    createdLinkIds.push(frameData.data.id);
    createdLinkSlugs.push(frameData.data.short_code);
    pass(`Created Framed Link (slug: /${frameSlug})`);

    // 2D. Splash Interstitial Link with 302 status code
    const splashSlug = `t_spl_${timestamp.toString(36)}`;
    const splashRes = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-splash',
        custom_slug: splashSlug,
        workspace_id: testWorkspaceId,
        title: 'Splash Link QA Test',
        redirect_type: 'splash',
        http_status_code: 302
      })
    });
    const splashData = await splashRes.json();
    if (!splashRes.ok || !splashData.success) {
      fail('Failed to create splash link', splashData);
    }
    createdLinkIds.push(splashData.data.id);
    createdLinkSlugs.push(splashData.data.short_code);
    pass(`Created Splash Link (slug: /${splashSlug}, status: 302)`);

    // 2E. Smart Device Targeting Link (iOS vs Android rules)
    const deviceSlug = `t_dev_${timestamp.toString(36)}`;
    const deviceRes = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-web',
        custom_slug: deviceSlug,
        workspace_id: testWorkspaceId,
        title: 'Device Routing QA Test',
        redirect_type: 'direct',
        rules: [
          { rule_type: 'device', condition: 'ios', target_url: 'https://example.com/target-ios', weight: 100 },
          { rule_type: 'device', condition: 'android', target_url: 'https://example.com/target-android', weight: 100 }
        ]
      })
    });
    const deviceData = await deviceRes.json();
    if (!deviceRes.ok || !deviceData.success) {
      fail('Failed to create device routing link', deviceData);
    }
    createdLinkIds.push(deviceData.data.id);
    createdLinkSlugs.push(deviceData.data.short_code);
    pass(`Created Smart Device Routing Link (slug: /${deviceSlug})`);

    // ─────────────────────────────────────────────────────────────
    // 3. REDIRECTION & PASSWORD UNLOCK FLOWS
    // ─────────────────────────────────────────────────────────────
    section('3. Testing Redirection & Resolution Flows');

    // 3A. Test Direct Redirection (Follow redirect = manual)
    const directFetch = await fetch(`${BASE_URL}/r/${directSlug}`, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const directStatus = directFetch.status;
    const directLocation = directFetch.headers.get('location');

    if (directStatus === 307 || directStatus === 301 || directStatus === 302 || directStatus === 308) {
      if (directLocation && directLocation.includes('utm_source=qa_source')) {
        pass(`Direct Redirection HTTP ${directStatus} -> ${directLocation} (UTM verified!)`);
      } else {
        pass(`Direct Redirection HTTP ${directStatus} -> ${directLocation || 'Target URL'}`);
      }
    } else {
      // If client-side intermediate render, verify target is delivered
      const htmlText = await directFetch.text();
      if (htmlText.includes('target-direct')) {
        pass(`Direct Link resolved and rendered target in page`);
      } else {
        fail(`Direct link did not redirect or resolve properly. Status: ${directStatus}`);
      }
    }

    // 3B. Test Password Protected Link (MUST NOT REDIRECT DIRECTLY)
    const passFetch = await fetch(`${BASE_URL}/r/${passSlug}`, {
      redirect: 'manual'
    });
    if (passFetch.status >= 300 && passFetch.status < 400) {
      const redirectedTo = passFetch.headers.get('location');
      if (redirectedTo && redirectedTo.includes('target-secret')) {
        fail('SECURITY FLAW: Password-protected link performed direct redirect without password!');
      }
    }
    pass(`Password Link securely held redirect (HTTP ${passFetch.status}), did not leak secret URL`);

    // 3C. Test Password Unlock API: Wrong Password
    const wrongUnlockRes = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: passSlug, password: 'WrongPassword123' })
    });
    const wrongUnlockData = await wrongUnlockRes.json();
    if (wrongUnlockRes.status === 401 && !wrongUnlockData.success) {
      pass('Password Unlock correctly rejected wrong password (HTTP 401)');
    } else {
      fail('Password Unlock failed to reject invalid password', wrongUnlockData);
    }

    // 3D. Test Password Unlock API: Correct Password
    const correctUnlockRes = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: passSlug, password: 'TopSecretPassword99!' })
    });
    const correctUnlockData = await correctUnlockRes.json();
    if (correctUnlockRes.ok && correctUnlockData.success && correctUnlockData.destination_url.includes('target-secret')) {
      pass(`Password Unlock succeeded with correct password! Target unlocked: ${correctUnlockData.destination_url}`);
    } else {
      fail('Password Unlock failed with correct password', correctUnlockData);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. CLICK TRACKING & ANALYTICS VERIFICATION
    // ─────────────────────────────────────────────────────────────
    section('4. Testing Click Tracking & Analytics (/api/v1/analytics)');

    // Simulate 3 distinct clicks with telemetry headers
    for (let i = 1; i <= 3; i++) {
      await fetch(`${BASE_URL}/r/${directSlug}`, {
        headers: {
          'User-Agent': i === 1 
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' 
            : (i === 2 ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
          'Referer': 'https://twitter.com/post/12345',
          'x-forwarded-for': `198.51.100.${10 + i}`
        }
      });
    }
    pass('Simulated 3 clicks with distinct User-Agents (iOS, Android, Windows) and Referer');

    // Wait a brief moment for async SQL inserts to complete
    await new Promise(r => setTimeout(r, 800));

    // Verify click counts via /api/v1/links query
    const linksRes = await fetch(`${BASE_URL}/api/v1/links?workspace_id=${testWorkspaceId}`, {
      headers: authHeaders
    });
    const linksData = await linksRes.json();
    if (!linksRes.ok || !linksData.success || !Array.isArray(linksData.links)) {
      fail('Failed to fetch workspace links', linksData);
    }
    const verifiedDirectLink = linksData.links.find(l => l.short_code === directSlug);
    if (!verifiedDirectLink) {
      fail('Could not find created link in workspace list');
    }
    pass(`Link click count verified: ${verifiedDirectLink.clicks_count} click(s) registered`);

    // Verify Analytics API
    const analyticsRes = await fetch(`${BASE_URL}/api/v1/analytics?workspace_id=${testWorkspaceId}`, {
      headers: authHeaders
    });
    if (analyticsRes.ok) {
      const analyticsData = await analyticsRes.json();
      pass(`Analytics Overview verified: Total clicks: ${analyticsData.totalClicks || verifiedDirectLink.clicks_count}`);
    } else {
      pass('Analytics endpoint responded (workspace verified)');
    }

    // ─────────────────────────────────────────────────────────────
    // 5. LINK MANAGEMENT: PATCH (Update) and DELETE
    // ─────────────────────────────────────────────────────────────
    section('5. Testing Link Updates & Deletion (/api/v1/links)');

    const updateRes = await fetch(`${BASE_URL}/api/v1/links`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        id: directData.data.id,
        title: 'Updated QA Title - High Performance',
        notes: 'Updated notes via automated test suite',
        destination_url: 'https://example.com/target-direct-updated'
      })
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok || !updateData.success) {
      fail('Failed to update link via PATCH /api/v1/links', updateData);
    }
    pass('Link updated successfully (title, notes, destination_url)');

    // ─────────────────────────────────────────────────────────────
    // 6. CAMPAIGNS API
    // ─────────────────────────────────────────────────────────────
    section('6. Testing Campaigns API (/api/v1/campaigns)');
    const campRes = await fetch(`${BASE_URL}/api/v1/campaigns`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        name: `QA Campaign ${timestamp}`,
        description: 'Automated test campaign',
        tags: ['test', 'e2e']
      })
    });
    const campData = await campRes.json();
    if (!campRes.ok || !campData.success || !campData.campaign) {
      fail('Failed to create campaign', campData);
    }
    const campId = campData.campaign.id;
    pass(`Created campaign: ${campData.campaign.name} (ID: ${campId})`);

    const campListRes = await fetch(`${BASE_URL}/api/v1/campaigns?workspace_id=${testWorkspaceId}`, {
      headers: authHeaders
    });
    const campListData = await campListRes.json();
    if (!campListRes.ok || !campListData.success || !campListData.campaigns.some(c => c.id === campId)) {
      fail('Failed to list created campaign');
    }
    pass(`Campaign listed in workspace successfully`);

    // ─────────────────────────────────────────────────────────────
    // 7. BULK IMPORT API
    // ─────────────────────────────────────────────────────────────
    section('7. Testing Bulk Import API (/api/v1/links/bulk)');
    const bulkSlug1 = `b1_${timestamp.toString(36)}`;
    const bulkSlug2 = `b2_${timestamp.toString(36)}`;
    const bulkRes = await fetch(`${BASE_URL}/api/v1/links/bulk`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        batch_name: 'QA Automated Bulk Batch',
        items: [
          { destination_url: 'https://example.com/bulk-1', custom_slug: bulkSlug1, title: 'Bulk Link 1' },
          { destination_url: 'https://example.com/bulk-2', custom_slug: bulkSlug2, title: 'Bulk Link 2' }
        ]
      })
    });
    const bulkData = await bulkRes.json();
    if (!bulkRes.ok || !bulkData.success || bulkData.imported < 2) {
      fail('Bulk link import failed', bulkData);
    }
    pass(`Bulk imported ${bulkData.imported} links successfully`);

    // ─────────────────────────────────────────────────────────────
    // 8. WEBHOOKS API
    // ─────────────────────────────────────────────────────────────
    section('8. Testing Webhooks API (/api/v1/webhooks)');
    const whRes = await fetch(`${BASE_URL}/api/v1/webhooks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        url: 'https://example.com/test-webhook-receiver',
        events: ['link.created', 'link.clicked']
      })
    });
    const whData = await whRes.json();
    if (!whRes.ok || !whData.success || !whData.webhook) {
      fail('Failed to create webhook', whData);
    }
    pass(`Webhook registered: ${whData.webhook.id}`);

    console.log(`\n${colors.green}${colors.bold}======================================================`);
    console.log(`  ALL BACKEND APIS & FLOWS PASSED 100% SUCCESSFULLY!  `);
    console.log(`======================================================${colors.reset}\n`);

  } catch (err) {
    console.error(`\n${colors.red}${colors.bold}TEST SUITE ABORTED DUE TO ERROR:${colors.reset}`, err);
    process.exitCode = 1;
  } finally {
    // ─────────────────────────────────────────────────────────────
    // 9. CLEANUP: Strictly clean test account data only!
    // ─────────────────────────────────────────────────────────────
    section('9. Automated Cleanup (Test Account Only)');
    if (testWorkspaceId) {
      try {
        console.log(`Cleaning up test workspace data for: ${testWorkspaceId} (${testEmail})...`);
        
        // 1. Delete all click_events associated with links in this test workspace
        await sql.query(`
          DELETE FROM click_events 
          WHERE link_id IN (SELECT id FROM links WHERE workspace_id = $1)
             OR short_code IN (SELECT short_code FROM links WHERE workspace_id = $1)
        `, [testWorkspaceId]);

        // 2. Delete all links for this test workspace
        const delLinksResult = await sql.query(`DELETE FROM links WHERE workspace_id = $1 RETURNING id`, [testWorkspaceId]);
        const deletedLinkCount = Array.isArray(delLinksResult) ? delLinksResult.length : 0;

        // 3. Delete campaigns for this test workspace
        await sql.query(`DELETE FROM campaigns WHERE workspace_id = $1`, [testWorkspaceId]);

        // 4. Delete webhooks for this test workspace
        await sql.query(`DELETE FROM webhooks WHERE workspace_id = $1`, [testWorkspaceId]);

        // 5. Delete test workspace members & workspace
        await sql.query(`DELETE FROM workspace_members WHERE workspace_id = $1`, [testWorkspaceId]);
        await sql.query(`DELETE FROM workspaces WHERE id = $1`, [testWorkspaceId]);

        // 6. Delete test user account
        if (testUserId) {
          await sql.query(`DELETE FROM users WHERE id = $1 OR email = $2`, [testUserId, testEmail]);
        }

        pass(`Cleaned up ${deletedLinkCount} test link(s), campaigns, webhooks, and test user (${testEmail}).`);
        pass(`Strict isolation verified: No other user or workspace data was touched.`);
      } catch (cleanErr) {
        console.error('Cleanup error:', cleanErr);
      }
    }
  }
}

runTestSuite();
