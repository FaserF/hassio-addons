import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../../config.js';
import { logger } from '../../logger.js';

export function getModerationFilePath() {
  const dir = process.env.DATA_DIR || DATA_DIR;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'moderation_config.json');
  } catch (e) {
    const fallbackDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(fallbackDir)) {
      try {
        fs.mkdirSync(fallbackDir, { recursive: true });
      } catch (err) {}
    }
    return path.join(fallbackDir, 'moderation_config.json');
  }
}

let storeMemory = null;

export function loadModerationStore() {
  if (storeMemory) return storeMemory;

  const file = getModerationFilePath();
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      storeMemory = { ...getDefaultModerationStore(), ...parsed };
      logger.info('🛡️ Loaded moderation configuration from disk.');
      return storeMemory;
    }
  } catch (err) {
    logger.error(
      { error: err.message },
      '⚠️ Failed to read moderation_config.json, using defaults.'
    );
  }

  storeMemory = getDefaultModerationStore();
  saveModerationStore(storeMemory);
  return storeMemory;
}

export function saveModerationStore(data) {
  try {
    storeMemory = data;
    const file = getModerationFilePath();
    const parentDir = path.dirname(file);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ error: err.message }, '❌ Failed to save moderation_config.json.');
    return false;
  }
}

export function getDefaultGroupConfig() {
  return {
    enabled: false,
    rules: {
      text: '',
      show_on_join: false,
      require_agreement: false,
    },
    greetings: {
      welcome_enabled: false,
      welcome_message: 'Welcome {user} to {group}!',
      goodbye_enabled: false,
      goodbye_message: 'Goodbye {user}!',
      captcha_enabled: false,
      captcha_mode: 'button', // 'button' | 'math' | 'text'
      captcha_timeout_seconds: 120,
      clean_welcome: false,
    },
    warnings: {
      max_warnings: 3,
      action: 'mute', // 'mute' | 'kick' | 'ban'
      decay_hours: 24,
      user_warns: {}, // userId -> [{ reason, timestamp }]
    },
    locks: {
      image: { enabled: false, action: 'delete' },
      video: { enabled: false, action: 'delete' },
      audio: { enabled: false, action: 'delete' },
      document: { enabled: false, action: 'delete' },
      sticker: { enabled: false, action: 'delete' },
      url: { enabled: false, action: 'delete' },
      invite: { enabled: false, action: 'delete' },
      poll: { enabled: false, action: 'delete' },
      contact: { enabled: false, action: 'delete' },
      location: { enabled: false, action: 'delete' },
      forwarded: { enabled: false, action: 'delete' },
      rtl: { enabled: false, action: 'delete' },
    },
    blacklist: {
      enabled: false,
      words: [],
      action: 'delete', // 'delete' | 'warn' | 'mute' | 'kick' | 'ban'
    },
    filters: [], // [{ trigger, response, is_regex }]
    notes: {}, // noteName -> content
    antispam: {
      flood_protection: { enabled: false, max_messages: 5, window_seconds: 5, action: 'mute' },
      anti_raid: { enabled: false, max_joins: 5, window_seconds: 10, action: 'lockdown' },
    },
    ai: {
      enabled: false,
      faq_auto_reply: false,
      sentiment_moderation: false,
      system_prompt: 'You are a helpful group moderator AI assistant.',
    },
    federation_id: '',
  };
}

export function getDefaultModerationStore() {
  return {
    global_enabled: false,
    gemini_api_key: '',
    federations: [
      {
        id: 'fed_global_default',
        name: 'Global Default Federation',
        banned_users: [],
      },
    ],
    groups: {},
  };
}

export function getGroupModerationConfig(groupId) {
  const store = loadModerationStore();
  if (!store.groups[groupId]) {
    return getDefaultGroupConfig();
  }
  const def = getDefaultGroupConfig();
  const existing = store.groups[groupId];

  return {
    ...def,
    ...existing,
    rules: { ...def.rules, ...(existing.rules || {}) },
    greetings: { ...def.greetings, ...(existing.greetings || {}) },
    warnings: { ...def.warnings, ...(existing.warnings || {}) },
    locks: { ...def.locks, ...(existing.locks || {}) },
    blacklist: { ...def.blacklist, ...(existing.blacklist || {}) },
    filters: Array.isArray(existing.filters) ? existing.filters : def.filters,
    notes: { ...def.notes, ...(existing.notes || {}) },
    antispam: {
      flood_protection: {
        ...def.antispam.flood_protection,
        ...(existing.antispam?.flood_protection || {}),
      },
      anti_raid: {
        ...def.antispam.anti_raid,
        ...(existing.antispam?.anti_raid || {}),
      },
    },
    ai: { ...def.ai, ...(existing.ai || {}) },
  };
}

export function setGroupModerationConfig(groupId, groupConfig) {
  const store = loadModerationStore();
  store.groups[groupId] = groupConfig;
  saveModerationStore(store);
  return store.groups[groupId];
}
