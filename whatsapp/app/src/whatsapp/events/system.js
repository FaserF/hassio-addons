import { logger } from '../../logger.js';
import { ADDON_VERSION, INTEGRATION_VERSION } from '../../config.js';
import { SYSTEM_STATE, saveSystemState } from '../../state.js';
import { fetchHAVersions, fetchHALogs } from '../../ha.js';
import { formatDuration, formatHATime } from '../../utils/format.js';
import { notifyAdmins } from '../actions.js';

export function getChangelogUrl(repo, version, defaultBranch = 'main') {
  if (!version || version === 'Unknown') {
    return `https://github.com/${repo}/commits/${defaultBranch}`;
  }

  const cleanVer = version.trim();

  // Try extracting explicit git commit SHA
  let commitSha = null;
  const gitPrefixMatch = cleanVer.match(/(?:-g|git-|\/commit\/)([0-9a-f]{7,40})/i);
  const fullShaMatch = cleanVer.match(/\b([0-9a-f]{40})\b/i);

  if (gitPrefixMatch) {
    commitSha = gitPrefixMatch[1];
  } else if (fullShaMatch) {
    commitSha = fullShaMatch[1];
  } else if (/^[0-9a-f]{7,40}$/i.test(cleanVer) && /[a-f]/i.test(cleanVer)) {
    // Only treat as short SHA if it contains hex letters (a-f) to prevent matching date strings like 20260722
    commitSha = cleanVer;
  }

  if (commitSha) {
    return `https://github.com/${repo}/commit/${commitSha}`;
  }

  const isDevOrEdge = /dev|edge|git|alpha/i.test(cleanVer) || /^\d{8}/.test(cleanVer);
  if (isDevOrEdge) {
    return `https://github.com/${repo}/commits/${defaultBranch}`;
  }

  const tagVersion = cleanVer.startsWith('v') ? cleanVer : `v${cleanVer}`;
  return `https://github.com/${repo}/releases/tag/${tagVersion}`;
}

let isCheckingUpdates = false;

export async function checkSystemUpdates(session) {
  if (isCheckingUpdates) return;
  isCheckingUpdates = true;

  try {
    const currentAddonVersion = ADDON_VERSION;
    const currentIntegrationVersion = INTEGRATION_VERSION;
    const haVersions = await fetchHAVersions();
    const currentHAVersion = haVersions.core;
    const now = formatHATime(new Date());

    let updateMessages = [];

    if (
      SYSTEM_STATE.last_addon_version !== 'Unknown' &&
      SYSTEM_STATE.last_addon_version !== currentAddonVersion
    ) {
      const changelogUrl = getChangelogUrl('FaserF/hassio-addons', currentAddonVersion, 'master');
      updateMessages.push(
        `📦 *WhatsApp App Updated*\n• *Version:* ${SYSTEM_STATE.last_addon_version} ➔ ${currentAddonVersion}\n• *Changelog:* ${changelogUrl}`
      );
    }

    if (
      SYSTEM_STATE.last_integration_version !== 'Unknown' &&
      SYSTEM_STATE.last_integration_version !== currentIntegrationVersion
    ) {
      const changelogUrl = getChangelogUrl('FaserF/ha-whatsapp', currentIntegrationVersion, 'main');
      updateMessages.push(
        `🧩 *Integration Updated*\n• *Version:* ${SYSTEM_STATE.last_integration_version} ➔ ${currentIntegrationVersion}\n• *Changelog:* ${changelogUrl}`
      );
    }

    if (SYSTEM_STATE.last_ha_disconnect_time) {
      const downtime = Date.now() - SYSTEM_STATE.last_ha_disconnect_time;
      const durationStr = formatDuration(downtime);

      if (haVersions.safe_mode) {
        const haLogs = await fetchHALogs();
        updateMessages.push(
          `⚠️ *Home Assistant Booted in SAFE MODE*\n• *Downtime:* ${durationStr}\n\n📋 *Recent Logs:*\n\`\`\`\n${haLogs}\n\`\`\``
        );
      } else if (
        SYSTEM_STATE.last_ha_version !== 'Unknown' &&
        SYSTEM_STATE.last_ha_version !== currentHAVersion
      ) {
        updateMessages.push(
          `✅ *Home Assistant Update Successful*\n• *Core:* ${SYSTEM_STATE.last_ha_version} ➔ ${currentHAVersion}\n• *Downtime:* ${durationStr}`
        );
      } else {
        updateMessages.push(`🔄 *Home Assistant back online*\n• *Downtime:* ${durationStr}`);
      }
    }

    // Immediately update SYSTEM_STATE to lock out duplicate concurrent triggers from other sessions
    SYSTEM_STATE.last_addon_version = currentAddonVersion;
    SYSTEM_STATE.last_integration_version = currentIntegrationVersion;
    SYSTEM_STATE.last_ha_version = currentHAVersion;
    SYSTEM_STATE.last_ha_safe_mode = haVersions.safe_mode;
    SYSTEM_STATE.last_ha_disconnect_time = null;
    saveSystemState();

    if (updateMessages.length > 0) {
      const fullText =
        `🔔 *System Status Update*\n• *Time:* ${now}\n\n` + updateMessages.join('\n\n');
      await notifyAdmins(session, fullText);
    }
  } finally {
    isCheckingUpdates = false;
  }
}

export async function monitorHACore(session) {
  if (session.haMonitorInterval) {
    clearInterval(session.haMonitorInterval);
  }

  // If running in standalone Docker without HA Supervisor, skip HA Core supervisor API polling
  if (!process.env.SUPERVISOR_TOKEN) {
    logger.debug(
      'ℹ️ Standalone Docker container detected (no SUPERVISOR_TOKEN). Skipping HA Core polling.'
    );
    return;
  }

  session.haMonitorInterval = setInterval(async () => {
    // Only force refresh if HA is currently offline (to detect restoration quickly)
    // Otherwise use cached versions (15m TTL) to minimize Supervisor API noise.
    const forceRefresh = !!SYSTEM_STATE.last_ha_disconnect_time;
    const haVersions = await fetchHAVersions(forceRefresh);
    const isOnline = haVersions.core !== 'Unknown';

    if (!isOnline && !SYSTEM_STATE.last_ha_disconnect_time) {
      SYSTEM_STATE.last_ha_disconnect_time = Date.now();
      saveSystemState();
      logger.warn('⚠️ HA Core is unreachable. Admin notification pending restore.');

      notifyAdmins(
        session,
        `🔴 *Home Assistant Core Unreachable*\n\n• *Status:* Bot can no longer reach HA Core.\n• *Note:* Automations are temporarily offline.`
      ).catch((e) => logger.debug('Silent fail on HR monitor offline notify:', e.message));
    } else if (isOnline && SYSTEM_STATE.last_ha_disconnect_time) {
      await checkSystemUpdates(session).catch((e) =>
        logger.debug('Silent fail on System Updates check:', e.message)
      );
    }
  }, 120000); // Poll every 2 minutes
}
