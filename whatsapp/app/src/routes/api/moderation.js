import {
  loadModerationStore,
  saveModerationStore,
  getGroupModerationConfig,
  setGroupModerationConfig,
} from '../../whatsapp/moderation/store.js';
import {
  issueUserWarning,
  clearUserWarnings,
  setUserCaptchaVerification,
  getGroupCaptchaUsers,
} from '../../whatsapp/moderation/engine.js';
import {
  exportGroupModeration,
  importGroupModeration,
} from '../../whatsapp/moderation/migration.js';
import { registry } from '../../whatsapp/moderation/commands.js';
import { sessions } from '../../session.js';

export function registerModerationRoutes(app) {
  // GET /api/moderation/commands — Dynamically list all registered built-in commands
  app.get('/api/moderation/commands', (req, res) => {
    const list = [];
    const seen = new Set();
    for (const [cmd, details] of Object.entries(registry.commands)) {
      if (seen.has(details)) continue;
      seen.add(details);
      list.push({
        cmd,
        adminOnly: details.adminOnly,
        help: details.help,
        aliases: details.aliases || [],
      });
    }
    res.json({ success: true, data: list });
  });
  // GET /api/moderation/config
  app.get('/api/moderation/config', (req, res) => {
    const store = loadModerationStore();
    res.json({ success: true, data: store });
  });

  // POST /api/moderation/config
  app.post('/api/moderation/config', (req, res) => {
    const store = loadModerationStore();
    const {
      global_enabled,
      gemini_api_key,
      global_rules,
      federations,
      filter_subscriptions,
      group_id,
      group_config,
    } = req.body || {};

    if (global_enabled !== undefined) {
      store.global_enabled = Boolean(global_enabled);
    }
    if (gemini_api_key !== undefined) {
      store.gemini_api_key = String(gemini_api_key).trim();
    }
    if (global_rules !== undefined) {
      store.global_rules = String(global_rules);
    }
    if (Array.isArray(federations)) {
      store.federations = federations;
    }
    if (Array.isArray(filter_subscriptions)) {
      store.filter_subscriptions = filter_subscriptions;
    }
    if (group_id && group_config) {
      setGroupModerationConfig(group_id, group_config);
    } else {
      saveModerationStore(store);
    }

    res.json({ success: true, data: loadModerationStore() });
  });

  // POST /api/moderation/groups/:groupId/enable
  app.post('/api/moderation/groups/:groupId/enable', (req, res) => {
    const { groupId } = req.params;
    const config = getGroupModerationConfig(groupId);
    config.enabled = true;
    setGroupModerationConfig(groupId, config);
    res.json({ success: true, data: config });
  });

  // POST /api/moderation/groups/:groupId/disable
  app.post('/api/moderation/groups/:groupId/disable', (req, res) => {
    const { groupId } = req.params;
    const config = getGroupModerationConfig(groupId);
    config.enabled = false;
    setGroupModerationConfig(groupId, config);
    res.json({ success: true, data: config });
  });

  // POST /api/moderation/groups/:groupId/warn
  app.post('/api/moderation/groups/:groupId/warn', async (req, res) => {
    const { groupId } = req.params;
    const { user_id, reason } = req.body || {};
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'Missing user_id parameter' });
    }

    const session = Array.from(sessions.values()).find((s) => s.isConnected);
    if (session) {
      await issueUserWarning(session, groupId, user_id, reason || 'Manual admin warning');
    }

    const config = getGroupModerationConfig(groupId);
    res.json({ success: true, data: config.warnings });
  });

  // DELETE /api/moderation/groups/:groupId/warn/:userId
  app.delete('/api/moderation/groups/:groupId/warn/:userId', (req, res) => {
    const { groupId, userId } = req.params;
    const cleared = clearUserWarnings(groupId, userId);
    const config = getGroupModerationConfig(groupId);
    res.json({ success: true, cleared, data: config.warnings });
  });

  // GET /api/moderation/groups/:groupId/captcha/users
  app.get('/api/moderation/groups/:groupId/captcha/users', async (req, res) => {
    try {
      const { groupId } = req.params;
      const session = Array.from(sessions.values()).find((s) => s.isConnected);
      const users = await getGroupCaptchaUsers(groupId, session);
      // Sanitize to ensure JSON-serializable output (remove undefined/function values)
      const sanitized = JSON.parse(JSON.stringify(users));
      res.json({ success: true, data: sanitized });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/moderation/groups/:groupId/captcha/verify
  app.post('/api/moderation/groups/:groupId/captcha/verify', (req, res) => {
    const { groupId } = req.params;
    const { user_id, verified } = req.body || {};
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'Missing user_id parameter' });
    }
    const session = Array.from(sessions.values()).find((s) => s.isConnected);
    const record = setUserCaptchaVerification(groupId, user_id, Boolean(verified), session);
    res.json({ success: true, data: record });
  });

  // POST /api/moderation/groups/:groupId/reports/:reportId/resolve
  app.post('/api/moderation/groups/:groupId/reports/:reportId/resolve', (req, res) => {
    const { groupId, reportId } = req.params;
    const store = loadModerationStore();
    const config = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (Array.isArray(config.reports)) {
      const rep = config.reports.find((r) => r.id === reportId);
      if (rep) {
        rep.status = 'resolved';
        store.groups[groupId] = config;
        saveModerationStore(store);
      }
    }
    res.json({ success: true, data: config.reports });
  });

  // POST /api/moderation/groups/:groupId/export
  app.post('/api/moderation/groups/:groupId/export', (req, res) => {
    const { groupId } = req.params;
    const exported = exportGroupModeration(groupId);
    res.json({ success: true, data: exported });
  });

  // POST /api/moderation/groups/:groupId/import
  app.post('/api/moderation/groups/:groupId/import', (req, res) => {
    const { groupId } = req.params;
    const importData = req.body;
    try {
      const updated = importGroupModeration(groupId, importData);
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/moderation/groups/:groupId/ban/:userId
  app.delete('/api/moderation/groups/:groupId/ban/:userId', (req, res) => {
    const { groupId, userId } = req.params;
    if (
      !userId ||
      !groupId ||
      userId === '__proto__' ||
      userId === 'constructor' ||
      userId === 'prototype' ||
      groupId === '__proto__' ||
      groupId === 'constructor' ||
      groupId === 'prototype'
    ) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }
    const config = getGroupModerationConfig(groupId);
    if (config.banned_users && Object.prototype.hasOwnProperty.call(config.banned_users, userId)) {
      delete config.banned_users[userId];
      setGroupModerationConfig(groupId, config);
      res.json({ success: true, data: config.banned_users });
    } else {
      res.status(404).json({ success: false, error: 'Ban record not found' });
    }
  });

  // DELETE /api/moderation/groups/:groupId/kick/:userId
  app.delete('/api/moderation/groups/:groupId/kick/:userId', (req, res) => {
    const { groupId, userId } = req.params;
    if (
      !userId ||
      !groupId ||
      userId === '__proto__' ||
      userId === 'constructor' ||
      userId === 'prototype' ||
      groupId === '__proto__' ||
      groupId === 'constructor' ||
      groupId === 'prototype'
    ) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }
    const config = getGroupModerationConfig(groupId);
    if (Array.isArray(config.kick_log)) {
      config.kick_log = config.kick_log.filter((k) => k && k.userId !== userId);
      setGroupModerationConfig(groupId, config);
    }
    res.json({ success: true, data: config.kick_log || [] });
  });

  // DELETE /api/moderation/groups/:groupId/mute/:userId
  app.delete('/api/moderation/groups/:groupId/mute/:userId', (req, res) => {
    const { groupId, userId } = req.params;
    if (
      !userId ||
      !groupId ||
      userId === '__proto__' ||
      userId === 'constructor' ||
      userId === 'prototype' ||
      groupId === '__proto__' ||
      groupId === 'constructor' ||
      groupId === 'prototype'
    ) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }
    const config = getGroupModerationConfig(groupId);
    if (config.muted_users && Object.prototype.hasOwnProperty.call(config.muted_users, userId)) {
      delete config.muted_users[userId];
      setGroupModerationConfig(groupId, config);
      res.json({ success: true, data: config.muted_users });
    } else {
      res.status(404).json({ success: false, error: 'Mute record not found' });
    }
  });

  // GET /api/moderation/federations
  app.get('/api/moderation/federations', (req, res) => {
    const store = loadModerationStore();
    res.json({ success: true, data: store.federations || [] });
  });

  // POST /api/moderation/federations
  app.post('/api/moderation/federations', (req, res) => {
    const store = loadModerationStore();
    const { id, name, banned_users } = req.body || {};
    if (!id || !name) {
      return res.status(400).json({ success: false, error: 'Missing federation id or name' });
    }

    if (!store.federations) store.federations = [];
    const idx = store.federations.findIndex((f) => f.id === id);
    const fedObj = {
      id,
      name,
      banned_users: Array.isArray(banned_users) ? banned_users : [],
    };

    if (idx >= 0) {
      store.federations[idx] = fedObj;
    } else {
      store.federations.push(fedObj);
    }

    saveModerationStore(store);
    res.json({ success: true, data: store.federations });
  });
}
