import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
let cachedHAVersions = { core: 'Unknown', os: 'Unknown', safe_mode: false, lastUpdate: 0 };

/**
 * Fetches version information from the HA Supervisor API.
 */
export async function fetchHAVersions(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && now - cachedHAVersions.lastUpdate < 15 * 60 * 1000) return cachedHAVersions;

  if (!SUPERVISOR_TOKEN) {
    cachedHAVersions.lastUpdate = now;
    return cachedHAVersions;
  }

  try {
    const fetch = async (urlPath) => {
      const options = {
        hostname: 'supervisor',
        port: 80,
        path: urlPath,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
          'Content-Type': 'application/json',
        },
      };
      return new Promise((resolve) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          });
        });
        req.on('error', () => resolve(null));
        req.end();
      });
    };

    const coreData = await fetch('/core/info');
    const osData = await fetch('/os/info');

    if (coreData && coreData.result === 'ok') {
      cachedHAVersions.core = coreData.data.version;
      cachedHAVersions.safe_mode = coreData.data.safe_mode || false;
    } else {
      cachedHAVersions.core = 'Unknown';
      cachedHAVersions.safe_mode = false;
    }
    if (osData && osData.result === 'ok') {
      cachedHAVersions.os = osData.data.version || 'Unknown';
    } else {
      cachedHAVersions.os = 'Unknown';
    }
    cachedHAVersions.lastUpdate = now;
  } catch (e) {
    logger.debug({ error: e.message }, 'Failed to fetch HA versions');
  }
  return cachedHAVersions;
}

/**
 * Fetches the last 50 lines of Home Assistant Core logs.
 */
export async function fetchHALogs() {
  if (!SUPERVISOR_TOKEN) return 'Supervisor Token not available.';

  return new Promise((resolve) => {
    const options = {
      hostname: 'supervisor',
      port: 80,
      path: '/core/logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const lines = data.split('\n').filter((l) => l.trim().length > 0);
        resolve(lines.slice(-50).join('\n'));
      });
    });

    req.on('error', (e) => resolve(`Error fetching logs: ${e.message}`));
    req.end();
  });
}

/**
 * Fetches the current addon options from the Supervisor API.
 */
export async function fetchAddonSelfOptions() {
  if (!SUPERVISOR_TOKEN) return null;

  const options = {
    hostname: 'supervisor',
    port: 80,
    path: '/addons/self/options',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data?.options || json.options || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * Calls the Home Assistant Supervisor API to set reset_session to false.
 * Fetches existing options first to avoid overwriting other settings.
 */
export async function disableResetSession() {
  if (!SUPERVISOR_TOKEN) {
    logger.debug('No SUPERVISOR_TOKEN found, skipping auto-disable of reset_session.');
    return;
  }

  // Fetch current options to merge
  const currentOptions = await fetchAddonSelfOptions();
  if (!currentOptions) {
    logger.warn(
      '⚠️ Could not fetch current options, proceeding with partial update (risk of reset).'
    );
  }

  const newOptions = {
    ...(currentOptions || {}),
    reset_session: false,
  };

  const data = JSON.stringify({ options: newOptions });

  const options = {
    hostname: 'supervisor',
    port: 80,
    path: '/addons/self/options',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        logger.info(
          '✅ Successfully disabled reset_session via Supervisor API (options preserved).'
        );
      } else {
        logger.error(
          { statusCode: res.statusCode },
          '❌ Failed to disable reset_session via Supervisor API.'
        );
      }
      resolve();
    });

    req.on('error', (error) => {
      logger.error({ error: error.message }, '❌ Error calling Supervisor API');
      resolve();
    });

    req.write(data);
    req.end();
  });
}

/**
 * Sends a persistent notification to Home Assistant.
 */
export async function sendHANotification(title, message, notificationId = null) {
  if (!SUPERVISOR_TOKEN) return;

  const data = JSON.stringify({
    title,
    message,
    notification_id: notificationId,
  });

  const options = {
    hostname: 'supervisor',
    port: 80,
    path: '/core/api/services/persistent_notification/create',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

/**
 * Detects if the addon is running within the Home Assistant internal network.
 * This is used to restrict sensitive discovery info to trusted environments.
 */
export function isHANetwork() {
  // If we have a Supervisor Token, we are likely running as an addon.
  if (!SUPERVISOR_TOKEN) return false;

  // Check network interfaces for standard HA Docker IP ranges (e.g. 172.30.x.x)
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Standard HA Addon network is often in 172.30.32.0/24 or similar 172.x ranges.
        // We look for 172.* specifically in the context of HA.
        if (iface.address.startsWith('172.')) {
          return true;
        }
      }
    }
  }

  // Fallback to true if SUPERVISOR_TOKEN is present but IP check is ambiguous
  return true;
}

/**
 * Triggers a Home Assistant automation via REST API.
 * @param {string} baseUrl - Home Assistant Base URL (e.g. http://homeassistant.local:8123)
 * @param {string} token - Home Assistant Long-Lived Access Token
 * @param {string} automationId - ID or entity_id of the automation (e.g. 'morning_routine')
 * @returns {Promise<{success: boolean, status: string, data?: any}>}
 */
export async function triggerHAAutomation(baseUrl, token, automationId) {
  try {
    const cleanId = (automationId || '').replace(/^automation\./, '');
    const cleanUrl = (baseUrl || 'http://supervisor/core').replace(/\/+$/, '');
    const targetUrl = new URL(`${cleanUrl}/api/services/automation/trigger`);
    const payload = JSON.stringify({ entity_id: `automation.${cleanId}` });

    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? await import('https') : http;

    return new Promise((resolve) => {
      const req = client.request(
        targetUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token || SUPERVISOR_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            const success = res.statusCode >= 200 && res.statusCode < 300;
            let parsed;
            try {
              parsed = JSON.parse(body);
            } catch {
              parsed = body;
            }
            resolve({
              success,
              statusCode: res.statusCode,
              status: success
                ? `✅ Automation '${cleanId}' erfolgreich ausgelöst`
                : `❌ Fehler (${res.statusCode}): ${body}`,
              data: parsed,
            });
          });
        }
      );
      req.on('error', (err) => {
        resolve({ success: false, status: `❌ Verbindungsfehler: ${err.message}` });
      });
      req.write(payload);
      req.end();
    });
  } catch (err) {
    return { success: false, status: `❌ Fehler: ${err.message}` };
  }
}

/**
 * Helper to extract dot-notated json path (e.g. 'tag_name' or 'data.version').
 */
function extractJsonPath(data, path) {
  if (!path) return data;
  const parts = path.split('.');
  let current = data;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Queries a public or private Web API and extracts a field from the JSON response.
 * @param {string} url - API Endpoint URL
 * @param {string} [jsonPath] - Dot-notated property path (e.g. 'tag_name', 'version')
 * @param {object} [headers] - Request headers
 * @returns {Promise<{success: boolean, result: string, raw?: any}>}
 */
export async function queryWebAPI(url, jsonPath = null, headers = {}) {
  try {
    const targetUrl = new URL(url);
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? await import('https') : http;

    return new Promise((resolve) => {
      const req = client.request(
        targetUrl,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'AegisBot-WhatsApp-Gateway/1.0',
            ...headers,
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(body);
                const extracted = jsonPath ? extractJsonPath(parsed, jsonPath) : parsed;
                resolve({
                  success: true,
                  result:
                    typeof extracted === 'object'
                      ? JSON.stringify(extracted)
                      : String(extracted ?? ''),
                  raw: parsed,
                });
              } catch {
                resolve({ success: true, result: body, raw: body });
              }
            } else {
              resolve({
                success: false,
                result: `HTTP ${res.statusCode}`,
                raw: body,
              });
            }
          });
        }
      );
      req.on('error', (err) => {
        resolve({ success: false, result: `Error: ${err.message}` });
      });
      req.end();
    });
  } catch (err) {
    return { success: false, result: `Error: ${err.message}` };
  }
}

let cachedHAGeminiKey = null;
let cachedHAOpenAIKey = null;
let lastKeyScanTime = 0;

/**
 * Searches Home Assistant config directories and secrets for Google Gemini / OpenAI API keys.
 */
export function getHAApiKeys(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedHAGeminiKey !== null && now - lastKeyScanTime < 60000) {
    return {
      gemini: cachedHAGeminiKey,
      openai: cachedHAOpenAIKey,
    };
  }

  let geminiResult = null;
  let openaiResult = null;

  // 1. Check environment variables
  const envGemini =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (envGemini && typeof envGemini === 'string' && envGemini.trim()) {
    geminiResult = {
      key: envGemini.trim(),
      source: 'environment',
      sourceLabel: 'Environment Variable (GEMINI_API_KEY)',
    };
  }
  const envOpenAI = process.env.OPENAI_API_KEY;
  if (envOpenAI && typeof envOpenAI === 'string' && envOpenAI.trim()) {
    openaiResult = {
      key: envOpenAI.trim(),
      source: 'environment',
      sourceLabel: 'Environment Variable (OPENAI_API_KEY)',
    };
  }

  // 2. Search Home Assistant storage and secrets
  const possibleConfigDirs = [
    '/config',
    '/homeassistant',
    '/data/homeassistant',
    process.env.HA_CONFIG_DIR,
  ].filter(Boolean);

  for (const configDir of possibleConfigDirs) {
    if (!fs.existsSync(configDir)) continue;

    // A. Check .storage/core.config_entries
    const entriesPath = path.join(configDir, '.storage', 'core.config_entries');
    if (fs.existsSync(entriesPath)) {
      try {
        const raw = fs.readFileSync(entriesPath, 'utf8');
        const parsed = JSON.parse(raw);
        const entries = parsed?.data?.entries || [];

        if (!geminiResult) {
          const geminiEntry = entries.find(
            (e) =>
              (e.domain === 'google_generative_ai_conversation' ||
                e.domain === 'google_generative_ai' ||
                e.domain === 'google_ai' ||
                e.domain === 'gemini') &&
              (e.data?.api_key || e.options?.api_key)
          );
          if (geminiEntry) {
            const key = geminiEntry.data?.api_key || geminiEntry.options?.api_key;
            if (key && typeof key === 'string' && key.trim()) {
              geminiResult = {
                key: key.trim(),
                source: 'ha_integration',
                sourceLabel: 'Home Assistant (Google Generative AI Integration)',
              };
            }
          }
        }

        if (!openaiResult) {
          const openaiEntry = entries.find(
            (e) =>
              (e.domain === 'openai' || e.domain === 'openai_conversation') &&
              (e.data?.api_key || e.options?.api_key)
          );
          if (openaiEntry) {
            const key = openaiEntry.data?.api_key || openaiEntry.options?.api_key;
            if (key && typeof key === 'string' && key.trim()) {
              openaiResult = {
                key: key.trim(),
                source: 'ha_integration',
                sourceLabel: 'Home Assistant (OpenAI Integration)',
              };
            }
          }
        }
      } catch (_err) {}
    }

    // B. Check secrets.yaml
    const secretsPath = path.join(configDir, 'secrets.yaml');
    if (fs.existsSync(secretsPath)) {
      try {
        const secretsRaw = fs.readFileSync(secretsPath, 'utf8');
        const lines = secretsRaw.split('\n');
        for (const line of lines) {
          const clean = line.trim();
          if (!clean || clean.startsWith('#')) continue;
          const match = clean.match(/^([a-zA-Z0-9_-]+)\s*:\s*["']?([^"'#\r\n]+)["']?/);
          if (match) {
            const keyName = match[1].toLowerCase();
            const val = match[2].trim();

            if (
              !geminiResult &&
              [
                'gemini_api_key',
                'google_api_key',
                'google_generative_ai_api_key',
                'gemini_key',
                'google_ai_key',
              ].includes(keyName)
            ) {
              geminiResult = {
                key: val,
                source: 'ha_secrets',
                sourceLabel: `Home Assistant secrets.yaml (${match[1]})`,
              };
            }

            if (!openaiResult && ['openai_api_key', 'openai_key'].includes(keyName)) {
              openaiResult = {
                key: val,
                source: 'ha_secrets',
                sourceLabel: `Home Assistant secrets.yaml (${match[1]})`,
              };
            }
          }
        }
      } catch (_err) {}
    }
  }

  cachedHAGeminiKey = geminiResult;
  cachedHAOpenAIKey = openaiResult;
  lastKeyScanTime = now;

  return {
    gemini: geminiResult,
    openai: openaiResult,
  };
}

/**
 * Resolves the effective Google Gemini API key.
 * Prioritizes explicit custom key if provided; otherwise falls back to Home Assistant integration/secrets/env.
 */
export function resolveEffectiveGeminiKey(explicitKey = '') {
  if (explicitKey && typeof explicitKey === 'string' && explicitKey.trim()) {
    return {
      key: explicitKey.trim(),
      source: 'custom_settings',
      sourceLabel: 'Addon UI Settings',
    };
  }
  const haKeys = getHAApiKeys();
  return haKeys.gemini || null;
}

/**
 * Resolves the effective OpenAI API key.
 * Prioritizes explicit custom key if provided; otherwise falls back to Home Assistant integration/secrets/env.
 */
export function resolveEffectiveOpenAIKey(explicitKey = '') {
  if (explicitKey && typeof explicitKey === 'string' && explicitKey.trim()) {
    return {
      key: explicitKey.trim(),
      source: 'custom_settings',
      sourceLabel: 'Addon UI Settings',
    };
  }
  const haKeys = getHAApiKeys();
  return haKeys.openai || null;
}
