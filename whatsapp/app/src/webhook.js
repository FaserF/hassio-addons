import fs from 'fs';
import path from 'path';
import http from 'http';
import { logger } from './logger.js';
import { SYSTEM_STATE } from './state.js';

import { DATA_DIR } from './config.js';

export const WEBHOOK_CONFIG_FILE = path.join(DATA_DIR, 'webhook_config.json');

export let WEBHOOK_ENABLED = process.env.WEBHOOK_ENABLED === 'true';
export let WEBHOOK_URL = process.env.WEBHOOK_URL || '';
export let WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || '';

if (fs.existsSync(WEBHOOK_CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(WEBHOOK_CONFIG_FILE, 'utf-8'));
    WEBHOOK_ENABLED = config.enabled ?? WEBHOOK_ENABLED;
    WEBHOOK_URL = config.url ?? WEBHOOK_URL;
    WEBHOOK_TOKEN = config.token ?? WEBHOOK_TOKEN;
  } catch {
    /* fall back to env */
  }
}

export function updateWebhookConfig(config) {
  if (config.enabled !== undefined) WEBHOOK_ENABLED = Boolean(config.enabled);
  if (config.url !== undefined) WEBHOOK_URL = config.url;
  if (config.token !== undefined) WEBHOOK_TOKEN = config.token;
}

export async function triggerWebhook(data) {
  if (!WEBHOOK_ENABLED || !WEBHOOK_URL) return;

  try {
    const payload = JSON.stringify(data);
    const url = new URL(WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Webhook-Token': WEBHOOK_TOKEN,
      },
    };

    const protocol = url.protocol === 'https:' ? await import('https') : http;
    const req = protocol.request(options, (res) => {
      logger.debug({ statusCode: res.statusCode }, '[Webhook] Message forwarded');
      // Update integration state since the webhook responded
      SYSTEM_STATE.last_integration_online = Date.now();
    });

    req.on('error', (e) => {
      logger.error({ error: e.message }, '[Webhook] Failed to forward message');
    });

    req.write(payload);
    req.end();
  } catch (e) {
    logger.error({ error: e.message }, '[Webhook] Error during trigger');
  }
}
