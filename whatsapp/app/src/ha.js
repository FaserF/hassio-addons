import http from 'http';
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
