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

/** Clears the in-memory cache so the next loadModerationStore() reads from disk. */
export function clearModerationStoreCache() {
  storeMemory = null;
}

/**
 * Ensures the fed_global_default federation always contains all built-in
 * default patterns. Called every time the store is loaded, even from cache,
 * so that newly-added default patterns appear without a full reset.
 */
function _ensureDefaultFederation(store) {
  const defaultStore = getDefaultModerationStore();
  const defaultFed = defaultStore.federations[0]; // fed_global_default
  if (!Array.isArray(store.federations)) {
    store.federations = defaultStore.federations;
    return;
  }
  const idx = store.federations.findIndex((f) => f.id === 'fed_global_default');
  if (idx === -1) {
    store.federations.unshift(defaultFed);
  } else {
    const stored = store.federations[idx];
    const existingList = Array.isArray(stored.shared_blacklist) ? stored.shared_blacklist : [];
    const merged = [...existingList];
    for (const pattern of defaultFed.shared_blacklist) {
      if (!merged.includes(pattern)) merged.push(pattern);
    }
    store.federations[idx] = {
      ...defaultFed,
      ...stored,
      shared_blacklist: merged,
    };
  }
}

export function loadModerationStore() {
  if (storeMemory) {
    // Always re-apply the default-federation merge even on cache hits,
    // so new built-in patterns become visible without restarting the addon.
    _ensureDefaultFederation(storeMemory);
    return storeMemory;
  }

  const file = getModerationFilePath();
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      storeMemory = { ...getDefaultModerationStore(), ...parsed };
      _ensureDefaultFederation(storeMemory);
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
    language: 'en',
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
      captcha_mode: 'code', // 'code' | 'math' | 'button'
      captcha_target: 'private', // 'private' | 'group'
      captcha_timeout_seconds: 240,
      clean_welcome: false,
    },
    stt_enabled: false, // Speech-to-Text auto transcription toggle (default: false)
    verified_users: {}, // userId -> { verified: boolean, timestamp: number, mode: 'auto' | 'manual' }
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
    filters: [], // [{ trigger, response, is_regex, action, type: 'reply' | 'faq' }]
    reports: [], // [{ id, reporter_id, target_id, reason, timestamp, status }]
    banned_users: {}, // userId -> { timestamp, reason }
    kick_log: [], // [{ userId, reason, timestamp, by }]
    notes: {}, // noteName -> content
    muted_users: {}, // userId -> { until (timestamp or null), reason }
    security_scan: {
      enabled: true,
      engine: 'local', // 'local' | 'virustotal' | 'hybrid'
      trigger: 'auto', // 'auto' | 'command'
      quiet_mode: true,
      scan_files: true,
    },
    translation: {
      enabled: false,
      target_lang: 'en',
      mode: 'manual', // 'manual' | 'auto' | 'forwards'
    },
    antispam: {
      flood_protection: { enabled: false, max_messages: 5, window_seconds: 5, action: 'mute' },
      anti_raid: { enabled: false, max_joins: 5, window_seconds: 10, action: 'lockdown' },
      bot_anti_spam: { enabled: true, max_messages_5s: 5 },
      notify_bypassed_actions: false, // Send explanation note in group when an admin bypasses a moderation action

      blocked_invite_platforms: {
        whatsapp: true,
        telegram: true,
        signal: true,
        instagram: true,
        discord: true,
        other: true,
      },
    },
    ai: {
      enabled: false,
      faq_auto_reply: false,
      sentiment_moderation: false,
      system_prompt:
        'You are an intelligent, friendly, and professional WhatsApp Group Moderator AI. Your goals are to assist group members with accurate information, enforce group etiquette, keep responses concise, polite, and well-formatted for WhatsApp, and maintain a constructive community atmosphere.',
    },
    commands: {
      enabled: true,
      prefix: '!',
      mute_action: 'delete', // WhatsApp limitation: 'delete' un-sends their future messages or restricts group
    },
    federation_id: 'fed_global_default',
    pinned_messages: {}, // msgId -> { id, participant, fromMe } — persisted across restarts
  };
}

export function getDefaultModerationStore() {
  return {
    global_enabled: true,
    gemini_api_key: '',
    global_rules: '',
    filter_subscriptions: [
      {
        url: 'https://raw.githubusercontent.com/FaserF/AegisBot/main/filters/default.yaml',
        enabled: true,
        auto_sync: true,
      },
    ],
    federations: [
      {
        id: 'fed_global_default',
        name: 'Global Default Security Federation',
        description:
          'Shared cross-group security shield for spam prevention, botnet protection, and prohibited link filtering.',
        auto_kick_spammers: true,
        block_mass_invites: true,
        shared_blacklist_enabled: true,
        banned_users: [],
        shared_blacklist: [
          't.me/',
          'telegram.me/',
          'telegram.dog/',
          'chat.whatsapp.com/',
          'whatsapp.com/channel/',
          'wa.me/',
          'signal.group/',
          'signal.me/',
          'instagram.com/j/',
          'ig.me/j/',
          'discord.gg/',
          'discord.com/invite/',
          'line.me/ti/g/',
          'snapchat.com/add/',
          'crypto-airdrop',
          'crypto',
          'free-money-now',
          'bit.ly/claim-bonus',
          'binance-gift',
          'presale-crypto',
        ],
      },
    ],
    groups: {},
  };
}

export function getGroupModerationConfig(groupId) {
  const store = loadModerationStore();
  if (!store.groups[groupId]) {
    const def = getDefaultGroupConfig();
    def.rules.text = store.global_rules || '';
    return def;
  }
  const def = getDefaultGroupConfig();
  const existing = store.groups[groupId];
  const rulesText =
    existing.rules?.text !== undefined ? existing.rules.text : store.global_rules || '';

  return {
    ...def,
    ...existing,
    language: existing.language || def.language || 'en',
    rules: { ...def.rules, ...(existing.rules || {}), text: rulesText },
    greetings: { ...def.greetings, ...(existing.greetings || {}) },
    warnings: { ...def.warnings, ...(existing.warnings || {}) },
    locks: { ...def.locks, ...(existing.locks || {}) },
    blacklist: { ...def.blacklist, ...(existing.blacklist || {}) },
    reports: Array.isArray(existing.reports) ? existing.reports : def.reports,
    banned_users: { ...def.banned_users, ...(existing.banned_users || {}) },
    kick_log: Array.isArray(existing.kick_log) ? existing.kick_log : def.kick_log,
    filters: Array.isArray(existing.filters) ? existing.filters : def.filters,
    notes: { ...def.notes, ...(existing.notes || {}) },
    antispam: {
      notify_bypassed_actions:
        existing.antispam?.notify_bypassed_actions !== undefined
          ? Boolean(existing.antispam.notify_bypassed_actions)
          : def.antispam.notify_bypassed_actions,
      flood_protection: {
        ...def.antispam.flood_protection,
        ...(existing.antispam?.flood_protection || {}),
      },
      anti_raid: {
        ...def.antispam.anti_raid,
        ...(existing.antispam?.anti_raid || {}),
      },
      blocked_invite_platforms: {
        ...def.antispam.blocked_invite_platforms,
        ...(existing.antispam?.blocked_invite_platforms || {}),
      },
    },
    ai: { ...def.ai, ...(existing.ai || {}) },
    translation: { ...def.translation, ...(existing.translation || {}) },
  };
}

export function setGroupModerationConfig(groupId, groupConfig) {
  const store = loadModerationStore();
  store.groups[groupId] = groupConfig;
  saveModerationStore(store);
  return store.groups[groupId];
}
