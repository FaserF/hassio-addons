import { getGroupModerationConfig, setGroupModerationConfig } from './store.js';

export function exportGroupModeration(groupId) {
  const config = getGroupModerationConfig(groupId);
  return {
    export_version: '1.0.0',
    export_source: 'WhatsAppModerationEngine',
    exported_at: new Date().toISOString(),
    group_id: groupId,
    config,
  };
}

export function importGroupModeration(groupId, importedData) {
  if (!importedData || typeof importedData !== 'object') {
    throw new Error('Invalid import data format: must be an object.');
  }

  let rawConfig = importedData.config || importedData;

  // Handle MissRose export structures if present
  if (importedData.rules || importedData.filters || importedData.locks) {
    rawConfig = {
      rules: {
        text: importedData.rules || '',
        show_on_join: Boolean(importedData.show_rules_on_join),
        require_agreement: false,
      },
      filters: Array.isArray(importedData.filters)
        ? importedData.filters.map((f) => ({
            trigger: f.trigger || f.name || '',
            response: f.reply || f.content || '',
            is_regex: Boolean(f.is_regex),
          }))
        : [],
      blacklist: {
        enabled: Boolean(importedData.blacklist?.words?.length),
        words: Array.isArray(importedData.blacklist?.words) ? importedData.blacklist.words : [],
        action: importedData.blacklist?.action || 'delete',
      },
    };
  }

  const current = getGroupModerationConfig(groupId);
  const updated = {
    ...current,
    ...rawConfig,
    enabled: rawConfig.enabled !== undefined ? rawConfig.enabled : true,
    rules: { ...current.rules, ...(rawConfig.rules || {}) },
    greetings: { ...current.greetings, ...(rawConfig.greetings || {}) },
    warnings: { ...current.warnings, ...(rawConfig.warnings || {}) },
    locks: { ...current.locks, ...(rawConfig.locks || {}) },
    blacklist: { ...current.blacklist, ...(rawConfig.blacklist || {}) },
    filters: Array.isArray(rawConfig.filters) ? rawConfig.filters : current.filters,
    notes: { ...current.notes, ...(rawConfig.notes || {}) },
    antispam: {
      flood_protection: {
        ...current.antispam.flood_protection,
        ...(rawConfig.antispam?.flood_protection || {}),
      },
      anti_raid: {
        ...current.antispam.anti_raid,
        ...(rawConfig.antispam?.anti_raid || {}),
      },
    },
    ai: { ...current.ai, ...(rawConfig.ai || {}) },
  };

  setGroupModerationConfig(groupId, updated);
  return updated;
}
