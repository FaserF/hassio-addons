import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';
import { GITHUB_TOKEN, ADDON_VERSION } from '../config.js';

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

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours cache
const ERROR_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes backoff cache on rate-limit/error

function fetchJson(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const headers = {
      'User-Agent': 'Home-Assistant-WhatsApp-Addon',
      Accept: 'application/vnd.github+json',
    };
    if (GITHUB_TOKEN && GITHUB_TOKEN !== 'null') {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }
    const req = client.get(
      url,
      { headers },
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
  if (!forceRefresh && now - cache.lastFetch < CACHE_TTL_MS && cache.lastFetch > 0) {
    return cache.data;
  }

  // Always mark lastFetch even if errors occur so we don't spam GitHub on every poll
  cache.lastFetch = now;

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
    const targetIntVer = currentIntVer || cache.data.latestIntegrationVersion;
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

    // 2. Addon version and release notes from local CHANGELOG.md (FaserF/hassio-addons does not use GitHub releases)
    cache.data.latestAddonVersion = ADDON_VERSION || null;
    cache.data.addonReleaseUrl =
      'https://github.com/FaserF/hassio-addons/blob/master/whatsapp/CHANGELOG.md';
    try {
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
  } catch (e) {
    logger.debug({ error: e.message }, 'Failed to check GitHub releases');
    // Set fallback lastFetch on error so we back off for at least 15 minutes
    cache.lastFetch = now - (CACHE_TTL_MS - ERROR_CACHE_TTL_MS);
  }

  return cache.data;
}
