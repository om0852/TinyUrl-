import fs from 'fs';
import path from 'path';
import os from 'os';

const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.tinyurlrc.json');
const LOCAL_CONFIG_PATH = path.join(process.cwd(), '.tinyurlrc.json');

/**
 * Parses simple KEY=VALUE pairs from a file (e.g. .env.local)
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        result[key] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Loads configuration with precedence:
 * 1. CLI options passed in
 * 2. Process environment variables
 * 3. Local project .env.local file
 * 4. Local .tinyurlrc.json
 * 5. Global ~/.tinyurlrc.json
 * 6. Defaults
 */
export function loadConfig(cliOptions = {}) {
  let fileConfig = {};

  // Try global config
  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8'));
    } catch {}
  }

  // Try local config (overrides global)
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      const local = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf-8'));
      fileConfig = { ...fileConfig, ...local };
    } catch {}
  }

  // Try parsing .env.local in project root
  const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));

  const apiUrl =
    cliOptions.apiUrl ||
    process.env.TINYURL_API_URL ||
    fileConfig.apiUrl ||
    envLocal.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';

  const apiKey =
    cliOptions.apiKey ||
    process.env.TINYURL_API_KEY ||
    process.env.PLATFORM_API_KEY ||
    fileConfig.apiKey ||
    envLocal.PLATFORM_API_KEY ||
    '';

  const workspaceId =
    cliOptions.workspaceId ||
    process.env.TINYURL_WORKSPACE_ID ||
    fileConfig.workspaceId ||
    '';

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiKey: apiKey.trim(),
    workspaceId: workspaceId.trim()
  };
}

/**
 * Updates a configuration key in the local or global configuration file
 */
export function saveConfig(key, value, isGlobal = false) {
  const targetPath = isGlobal ? GLOBAL_CONFIG_PATH : LOCAL_CONFIG_PATH;
  let current = {};
  if (fs.existsSync(targetPath)) {
    try {
      current = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    } catch {}
  }
  current[key] = value;
  fs.writeFileSync(targetPath, JSON.stringify(current, null, 2), 'utf-8');
  return { path: targetPath, config: current };
}
