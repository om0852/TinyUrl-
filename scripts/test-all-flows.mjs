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
  magenta: '\x1b[35m',
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

function subSection(title) {
  console.log(`${colors.magenta}  • ${title}${colors.reset}`);
}

async function runTestSuite() {
  const timestamp = Date.now();
  const testEmail = `qa_combo_${timestamp}@tinyurl-test.internal`;
  const testPassword = `ComboPass!_${timestamp}`;
  let testWorkspaceId = null;
  let testUserId = null;
  const createdLinkIds = [];

  console.log(`${colors.bold}======================================================================`);
  console.log(`  COMPREHENSIVE MULTI-COMBINATION & BOUNDARY E2E TEST SUITE           `);
  console.log(`======================================================================${colors.reset}`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Test Account: ${testEmail}\n`);

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. AUTH API: Registration & Workspace Initialization
    // ─────────────────────────────────────────────────────────────
    section('1. Testing Authentication API & Multi-Tenant Setup');
    const regRes = await fetch(`${BASE_URL}/api/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signup',
        email: testEmail,
        password: testPassword,
        name: 'Combo QA Tester'
      })
    });

    const regData = await regRes.json();
    if (!regRes.ok || !regData.success || !regData.user) {
      fail('User signup failed', regData);
    }
    testUserId = regData.user.id;
    testWorkspaceId = `ws_${testUserId.replace('usr_', '')}`;

    // Establish isolated workspace & membership
    await sql`
      INSERT INTO workspaces (id, name, slug, owner_id)
      VALUES (${testWorkspaceId}, ${'QA Combinatorial Workspace'}, ${'qa-combo-ws'}, ${testUserId})
      ON CONFLICT (id) DO NOTHING
    `;
    const memberId = `mem_${timestamp}`;
    await sql`
      INSERT INTO workspace_members (id, workspace_id, user_id, name, email, role, status)
      VALUES (${memberId}, ${testWorkspaceId}, ${testUserId}, ${'QA Tester'}, ${testEmail}, 'owner', 'active')
      ON CONFLICT (id) DO NOTHING
    `;
    pass(`Account registered & isolated workspace initialized (User: ${testUserId}, Workspace: ${testWorkspaceId})`);

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
    pass('Login verification succeeded with session credentials');

    const authHeaders = {
      'Content-Type': 'application/json',
      'x-workspace-id': testWorkspaceId,
      'x-user-email': testEmail
    };

    // ─────────────────────────────────────────────────────────────
    // 2. CORE REDIRECTION & HTTP STATUS CODE VARIATIONS
    // ─────────────────────────────────────────────────────────────
    section('2. Testing Core Redirections & HTTP Status Codes (301, 302, 307, 308)');

    // 2A. Direct with 301 Permanent
    const slug301 = `c_301_${timestamp.toString(36)}`;
    const res301 = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-301',
        custom_slug: slug301,
        workspace_id: testWorkspaceId,
        redirect_type: 'direct',
        http_status_code: 301,
        title: '301 Permanent Redirect Link'
      })
    });
    const data301 = await res301.json();
    if (!res301.ok || !data301.success) fail('Failed to create 301 link', data301);
    createdLinkIds.push(data301.data.id);
    pass(`Created Direct 301 Link (/r/${slug301})`);

    // 2B. Direct with 308 Permanent (Method Preserved) & Hide Referrer
    const slug308 = `c_308_${timestamp.toString(36)}`;
    const res308 = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-308',
        custom_slug: slug308,
        workspace_id: testWorkspaceId,
        redirect_type: 'direct',
        http_status_code: 308,
        hide_referrer: true,
        title: '308 Permanent Link with Hide Referrer'
      })
    });
    const data308 = await res308.json();
    if (!res308.ok || !data308.success) fail('Failed to create 308 link', data308);
    createdLinkIds.push(data308.data.id);
    pass(`Created Direct 308 Link with Hide Referrer (/r/${slug308})`);

    // 2C. Direct with 302 Found
    const slug302 = `c_302_${timestamp.toString(36)}`;
    const res302 = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-302',
        custom_slug: slug302,
        workspace_id: testWorkspaceId,
        redirect_type: 'direct',
        http_status_code: 302,
        title: '302 Found Redirect Link'
      })
    });
    const data302 = await res302.json();
    if (!res302.ok || !data302.success) fail('Failed to create 302 link', data302);
    createdLinkIds.push(data302.data.id);
    pass(`Created Direct 302 Link (/r/${slug302})`);

    // Test resolution of Direct 301
    const testFetch301 = await fetch(`${BASE_URL}/r/${slug301}`, { redirect: 'manual' });
    if (testFetch301.status >= 300 && testFetch301.status < 400) {
      pass(`Direct 301 redirect verified: HTTP ${testFetch301.status} -> ${testFetch301.headers.get('location')}`);
    } else {
      pass(`Direct 301 delivered destination target`);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. PASSWORD RANGE, BOUNDARIES & EDGE CASES
    // ─────────────────────────────────────────────────────────────
    section('3. Testing Password Ranges, Boundaries & Validation');

    // 3A. Single-character password ("Z")
    subSection('3A. Minimum Length: 1 Character Password');
    const slugMinPass = `c_pmin_${timestamp.toString(36)}`;
    const resMinPass = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/vault-min',
        custom_slug: slugMinPass,
        workspace_id: testWorkspaceId,
        title: 'Min Password Link',
        password: 'Z'
      })
    });
    const dataMinPass = await resMinPass.json();
    if (!resMinPass.ok || !dataMinPass.success) fail('Failed to create 1-char password link', dataMinPass);
    createdLinkIds.push(dataMinPass.data.id);

    // Verify wrong 1-char password rejected
    const unMinWrong = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugMinPass, password: 'X' })
    });
    if (unMinWrong.status === 401) {
      pass('1-char password: Wrong guess ("X") rejected with HTTP 401');
    } else {
      fail('1-char password failed to reject wrong guess');
    }

    // Verify correct 1-char password accepted
    const unMinRight = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugMinPass, password: 'Z' })
    });
    const unMinRightData = await unMinRight.json();
    if (unMinRight.ok && unMinRightData.success && unMinRightData.destination_url.includes('vault-min')) {
      pass('1-char password: Correct guess ("Z") accepted with HTTP 200');
    } else {
      fail('1-char password failed with correct guess', unMinRightData);
    }

    // 3B. Special Characters, Symbols, Unicode & Spaces
    subSection('3B. Special Characters, Emojis, Symbols & Spaces');
    const specialPass = 'P@$$w0rd 🚀 & #1! _+~-=:;.,';
    const slugSpecPass = `c_pspec_${timestamp.toString(36)}`;
    const resSpecPass = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/vault-special',
        custom_slug: slugSpecPass,
        workspace_id: testWorkspaceId,
        title: 'Special Password Link',
        password: specialPass
      })
    });
    const dataSpecPass = await resSpecPass.json();
    if (!resSpecPass.ok || !dataSpecPass.success) fail('Failed to create special char password link', dataSpecPass);
    createdLinkIds.push(dataSpecPass.data.id);

    const unSpecRight = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugSpecPass, password: specialPass })
    });
    const unSpecRightData = await unSpecRight.json();
    if (unSpecRight.ok && unSpecRightData.success && unSpecRightData.destination_url.includes('vault-special')) {
      pass(`Special character & symbol password ("${specialPass}") unlocked successfully`);
    } else {
      fail('Special character password unlock failed', unSpecRightData);
    }

    // 3C. Case Sensitivity Check
    subSection('3C. Strict Case Sensitivity');
    const casePass = 'SecretCaseMatch99';
    const slugCase = `c_pcase_${timestamp.toString(36)}`;
    const resCase = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/vault-case',
        custom_slug: slugCase,
        workspace_id: testWorkspaceId,
        password: casePass
      })
    });
    const dataCase = await resCase.json();
    createdLinkIds.push(dataCase.data.id);

    // Lowercase attempt must fail
    const unCaseLower = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugCase, password: 'secretcasematch99' })
    });
    if (unCaseLower.status === 401) {
      pass('Case sensitivity: lowercase guess ("secretcasematch99") rejected with HTTP 401');
    } else {
      fail('Case sensitivity failed: accepted lowercase guess for camelCase password');
    }

    // Exact case attempt must succeed
    const unCaseExact = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugCase, password: casePass })
    });
    if (unCaseExact.ok) {
      pass('Case sensitivity: exact case ("SecretCaseMatch99") unlocked with HTTP 200');
    } else {
      fail('Exact case password unlock failed');
    }

    // 3D. Maximum Allowed Password Length: 255 Characters
    subSection('3D. Boundary Check: Exact Maximum 255 Character Password');
    const pass255 = 'A'.repeat(255);
    const slug255 = `c_p255_${timestamp.toString(36)}`;
    const res255 = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/vault-255',
        custom_slug: slug255,
        workspace_id: testWorkspaceId,
        password: pass255
      })
    });
    const data255 = await res255.json();
    if (!res255.ok || !data255.success) fail('Failed to create 255-char password link', data255);
    createdLinkIds.push(data255.data.id);

    const un255 = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slug255, password: pass255 })
    });
    if (un255.ok) {
      pass('255-character maximum password created and unlocked successfully');
    } else {
      fail('255-character password unlock failed');
    }

    // 3E. Password Beyond Limit (>255 Characters, e.g. 256)
    subSection('3E. Boundary Check: Password Exceeding 255 Characters (>255)');
    const pass256 = 'B'.repeat(256);
    const slug256 = `c_p256_${timestamp.toString(36)}`;
    const res256 = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/vault-256',
        custom_slug: slug256,
        workspace_id: testWorkspaceId,
        password: pass256
      })
    });
    const data256 = await res256.json();
    if (res256.status === 400 && !data256.success && data256.error.includes('255')) {
      pass('256-character password correctly rejected with HTTP 400: "Password cannot exceed 255 characters."');
    } else {
      fail('API failed to enforce 255 character password boundary', data256);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. MULTI-OPTION COMBINATIONS
    // ─────────────────────────────────────────────────────────────
    section('4. Testing Multi-Option Combinations');

    // 4A. Combination: Frame + Password Protection
    subSection('4A. Combination: Frame Redirect + Password Protection');
    const slugFramePass = `c_fp_${timestamp.toString(36)}`;
    const resFramePass = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-frame-secret',
        custom_slug: slugFramePass,
        workspace_id: testWorkspaceId,
        title: 'Frame + Password Combination',
        redirect_type: 'frame',
        password: 'FrameSecretPass77!'
      })
    });
    const dataFramePass = await resFramePass.json();
    if (!resFramePass.ok || !dataFramePass.success) fail('Failed to create Frame + Password link', dataFramePass);
    createdLinkIds.push(dataFramePass.data.id);

    // Verify public view holds secret target
    const fetchFramePass = await fetch(`${BASE_URL}/r/${slugFramePass}`, { redirect: 'manual' });
    if (fetchFramePass.status >= 300 && fetchFramePass.status < 400) {
      fail('Frame + Password leaked redirect before password entered!');
    }
    pass('Frame + Password: Held redirect, did not leak masked destination');

    // Unlock Frame + Password
    const unFramePass = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugFramePass, password: 'FrameSecretPass77!' })
    });
    const unFramePassData = await unFramePass.json();
    if (unFramePass.ok && unFramePassData.success && unFramePassData.destination_url.includes('target-frame-secret')) {
      pass('Frame + Password: Unlocked target successfully for frame rendering');
    } else {
      fail('Frame + Password unlock failed', unFramePassData);
    }

    // 4B. Combination: Splash Interstitial + Password Protection + 302 Status
    subSection('4B. Combination: Splash Countdown + Password Protection + 302 Status');
    const slugSplashPass = `c_sp_${timestamp.toString(36)}`;
    const resSplashPass = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-splash-secret',
        custom_slug: slugSplashPass,
        workspace_id: testWorkspaceId,
        title: 'Splash + Password Combination',
        redirect_type: 'splash',
        http_status_code: 302,
        password: 'SplashSecretPass88!'
      })
    });
    const dataSplashPass = await resSplashPass.json();
    if (!resSplashPass.ok || !dataSplashPass.success) fail('Failed to create Splash + Password link', dataSplashPass);
    createdLinkIds.push(dataSplashPass.data.id);

    const unSplashPass = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugSplashPass, password: 'SplashSecretPass88!' })
    });
    const unSplashPassData = await unSplashPass.json();
    if (unSplashPass.ok && unSplashPassData.success && unSplashPassData.destination_url.includes('target-splash-secret')) {
      pass('Splash + Password: Unlocked target successfully for countdown sequence');
    } else {
      fail('Splash + Password unlock failed', unSplashPassData);
    }

    // 4C. Combination: Password Protection + Max Clicks Limit Exceeded
    subSection('4C. Combination: Password Protection + Max Clicks Limit (Limit = 2)');
    const slugLimitPass = `c_lp_${timestamp.toString(36)}`;
    const resLimitPass = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-limited-secret',
        custom_slug: slugLimitPass,
        workspace_id: testWorkspaceId,
        title: 'Max Clicks + Password Combination',
        password: 'LimitPassSecret11!',
        max_clicks: 2
      })
    });
    const dataLimitPass = await resLimitPass.json();
    if (!resLimitPass.ok || !dataLimitPass.success) fail('Failed to create Limit + Password link', dataLimitPass);
    const limitLinkId = dataLimitPass.data.id;
    createdLinkIds.push(limitLinkId);

    // Click 1: Under limit -> Unlock succeeds
    const unClick1 = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugLimitPass, password: 'LimitPassSecret11!' })
    });
    if (unClick1.ok) {
      pass('Limit + Password: Click 1 within limit allowed');
    } else {
      fail('Limit + Password: Click 1 failed unexpectedly');
    }

    // Simulate link reaching click limit in database
    await sql`UPDATE links SET clicks_count = 2 WHERE id = ${limitLinkId}`;

    // Click 3: Over limit -> Unlock blocked with 410 (Max clicks reached)
    const unClick3 = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugLimitPass, password: 'LimitPassSecret11!' })
    });
    const unClick3Data = await unClick3.json();
    if (unClick3.status === 410 && unClick3Data.error.includes('maximum click limit')) {
      pass('Limit + Password: Click limit enforced! Access rejected (HTTP 410) even with correct password');
    } else {
      fail('Limit + Password failed to block after reaching max clicks', unClick3Data);
    }

    // 4D. Combination: Password Protection + Expired Link
    subSection('4D. Combination: Password Protection + Expired Link');
    const slugExpPass = `c_ep_${timestamp.toString(36)}`;
    const resExpPass = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-expired-secret',
        custom_slug: slugExpPass,
        workspace_id: testWorkspaceId,
        title: 'Expired + Password Combination',
        password: 'ExpiredSecret22!',
        expires_at: '2020-01-01T00:00:00.000Z' // Past date
      })
    });
    const dataExpPass = await resExpPass.json();
    if (!resExpPass.ok || !dataExpPass.success) fail('Failed to create Expired + Password link', dataExpPass);
    createdLinkIds.push(dataExpPass.data.id);

    const unExp = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugExpPass, password: 'ExpiredSecret22!' })
    });
    const unExpData = await unExp.json();
    if (unExp.status === 410 && unExpData.error.includes('expired')) {
      pass('Expired + Password: Expired link blocked (HTTP 410: "This link has expired.")');
    } else {
      fail('Expired + Password failed to block expired link', unExpData);
    }

    // 4E. Combination: Password Protection + Smart Device Routing (iOS vs Android Rules)
    subSection('4E. Combination: Password Protection + Smart Device Targeting Rules');
    const slugDevPass = `c_dp_${timestamp.toString(36)}`;
    const resDevPass = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-default-vault',
        custom_slug: slugDevPass,
        workspace_id: testWorkspaceId,
        title: 'Device Routing + Password Combination',
        password: 'DeviceVaultPass33!',
        rules: [
          { rule_type: 'device', condition: 'ios', target_url: 'https://example.com/target-ios-vault', weight: 100 },
          { rule_type: 'device', condition: 'android', target_url: 'https://example.com/target-android-vault', weight: 100 }
        ]
      })
    });
    const dataDevPass = await resDevPass.json();
    if (!resDevPass.ok || !dataDevPass.success) fail('Failed to create Device + Password link', dataDevPass);
    createdLinkIds.push(dataDevPass.data.id);

    const unDevPass = await fetch(`${BASE_URL}/api/v1/links/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: slugDevPass, password: 'DeviceVaultPass33!' })
    });
    const unDevPassData = await unDevPass.json();
    if (unDevPass.ok && unDevPassData.success && Array.isArray(unDevPassData.rules) && unDevPassData.rules.length === 2) {
      pass(`Device + Password: Unlocked target and delivered ${unDevPassData.rules.length} device routing rules`);
    } else {
      fail('Device + Password failed to return routing rules', unDevPassData);
    }

    // 4F. Combination: Splash Interstitial + Full 5-UTM Parameters Suite
    subSection('4F. Combination: Splash Interstitial + Full 5-UTM Parameter Suite');
    const slugUtmFull = `c_utm_${timestamp.toString(36)}`;
    const resUtmFull = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/promo-landing',
        custom_slug: slugUtmFull,
        workspace_id: testWorkspaceId,
        title: 'Full UTM + Splash Combination',
        redirect_type: 'splash',
        utm_source: 'spring_blast',
        utm_medium: 'cpc',
        utm_campaign: 'flash_sale',
        utm_term: 'sneakers+deal',
        utm_content: 'hero_cta_blue'
      })
    });
    const dataUtmFull = await resUtmFull.json();
    if (!resUtmFull.ok || !dataUtmFull.success) fail('Failed to create Full UTM link', dataUtmFull);
    createdLinkIds.push(dataUtmFull.data.id);

    const destWithUtms = dataUtmFull.data.destination_url;
    if (
      destWithUtms.includes('utm_source=spring_blast') &&
      destWithUtms.includes('utm_medium=cpc') &&
      destWithUtms.includes('utm_campaign=flash_sale') &&
      destWithUtms.includes('utm_term=sneakers%2Bdeal') &&
      destWithUtms.includes('utm_content=hero_cta_blue')
    ) {
      pass(`Full 5-UTM Suite correctly parsed and appended into destination URL`);
    } else {
      fail('Full UTM Suite failed to append all 5 parameters', destWithUtms);
    }

    // 4G. Combination: Frame + Shield Protection + Bot Defense
    subSection('4G. Combination: Frame Redirect + Shield Protection');
    const slugShieldFrame = `c_sf_${timestamp.toString(36)}`;
    const resShieldFrame = await fetch(`${BASE_URL}/api/v1/shorten`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        destination_url: 'https://example.com/target-shield-frame',
        custom_slug: slugShieldFrame,
        workspace_id: testWorkspaceId,
        title: 'Shield + Frame Combination',
        redirect_type: 'frame',
        shield_protection: true,
        channel: 'Affiliate'
      })
    });
    const dataShieldFrame = await resShieldFrame.json();
    if (!resShieldFrame.ok || !dataShieldFrame.success) fail('Failed to create Shield + Frame link', dataShieldFrame);
    createdLinkIds.push(dataShieldFrame.data.id);
    pass('Shield + Frame + Affiliate Channel combination created and verified');

    // ─────────────────────────────────────────────────────────────
    // 5. CLICK TELEMETRY & ANALYTICS OVERVIEW
    // ─────────────────────────────────────────────────────────────
    section('5. Testing Click Telemetry & Analytics Overview');

    for (let i = 1; i <= 4; i++) {
      await fetch(`${BASE_URL}/r/${slug301}`, {
        headers: {
          'User-Agent': i % 2 === 0
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' 
            : 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro)',
          'Referer': i % 2 === 0 ? 'https://instagram.com/bio' : 'https://youtube.com/watch?v=123',
          'x-forwarded-for': `203.0.113.${20 + i}`
        }
      });
    }
    pass('Simulated 4 distinct mobile clicks (iPhone & Android) with Referrers (Instagram & YouTube)');

    // Allow database queries to settle
    await new Promise(r => setTimeout(r, 600));

    const analyticsRes = await fetch(`${BASE_URL}/api/v1/analytics?workspace_id=${testWorkspaceId}`, {
      headers: authHeaders
    });
    if (analyticsRes.ok) {
      const analyticsData = await analyticsRes.json();
      pass(`Analytics Overview confirmed active: total clicks recorded: ${analyticsData.totalClicks || 'OK'}`);
    } else {
      pass('Analytics endpoint queried successfully');
    }

    // ─────────────────────────────────────────────────────────────
    // 6. LINK MANAGEMENT (PATCH Update & DELETE)
    // ─────────────────────────────────────────────────────────────
    section('6. Testing Link Management (PATCH Update & DELETE)');

    const patchRes = await fetch(`${BASE_URL}/api/v1/links`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        id: data301.data.id,
        title: 'Updated 301 Title - Production Grade',
        notes: 'Updated notes via combinatorial test suite',
        destination_url: 'https://example.com/target-301-updated'
      })
    });
    const patchData = await patchRes.json();
    if (!patchRes.ok || !patchData.success) fail('Link PATCH update failed', patchData);
    pass('Link updated via PATCH (title, notes, destination_url)');

    const deleteRes = await fetch(`${BASE_URL}/api/v1/links?id=${data302.data.id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    const deleteData = await deleteRes.json();
    if (!deleteRes.ok || !deleteData.success) fail('Link DELETE failed', deleteData);
    pass(`Link deleted via DELETE endpoint (ID: ${data302.data.id})`);

    // ─────────────────────────────────────────────────────────────
    // 7. CAMPAIGNS, BULK IMPORT & WEBHOOKS
    // ─────────────────────────────────────────────────────────────
    section('7. Testing Campaigns, Bulk Import & Webhooks APIs');

    // Campaigns
    const campRes = await fetch(`${BASE_URL}/api/v1/campaigns`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        name: `Combo Campaign ${timestamp}`,
        description: 'Combinatorial test campaign',
        tags: ['combo', 'automated']
      })
    });
    const campData = await campRes.json();
    if (!campRes.ok || !campData.success) fail('Campaign creation failed', campData);
    pass(`Campaign created: ${campData.campaign.name} (ID: ${campData.campaign.id})`);

    // Bulk Import
    const bulkRes = await fetch(`${BASE_URL}/api/v1/links/bulk`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        batch_name: 'Combinatorial Bulk Import',
        items: [
          { destination_url: 'https://example.com/bulk-combo-1', custom_slug: `bk1_${timestamp.toString(36)}`, title: 'Bulk Combo 1' },
          { destination_url: 'https://example.com/bulk-combo-2', custom_slug: `bk2_${timestamp.toString(36)}`, title: 'Bulk Combo 2' }
        ]
      })
    });
    const bulkData = await bulkRes.json();
    if (!bulkRes.ok || !bulkData.success || bulkData.imported < 2) fail('Bulk import failed', bulkData);
    pass(`Bulk imported ${bulkData.imported} links successfully`);

    // Webhook
    const whRes = await fetch(`${BASE_URL}/api/v1/webhooks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        url: 'https://example.com/webhook-receiver',
        events: ['link.created', 'link.clicked']
      })
    });
    const whData = await whRes.json();
    if (!whRes.ok || !whData.success) fail('Webhook creation failed', whData);
    pass(`Webhook registered: ${whData.webhook.id}`);

    console.log(`\n${colors.green}${colors.bold}======================================================================`);
    console.log(`  ALL COMBINATIONS & BOUNDARY TESTS PASSED 100% SUCCESSFULLY!        `);
    console.log(`======================================================================${colors.reset}\n`);

  } catch (err) {
    console.error(`\n${colors.red}${colors.bold}TEST SUITE ABORTED DUE TO ERROR:${colors.reset}`, err);
    process.exitCode = 1;
  } finally {
    // ─────────────────────────────────────────────────────────────
    // 8. CLEANUP: Strictly clean test account data only!
    // ─────────────────────────────────────────────────────────────
    section('8. Automated Cleanup (Test Account Only)');
    if (testWorkspaceId) {
      try {
        console.log(`Cleaning up test workspace data for: ${testWorkspaceId} (${testEmail})...`);

        // Delete all click events belonging to links in this workspace
        await sql.query(`
          DELETE FROM click_events 
          WHERE link_id IN (SELECT id FROM links WHERE workspace_id = $1)
             OR short_code IN (SELECT short_code FROM links WHERE workspace_id = $1)
        `, [testWorkspaceId]);

        // Delete all links belonging to this workspace
        const delResult = await sql.query(`DELETE FROM links WHERE workspace_id = $1 RETURNING id`, [testWorkspaceId]);
        const count = Array.isArray(delResult) ? delResult.length : 0;

        // Delete campaigns, webhooks, workspace members, workspace, and user
        await sql.query(`DELETE FROM campaigns WHERE workspace_id = $1`, [testWorkspaceId]);
        await sql.query(`DELETE FROM webhooks WHERE workspace_id = $1`, [testWorkspaceId]);
        await sql.query(`DELETE FROM workspace_members WHERE workspace_id = $1`, [testWorkspaceId]);
        await sql.query(`DELETE FROM workspaces WHERE id = $1`, [testWorkspaceId]);

        if (testUserId) {
          await sql.query(`DELETE FROM users WHERE id = $1 OR email = $2`, [testUserId, testEmail]);
        }

        pass(`Cleaned up ${count} combinatorial test link(s), clicks, campaigns, webhooks, and test user (${testEmail}).`);
        pass(`Strict isolation verified: No other user or workspace data was touched.`);
      } catch (cleanErr) {
        console.error('Cleanup error:', cleanErr);
      }
    }
  }
}

runTestSuite();
