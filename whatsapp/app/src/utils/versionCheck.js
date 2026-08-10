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

export async function getLatestReleases(
  forceRefresh = false,
  _currentAddonVer = null,
  currentIntVer = null
) {
  const now = Date.now();
  if (!forceRefresh && now - cache.lastFetch < CACHE_TTL_MS && cache.data.latestAddonVersion) {
    return cache.data;
  }

  try {
    // 1. Fetch Integration releases (FaserF/ha-whatsapp)
    let intReleaseList = await fetchJson(
      'https://api.github.com/repos/FaserF/ha-whatsapp/releases'
    );
    if (!Array.isArray(intReleaseList)) {
      const single = await fetchJson(
        'https://api.github.com/repos/FaserF/ha-whatsapp/releases/latest'
      );
      if (single) intReleaseList = [single];
    }
    const targetIntVer = currentIntVer || cache.data.integrationVersion;
    let intRelease = null;
    if (Array.isArray(intReleaseList) && intReleaseList.length > 0) {
      if (targetIntVer) {
        intRelease = intReleaseList.find(
          (r) => r.tag_name && r.tag_name.replace(/^v/, '') === targetIntVer
        );
      }
      if (!intRelease) {
        intRelease = intReleaseList[0];
      }
    }

    if (intRelease && intRelease.tag_name) {
      cache.data.latestIntegrationVersion = intRelease.tag_name.replace(/^v/, '');
      cache.data.integrationChangelog = intRelease.body || 'No release notes available.';
      cache.data.integrationReleaseUrl =
        intRelease.html_url || 'https://github.com/FaserF/ha-whatsapp/releases';
    }

    // 2. Fetch Addon release notes from local CHANGELOG.md (FaserF/hassio-addons does not use GitHub releases)
    cache.data.addonReleaseUrl =
      'https://github.com/FaserF/hassio-addons/blob/master/whatsapp/CHANGELOG.md';
    try {
      const fs = await import('fs');
      const path = await import('path');
      const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
      if (fs.existsSync(changelogPath)) {
        const content = fs.readFileSync(changelogPath, 'utf-8');
        if (content && content.trim().length > 0) {
          cache.data.addonChangelog = content.slice(0, 4000);
        }
      }
    } catch (e) {
      // ignore file read error
    }
    if (!cache.data.addonChangelog) {
      cache.data.addonChangelog = 'No release notes available.';
    }

    cache.lastFetch = now;
  } catch (e) {
    logger.debug({ error: e.message }, 'Failed to check GitHub releases');
  }

  return cache.data;
}
