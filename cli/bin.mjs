#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import { TinyUrlClient } from './client.mjs';
import { loadConfig, saveConfig } from './config.mjs';

const program = new Command();

// Colors & Formatter
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function printBanner() {
  console.log(cyan(bold(`
  ████████╗██╗███╗   ██╗██╗   ██╗██╗   ██╗██████╗ ██╗     
  ╚══██╔══╝██║████╗  ██║╚██╗ ██╔╝██║   ██║██╔══██╗██║     
     ██║   ██║██╔██╗ ██║ ╚████╔╝ ██║   ██║██████╔╝██║     
     ██║   ██║██║╚██╗██║  ╚██╔╝  ██║   ██║██╔══██╗██║     
     ██║   ██║██║ ╚████║   ██║   ╚██████╔╝██║  ██║███████╗
     ╚═╝   ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝
  `)) + dim('Enterprise URL Shortener CLI v2.0 | Multi-tenant & High Speed\n'));
}

function getClient(cmdOpts) {
  const globalOpts = program.opts();
  const config = loadConfig({
    apiUrl: globalOpts.apiUrl || cmdOpts?.apiUrl,
    apiKey: globalOpts.apiKey || cmdOpts?.apiKey,
    workspaceId: globalOpts.workspace || cmdOpts?.workspace
  });
  return new TinyUrlClient(config);
}

function outputResult(data, isJson) {
  if (isJson || program.opts().json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

function handleError(err) {
  console.error(red(bold('\n✖ Error:')) + ` ${err.message}`);
  if (err.data && err.data.error) {
    console.error(dim(`Detail: ${JSON.stringify(err.data.error)}`));
  }
  process.exit(1);
}

program
  .name('tinyurl')
  .description('Official TinyURL Platform CLI & Developer Control Tool')
  .version('2.0.0')
  .option('-u, --api-url <url>', 'Base API URL (default: http://localhost:3000)')
  .option('-k, --api-key <key>', 'API Key for Bearer / x-api-key authentication')
  .option('-w, --workspace <id>', 'Target Workspace ID (default: ws_default)')
  .option('--json', 'Output raw JSON for machine parsing');

// --- SHORTEN COMMAND ---
program
  .command('shorten <destinationUrl>')
  .description('Create a high-speed shortened URL')
  .option('-s, --slug <slug>', 'Custom slug/alias')
  .option('-t, --title <title>', 'Link title')
  .option('-d, --domain <domain>', 'Domain ID or hostname')
  .option('-g, --tags <tags...>', 'Categorization tags')
  .option('--utm-source <src>', 'UTM Source')
  .option('--utm-medium <med>', 'UTM Medium')
  .option('--utm-campaign <cmp>', 'UTM Campaign')
  .option('--password <pwd>', 'Password protection')
  .option('--expires <date>', 'Expiration timestamp (ISO format or YYYY-MM-DD)')
  .option('--max-clicks <count>', 'Maximum allowed clicks before auto-expiry')
  .action(async (destinationUrl, opts) => {
    try {
      const client = getClient(opts);
      const res = await client.shorten({
        destination_url: destinationUrl,
        custom_slug: opts.slug,
        title: opts.title,
        domain_id: opts.domain,
        tags: opts.tags,
        utm_source: opts.utmSource,
        utm_medium: opts.utmMedium,
        utm_campaign: opts.utmCampaign,
        password: opts.password,
        expires_at: opts.expires,
        max_clicks: opts.maxClicks ? Number(opts.maxClicks) : undefined
      });

      if (program.opts().json) {
        outputResult(res);
        return;
      }

      const link = res.data || res.link;
      console.log(green(bold('\n✔ Short Link Created Successfully!')));
      console.log(`${bold('Short URL:')}    ${cyan(`${client.apiUrl}/${link.short_code}`)}`);
      console.log(`${bold('Destination:')}  ${link.destination_url}`);
      console.log(`${bold('Short Code:')}   ${link.short_code}`);
      if (link.custom_slug) console.log(`${bold('Custom Slug:')}  ${link.custom_slug}`);
      if (link.title) console.log(`${bold('Title:')}        ${link.title}`);
      if (link.tags?.length) console.log(`${bold('Tags:')}         ${link.tags.join(', ')}`);
      if (opts.password) console.log(`${bold('Protection:')}   ${yellow('Password Protected')}`);
      console.log(`${bold('Link ID:')}      ${dim(link.id)}\n`);
    } catch (err) {
      handleError(err);
    }
  });

// --- LINKS SUBCOMMAND GROUP ---
const linksCmd = program.command('links').description('Manage and inspect links');

linksCmd
  .command('list')
  .description('List all links in the workspace')
  .option('-l, --limit <number>', 'Number of links to show', '20')
  .action(async (opts) => {
    try {
      const client = getClient();
      const res = await client.listLinks();

      if (program.opts().json) {
        outputResult(res);
        return;
      }

      const links = (res.links || []).slice(0, Number(opts.limit));
      console.log(bold(`\nLinks for Workspace: ${cyan(client.workspaceId)} (${res.total || links.length} total)\n`));

      if (links.length === 0) {
        console.log(dim('No links found. Create one with `tinyurl shorten <url>`.'));
        return;
      }

      console.log(
        bold(
          'CODE'.padEnd(14) +
          'CLICKS'.padEnd(10) +
          'STATUS'.padEnd(12) +
          'DESTINATION'.padEnd(45) +
          'TITLE'
        )
      );
      console.log(dim('─'.repeat(100)));

      for (const l of links) {
        const statusColor = l.status === 'active' ? green : l.status === 'broken' ? red : yellow;
        const codeDisplay = l.short_code.padEnd(14);
        const clicksDisplay = String(l.clicks_count || 0).padEnd(10);
        const statusDisplay = statusColor((l.status || 'active').padEnd(12));
        const destDisplay = (l.destination_url.length > 42 ? l.destination_url.substring(0, 39) + '...' : l.destination_url).padEnd(45);
        const titleDisplay = l.title || '';
        console.log(`${cyan(codeDisplay)}${clicksDisplay}${statusDisplay}${destDisplay}${dim(titleDisplay)}`);
      }
      console.log('');
    } catch (err) {
      handleError(err);
    }
  });

linksCmd
  .command('get <codeOrId>')
  .description('Get detailed information about a link')
  .action(async (codeOrId) => {
    try {
      const client = getClient();
      const res = await client.getLink(codeOrId);

      if (program.opts().json) {
        outputResult(res);
        return;
      }

      const link = res.links?.[0] || res.link;
      if (!link) {
        console.log(yellow(`\nNo link found matching "${codeOrId}".`));
        return;
      }

      console.log(bold(`\nLink Details [${cyan(link.short_code)}]:`));
      console.log(`${bold('ID:')}            ${link.id}`);
      console.log(`${bold('Short URL:')}     ${cyan(`${client.apiUrl}/${link.short_code}`)}`);
      console.log(`${bold('Destination:')}   ${link.destination_url}`);
      console.log(`${bold('Title:')}         ${link.title || '(None)'}`);
      console.log(`${bold('Clicks:')}        ${green(link.clicks_count || 0)}`);
      console.log(`${bold('Status:')}        ${link.status}`);
      console.log(`${bold('Workspace:')}     ${link.workspace_id}`);
      console.log(`${bold('Tags:')}          ${link.tags?.join(', ') || 'None'}`);
      console.log(`${bold('Redirect:')}      HTTP ${link.http_status_code || 301} (${link.redirect_type || 'direct'})`);
      if (link.expires_at) console.log(`${bold('Expires:')}       ${link.expires_at}`);
      if (link.max_clicks) console.log(`${bold('Max Clicks:')}    ${link.max_clicks}`);
      if (link.rules?.length) console.log(`${bold('Smart Rules:')}   ${JSON.stringify(link.rules)}`);
      console.log(`${bold('Created At:')}    ${link.created_at}\n`);
    } catch (err) {
      handleError(err);
    }
  });

linksCmd
  .command('update <codeOrId>')
  .description('Update a link')
  .option('-u, --url <destinationUrl>', 'New destination URL')
  .option('-t, --title <title>', 'New title')
  .option('--status <status>', 'Link status (active|disabled)')
  .option('-g, --tags <tags...>', 'Replace tags')
  .option('--utm-campaign <cmp>', 'Update UTM Campaign')
  .action(async (codeOrId, opts) => {
    try {
      const client = getClient();
      const res = await client.updateLink({
        id: codeOrId,
        destination_url: opts.url,
        title: opts.title,
        status: opts.status,
        tags: opts.tags,
        utm_campaign: opts.utmCampaign
      });
      console.log(green('\n✔ Link updated successfully.'));
      outputResult(res);
    } catch (err) {
      handleError(err);
    }
  });

linksCmd
  .command('delete <codeOrId>')
  .description('Permanently delete a short link')
  .action(async (codeOrId) => {
    try {
      const client = getClient();
      await client.deleteLink(codeOrId);
      console.log(green(`\n✔ Link "${codeOrId}" deleted successfully.`));
    } catch (err) {
      handleError(err);
    }
  });

linksCmd
  .command('bulk <filePath>')
  .description('Bulk import links from a JSON file (Array of { destination_url, custom_slug, title, tags })')
  .option('-b, --batch-name <name>', 'Name for this batch import')
  .action(async (filePath, opts) => {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const raw = fs.readFileSync(filePath, 'utf-8');
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) {
        throw new Error('Input JSON file must contain an array of objects.');
      }

      const client = getClient();
      console.log(cyan(`\nImporting ${items.length} links into workspace ${client.workspaceId}...`));
      const res = await client.bulkImport(items, opts.batchName);
      console.log(green(`\n✔ Bulk import completed! Success: ${res.created_count || res.success_count || 0}, Errors: ${res.error_count || 0}`));
      if (res.errors?.length) {
        console.log(yellow('Errors encountered:'));
        res.errors.forEach(e => console.log(`  Row ${e.row}: ${e.error}`));
      }
    } catch (err) {
      handleError(err);
    }
  });

linksCmd
  .command('health')
  .description('Check broken links and destination health')
  .option('--probe', 'Trigger an active probe across all links')
  .action(async (opts) => {
    try {
      const client = getClient();
      if (opts.probe) {
        console.log(cyan('\nProbing destination endpoints live...'));
        const probeRes = await client.probeLinkHealth();
        console.log(green(`✔ Probed ${probeRes.checked || 0} links. Broken detected: ${probeRes.broken_count || 0}`));
      }
      const res = await client.getLinkHealth();
      if (program.opts().json) {
        outputResult(res);
        return;
      }
      console.log(bold(`\nLink Health Summary for Workspace: ${cyan(client.workspaceId)}`));
      console.log(`${bold('Total Links:')}   ${res.total_links || 0}`);
      console.log(`${bold('Healthy:')}       ${green(res.healthy_count || 0)}`);
      console.log(`${bold('Broken:')}        ${res.broken_count > 0 ? red(res.broken_count) : green('0')}`);
      if (res.broken_links?.length > 0) {
        console.log(red(bold('\nBroken Links List:')));
        res.broken_links.forEach(l => {
          console.log(`  • /${l.short_code} -> ${l.destination_url} [HTTP ${l.broken_code}: ${l.broken_reason}]`);
        });
      }
      console.log('');
    } catch (err) {
      handleError(err);
    }
  });

// --- ANALYTICS COMMAND ---
program
  .command('analytics [code]')
  .description('View click analytics, device stats, and geo data for a link or workspace')
  .action(async (code) => {
    try {
      const client = getClient();
      const res = await client.getAnalytics({ code });

      if (program.opts().json) {
        outputResult(res);
        return;
      }

      const m = res.metrics || {};
      const targetLabel = code ? `Link /${code}` : `Workspace ${client.workspaceId}`;
      console.log(bold(`\nAnalytics Report for: ${cyan(targetLabel)}\n`));
      console.log(`${bold('Total Clicks:')}       ${green(bold(m.total_clicks || 0))}`);
      console.log(`${bold('Unique Visitors:')}    ${cyan(m.unique_visitors || 0)}`);
      console.log(`${bold('Repeat Clicks:')}      ${m.repeat_clicks || 0} (${m.repeat_rate || '0%'})`);
      console.log(`${bold('Bot Filtered:')}       ${yellow(m.bot_clicks_filtered || 0)}`);
      console.log(`${bold('Avg Latency:')}        ${m.avg_latency_ms || 0}ms`);
      if (m.devices) {
        console.log(`${bold('Devices:')}            Mobile: ${m.devices.mobile || '0%'} | Desktop: ${m.devices.desktop || '0%'} | Tablet: ${m.devices.tablet || '0%'}`);
      }
      if (m.top_countries?.length) {
        console.log(bold('\nTop Countries:'));
        m.top_countries.forEach(c => {
          console.log(`  • ${c.country} (${c.code}): ${c.clicks} clicks`);
        });
      }
      console.log('');
    } catch (err) {
      handleError(err);
    }
  });

// --- CAMPAIGNS COMMAND GROUP ---
const cmpCmd = program.command('campaigns').description('Manage marketing campaigns');

cmpCmd
  .command('list')
  .description('List all campaigns in workspace')
  .action(async () => {
    try {
      const client = getClient();
      const res = await client.listCampaigns();
      if (program.opts().json) {
        outputResult(res);
        return;
      }
      const list = res.campaigns || [];
      console.log(bold(`\nCampaigns in Workspace: ${cyan(client.workspaceId)} (${list.length} total)\n`));
      list.forEach(c => {
        console.log(`${bold(c.name)} [ID: ${dim(c.id)}]`);
        console.log(`  Links: ${c.links_count || 0} | Clicks: ${green(c.clicks_count || 0)} / Goal: ${c.target_clicks}`);
        if (c.description) console.log(`  Description: ${dim(c.description)}`);
      });
      console.log('');
    } catch (err) {
      handleError(err);
    }
  });

cmpCmd
  .command('create <name>')
  .description('Create a new marketing campaign')
  .option('-d, --desc <desc>', 'Campaign description')
  .option('-t, --target <clicks>', 'Target clicks goal', '10000')
  .option('-g, --tags <tags...>', 'Tags')
  .action(async (name, opts) => {
    try {
      const client = getClient();
      const res = await client.createCampaign({
        name,
        description: opts.desc,
        target_clicks: Number(opts.target),
        tags: opts.tags
      });
      console.log(green(`\n✔ Campaign "${name}" created successfully!`));
      outputResult(res);
    } catch (err) {
      handleError(err);
    }
  });

cmpCmd
  .command('delete <id>')
  .description('Delete a campaign by ID')
  .action(async (id) => {
    try {
      const client = getClient();
      await client.deleteCampaign(id);
      console.log(green(`\n✔ Campaign "${id}" deleted.`));
    } catch (err) {
      handleError(err);
    }
  });

// --- DOMAINS COMMAND GROUP ---
const domCmd = program.command('domains').description('Manage custom branded domains');

domCmd
  .command('list')
  .description('List custom domains')
  .action(async () => {
    try {
      const client = getClient();
      const res = await client.listDomains();
      if (program.opts().json) {
        outputResult(res);
        return;
      }
      const list = res.domains || [];
      console.log(bold(`\nDomains in Workspace: ${cyan(client.workspaceId)} (${list.length} total)\n`));
      list.forEach(d => {
        const status = d.verified ? green('Verified') : yellow('Pending DNS');
        console.log(`${bold(d.hostname)} [${status}] | SSL: ${d.ssl_status}`);
      });
      console.log('');
    } catch (err) {
      handleError(err);
    }
  });

domCmd
  .command('add <hostname>')
  .description('Register a new custom domain')
  .action(async (hostname) => {
    try {
      const client = getClient();
      const res = await client.addDomain({ hostname });
      console.log(green(`\n✔ Domain "${hostname}" registered!`));
      if (res.dns_instructions) {
        console.log(bold('\nDNS Configuration Instructions:'));
        console.log(`  CNAME Record:  @ or ${hostname} -> ${cyan(res.dns_instructions.cname?.target || 'creataurus.work.gd')}`);
        console.log(`  TXT Challenge: ${res.dns_instructions.ownership_challenge?.host} -> ${cyan(res.dns_instructions.ownership_challenge?.value || res.domain?.verify_token)}`);
      }
      console.log('');
    } catch (err) {
      handleError(err);
    }
  });

domCmd
  .command('probe <hostname>')
  .description('Live TLS & edge connectivity probe')
  .action(async (hostname) => {
    try {
      const client = getClient();
      const res = await client.probeDomain(hostname);
      console.log(bold(`\nProbe Results for ${cyan(hostname)}:`));
      console.log(`  Status:    ${res.ssl_active ? green('SSL Active & Reachable') : yellow('Pending/Unreachable')}`);
      console.log(`  HTTP Code: ${res.http_status || 'N/A'}`);
      console.log(`  Message:   ${res.message}\n`);
    } catch (err) {
      handleError(err);
    }
  });

// --- API KEYS COMMAND GROUP ---
const keysCmd = program.command('keys').description('Manage API keys');

keysCmd
  .command('list')
  .description('List active API keys in workspace')
  .action(async () => {
    try {
      const client = getClient();
      const res = await client.listApiKeys();
      if (program.opts().json) {
        outputResult(res);
        return;
      }
      const list = res.keys || [];
      console.log(bold(`\nAPI Keys for Workspace: ${cyan(client.workspaceId)} (${list.length} active)\n`));
      list.forEach(k => {
        console.log(`${bold(k.name)} [ID: ${dim(k.id)}]`);
        console.log(`  Key Prefix:  ${cyan(k.key_prefix)}••••••••`);
        console.log(`  Created:     ${k.created_at}`);
        console.log(`  Permissions: ${k.permissions?.join(', ')}`);
      });
      console.log('');
    } catch (err) {
      handleError(err);
    }
  });

keysCmd
  .command('create <name>')
  .description('Generate a new secure API Key')
  .option('-p, --permissions <perms...>', 'Permissions (links:read, links:write, analytics:read, etc.)')
  .action(async (name, opts) => {
    try {
      const client = getClient();
      const res = await client.createApiKey({
        name,
        permissions: opts.permissions
      });
      console.log(green(bold('\n✔ API Key Generated Successfully!')));
      console.log(yellow('IMPORTANT: Copy this key now. It will not be shown again:'));
      console.log(cyan(bold(`\n  ${res.full_key}\n`)));
      console.log(`${bold('Key ID:')}      ${res.key?.id}`);
      console.log(`${bold('Workspace:')}   ${client.workspaceId}\n`);
    } catch (err) {
      handleError(err);
    }
  });

keysCmd
  .command('revoke <id>')
  .description('Revoke and delete an API key')
  .action(async (id) => {
    try {
      const client = getClient();
      await client.revokeApiKey(id);
      console.log(green(`\n✔ API Key "${id}" revoked successfully.`));
    } catch (err) {
      handleError(err);
    }
  });

// --- WEBHOOKS COMMAND GROUP ---
const whCmd = program.command('webhooks').description('Manage event webhooks');

whCmd
  .command('list')
  .description('List webhooks in workspace')
  .action(async () => {
    try {
      const client = getClient();
      const res = await client.listWebhooks();
      if (program.opts().json) {
        outputResult(res);
        return;
      }
      const list = res.webhooks || [];
      console.log(bold(`\nWebhooks in Workspace: ${cyan(client.workspaceId)} (${list.length} total)\n`));
      list.forEach(w => {
        console.log(`${bold(w.url)} [ID: ${dim(w.id)}]`);
        console.log(`  Events: ${w.events?.join(', ')} | Active: ${w.active ? green('Yes') : red('No')}`);
      });
      console.log('');
    } catch (err) {
      handleError(err);
    }
  });

whCmd
  .command('create <url>')
  .description('Register a new webhook endpoint')
  .option('-e, --events <events...>', 'Events to subscribe to (e.g. click, link.created)')
  .action(async (url, opts) => {
    try {
      const client = getClient();
      const res = await client.createWebhook({
        url,
        events: opts.events || ['click', 'link.created']
      });
      console.log(green(`\n✔ Webhook registered for ${url}!`));
      outputResult(res);
    } catch (err) {
      handleError(err);
    }
  });

whCmd
  .command('test <id>')
  .description('Trigger a test webhook delivery ping')
  .action(async (id) => {
    try {
      const client = getClient();
      const res = await client.testWebhook(id);
      console.log(green('\n✔ Webhook test ping dispatched!'));
      outputResult(res);
    } catch (err) {
      handleError(err);
    }
  });

// --- CONFIG COMMAND GROUP ---
const cfgCmd = program.command('config').description('Configure CLI settings and defaults');

cfgCmd
  .command('show')
  .description('Show current CLI configuration')
  .action(() => {
    const cfg = loadConfig();
    console.log(bold('\nCurrent TinyURL CLI Configuration:'));
    console.log(`  API URL:      ${cyan(cfg.apiUrl)}`);
    console.log(`  Workspace ID: ${cyan(cfg.workspaceId)}`);
    console.log(`  API Key:      ${cfg.apiKey ? green(`${cfg.apiKey.substring(0, 10)}...••••`) : yellow('(None configured)')}\n`);
  });

cfgCmd
  .command('set <key> <value>')
  .description('Set a configuration parameter (apiUrl, apiKey, workspaceId)')
  .option('-g, --global', 'Save configuration globally in user home')
  .action((key, value, opts) => {
    const validKeys = ['apiUrl', 'apiKey', 'workspaceId'];
    if (!validKeys.includes(key)) {
      console.error(red(`Invalid config key "${key}". Must be one of: ${validKeys.join(', ')}`));
      process.exit(1);
    }
    const res = saveConfig(key, value, !!opts.global);
    console.log(green(`\n✔ Configuration updated in ${res.path}:`));
    console.log(`  ${key} = ${value}\n`);
  });

// --- AUDIT & HEALTH COMMANDS ---
program
  .command('audit')
  .description('Run security risk, malware, and phishing threat audit on links')
  .action(async () => {
    try {
      const client = getClient();
      console.log(cyan('\nRunning link security threat audit...'));
      const res = await client.runSecurityAudit();
      if (program.opts().json) {
        outputResult(res);
        return;
      }
      console.log(bold(`\nSecurity Audit Complete:`));
      console.log(`  Links Scanned:    ${res.scanned_count || 0}`);
      console.log(`  Threats Detected: ${res.threats_detected > 0 ? red(res.threats_detected) : green('0 (All Clean)')}`);
      if (res.results?.length) {
        res.results.forEach(r => {
          const status = r.is_safe ? green('SAFE') : red(`FLAGGED (${r.threat_flags?.join(', ')})`);
          console.log(`  [${status}] /${r.short_code} -> ${r.destination_url} (Risk Score: ${r.risk_score})`);
        });
      }
      console.log('');
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('cache-health')
  .description('Inspect Redis and L1 in-memory cache status and ping latency')
  .action(async () => {
    try {
      const client = getClient();
      const res = await client.getCacheHealth();
      if (program.opts().json) {
        outputResult(res);
        return;
      }
      console.log(bold('\nCache Tier Health Report:'));
      console.log(`  Overall Status:  ${res.success ? green('HEALTHY') : red('DEGRADED')}`);
      console.log(`  L1 Memory Cache: ${green(res.tier_l1?.status)} (${res.tier_l1?.description})`);
      console.log(`  L2 Upstash Redis: ${res.tier_l2?.status === 'connected' ? green('CONNECTED') : yellow(res.tier_l2?.status)} (${res.tier_l2?.latency_ms || 0}ms latency)`);
      console.log(`  Roundtrip Test:  ${res.operations_test?.roundtrip_latency_ms}ms\n`);
    } catch (err) {
      handleError(err);
    }
  });

if (process.argv.length <= 2) {
  printBanner();
  program.help();
} else {
  program.parse(process.argv);
}
