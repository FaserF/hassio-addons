import http from 'http';
import https from 'https';
import { logger } from '../logger.js';

let cache = {
  lastFetch: 0,
  data: {
    latestAddonVersion: null,
    addonChangelog: null,
    addonReleaseUrl: null,
    latestIntegrationVersion: null,
    integrationChangelog: null,
    integrationReleaseUrl: null,
  },
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

function fetchJson(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'Home-Assistant-WhatsApp-Addon',
          Accept: 'application/vnd.github+json',
        },
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          resolve(null);
          return;
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

export async function getLatestReleases(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && now - cache.lastFetch < CACHE_TTL_MS && cache.data.latestAddonVersion) {
    return cache.data;
  }

  try {
    // 1. Fetch Integration latest release (FaserF/ha-whatsapp)
    const intRelease = await fetchJson('https://api.github.com/repos/FaserF/ha-whatsapp/releases/latest');
    if (intRelease && intRelease.tag_name) {
      cache.data.latestIntegrationVersion = intRelease.tag_name.replace(/^v/, '');
      cache.data.integrationChangelog = intRelease.body || 'Keine Releasenotes verfügbar.';
      cache.data.integrationReleaseUrl = intRelease.html_url || 'https://github.com/FaserF/ha-whatsapp/releases';
    }

    // 2. Fetch Addon latest release (FaserF/hassio-addons)
    const addonRelease = await fetchJson('https://api.github.com/repos/FaserF/hassio-addons/releases/latest');
    if (addonRelease && addonRelease.tag_name) {
      cache.data.latestAddonVersion = addonRelease.tag_name.replace(/^v/, '').replace(/^whatsapp-/, '');
      cache.data.addonChangelog = addonRelease.body || 'Keine Releasenotes verfügbar.';
      cache.data.addonReleaseUrl = addonRelease.html_url || 'https://github.com/FaserF/hassio-addons/releases';
    }

    cache.lastFetch = now;
  } catch (e) {
    logger.debug({ error: e.message }, 'Failed to check GitHub releases');
  }

  return cache.data;
}
