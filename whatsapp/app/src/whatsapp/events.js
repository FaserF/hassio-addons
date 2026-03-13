import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mime from 'mime-types';
import { logger } from '../logger.js';
import { ADDON_VERSION, INTEGRATION_VERSION } from '../config.js';
import { SYSTEM_STATE, saveSystemState } from '../state.js';
import { fetchHAVersions, fetchHALogs } from '../ha.js';
import { formatDuration, formatHATime } from '../utils/format.js';
import { maskData, isAdmin } from '../utils/security.js';
import { triggerWebhook } from '../webhook.js';
import {
  notifyAdmins,
  trackReceived,
  trackFailure,
  handleFirstContact,
  reply,
  runDiagnostic,
} from './actions.js';
import { addLog } from '../session.js';

const MEDIA_DIR = process.env.MEDIA_FOLDER || path.join(process.cwd(), 'media');

export function bindStore(session, ev) {
  ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.id) {
        session.messageStore.set(msg.key.id, msg);
      }
    }
  });
}

export async function checkSystemUpdates(session) {
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
    updateMessages.push(
      `📦 *WhatsApp App Updated*\n• *Version:* ${SYSTEM_STATE.last_addon_version} ➔ ${currentAddonVersion}`
    );
  }

  if (
    SYSTEM_STATE.last_integration_version !== 'Unknown' &&
    SYSTEM_STATE.last_integration_version !== currentIntegrationVersion
  ) {
    updateMessages.push(
      `🧩 *Integration Updated*\n• *Version:* ${SYSTEM_STATE.last_integration_version} ➔ ${currentIntegrationVersion}`
    );
  }

  if (SYSTEM_STATE.last_ha_online) {
    const downtime = Date.now() - SYSTEM_STATE.last_ha_online;
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

  if (updateMessages.length > 0) {
    const fullText =
      `🔔 *System Status Update*\n• *Time:* ${now}\n\n` + updateMessages.join('\n\n');
    await notifyAdmins(session, fullText);
  }

  SYSTEM_STATE.last_addon_version = currentAddonVersion;
  SYSTEM_STATE.last_integration_version = currentIntegrationVersion;
  SYSTEM_STATE.last_ha_version = currentHAVersion;
  SYSTEM_STATE.last_ha_safe_mode = haVersions.safe_mode;
  SYSTEM_STATE.last_ha_online = null;
  saveSystemState();
}

export async function monitorHACore(session) {
  setInterval(async () => {
    const haVersions = await fetchHAVersions(true);
    const isOnline = haVersions.core !== 'Unknown';

    if (!isOnline && !SYSTEM_STATE.last_ha_online) {
      SYSTEM_STATE.last_ha_online = Date.now();
      saveSystemState();
      logger.warn('⚠️ HA Core is unreachable. Admin notification pending restore.');

      notifyAdmins(
        session,
        `🔴 *Home Assistant Core Unreachable*\n\n• *Status:* Bot can no longer reach HA Core.\n• *Note:* Automations are temporarily offline.`
      ).catch(() => {});
    } else if (isOnline && SYSTEM_STATE.last_ha_online) {
      await checkSystemUpdates(session);
    }
  }, 30000);
}

export function handleIncomingMessages(session) {
  session.sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || m.messages.length === 0) return;
    session.stats.received += m.messages.length;

    const events = m.messages
      .filter((msg) => {
        if (msg.key.remoteJid === 'status@broadcast') return false;
        if (msg.key.fromMe) {
          const myJid = session.sock.user.id.replace(/:.*@/, '@');
          return msg.key.remoteJid === myJid;
        }
        return true;
      })
      .map(async (msg) => {
        let text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.buttonsResponseMessage?.selectedDisplayText ||
          msg.message?.templateButtonReplyMessage?.selectedId ||
          '';
        const remoteJidAlt = msg.key.remoteJidAlt;
        let senderJid = msg.key.remoteJid;

        if (
          senderJid.endsWith('@lid') &&
          remoteJidAlt &&
          remoteJidAlt.endsWith('@s.whatsapp.net')
        ) {
          senderJid = remoteJidAlt;
        }

        let senderNumber = senderJid.split('@')[0];
        const isGroup = senderJid.endsWith('@g.us');
        const messageType = Object.keys(msg.message || {})[0];
        let mediaUrl = null,
          mediaPath = null,
          mediaType = null,
          mimeType = null,
          caption = null;

        const supportedMediaTypes = [
          'imageMessage',
          'videoMessage',
          'audioMessage',
          'documentMessage',
          'stickerMessage',
        ];
        if (supportedMediaTypes.includes(messageType)) {
          try {
            const mediaContent = msg.message[messageType];
            caption = mediaContent.caption || '';
            text = text || caption || `[Media: ${messageType}]`;
            mediaType = messageType.replace('Message', '');
            mimeType = mediaContent.mimetype;

            const buffer = await downloadMediaMessage(
              msg,
              'buffer',
              {},
              { logger: logger.child({ module: `media-dl-${session.id}` }) }
            );
            if (buffer) {
              const ext = mime.extension(mimeType) || 'bin';
              const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
              const savePath = path.join(MEDIA_DIR, filename);
              fs.writeFileSync(savePath, buffer);
              mediaPath = savePath;
              mediaUrl = `/media/${filename}`;
            }
          } catch (err) {
            text = `${text} (Media Download Failed)`;
            trackFailure(session, senderNumber, `Media: ${messageType}`, err.message);
          }
        }

        trackReceived(session, senderNumber, text);
        session.stats.last_received_message = maskData(text);
        session.stats.last_received_sender = maskData(senderNumber);
        session.stats.last_received_time = Date.now();

        const participant = msg.key.participant || msg.participant;
        let effectiveSenderJid = senderJid;
        if (
          participant &&
          typeof participant === 'string' &&
          participant.includes('@s.whatsapp.net')
        ) {
          effectiveSenderJid = participant;
        }
        senderNumber = effectiveSenderJid.split('@')[0];

        const event = {
          content: text,
          sender: senderJid,
          sender_number: senderNumber,
          is_group: isGroup,
          media_url: mediaUrl,
          media_path: mediaPath,
          media_type: mediaType,
          media_mimetype: mimeType,
          caption: caption,
          raw: msg,
          session_id: session.id,
        };

        triggerWebhook(event);
        handleFirstContact(session, event);

        if (text && typeof text === 'string') {
          const body = text.trim().toLowerCase();
          if (body.startsWith('ha-app-')) {
            const personJid = msg.key.participant || senderJid;
            const isAdminUser = isAdmin(personJid, session);

            if (body === 'ha-app-ping') {
              await reply(session, senderJid, { text: 'Pong! 🏓' });
            } else if (body === 'ha-app-getid') {
              await reply(session, senderJid, { text: `Chat ID: \`${senderJid}\`` });
            } else if (isAdminUser && body === 'ha-app-diag') {
              await runDiagnostic(session, senderJid, addLog);
            } else if (isAdminUser && body === 'ha-app-status') {
              const now = Date.now();
              const requests = session.statusRateLimit.get(personJid) || [];
              const recentRequests = requests.filter((t) => now - t < 60000);
              if (recentRequests.length >= 3) {
                logger.warn(
                  { personJid: maskData(personJid), sessionId: session.id },
                  'Rate limit hit for status command'
                );
                return await reply(session, senderJid, {
                  text: '⏳ *Rate Limit:* Please wait a minute before requesting status again.',
                });
              }
              recentRequests.push(now);
              session.statusRateLimit.set(personJid, recentRequests);

              const haInfo = await fetchHAVersions();
              const statusText =
                `🤖 *WhatsApp Bridge Status*\n\n` +
                `• *Connected:* ${session.isConnected ? '✅' : '❌'}\n` +
                `• *Uptime:* ${formatDuration(Date.now() - session.stats.start_time)}\n` +
                `• *HA Core:* ${haInfo.core}\n` +
                `• *HA Safe Mode:* ${haInfo.safe_mode ? '⚠️ Yes' : 'No'}`;
              await reply(session, senderJid, { text: statusText });
            } else if (isAdminUser && body === 'ha-app-restart') {
              await reply(session, senderJid, {
                text: '🔄 *Restarting...*\nThe connection will be reset in 2 seconds.',
              });
              addLog(session, `Admin ${maskData(personJid)} requested restart`, 'warning');
              setTimeout(() => {
                session.sock.end(new Error('Admin requested restart'));
              }, 2000);
            } else if (isAdminUser && body === 'ha-app-logs') {
              const logs = session.connectionLogs.slice(0, 10);
              if (logs.length === 0) {
                await reply(session, senderJid, { text: '📜 *Logs:* No events recorded yet.' });
              } else {
                const logText = logs
                  .map((l) => `[${l.timestamp}] ${l.msg}`)
                  .reverse()
                  .join('\n');
                await reply(session, senderJid, {
                  text: `📜 *Recent Connection Events:*\n\n${logText}`,
                });
              }
            } else if (body.startsWith('ha-app-stats')) {
              const range = body.replace('ha-app-stats', '').trim() || 'all-time';
              const statsText =
                `📈 *Message Statistics (${range})*\n\n` +
                `• Sent: ${session.stats.sent}\n` +
                `• Received: ${session.stats.received}\n` +
                `• Failed: ${session.stats.failed}\n\n` +
                '_(Note: Hourly/Daily filtering is currently being calculated based on current session life)_';
              await reply(session, senderJid, { text: statsText });
            } else if (body === 'ha-app-help') {
              const helpText =
                `📖 *WhatsApp Bridge Help*\n\n` +
                `*General Commands:*\n` +
                `• \`ha-app-ping\`: Check if bot is alive\n` +
                `• \`ha-app-getid\`: Get current chat ID\n` +
                `• \`ha-app-status\`: Get system status\n` +
                `• \`ha-app-stats\`: Get message statistics\n\n` +
                (isAdminUser
                  ? `*Admin Commands:*\n• \`ha-app-diag\`: Run diagnostics\n• \`ha-app-restart\`: Restart connection\n• \`ha-app-logs\`: View recent logs\n`
                  : '');
              await reply(session, senderJid, { text: helpText });
            } else if (isAdminUser) {
              await reply(session, senderJid, {
                text: `❓ *Unknown Command: ${body}*\n\nSend \`ha-app-help\` to see a list of all available control commands.`,
              });
            } else if (!isAdminUser && !session.unauthorizedWarned.has(personJid)) {
              session.unauthorizedWarned.add(personJid);
              await reply(session, senderJid, {
                text: '⚠️ *Unauthorized:* Access to control commands is restricted to administrators.',
              });
            }
          }
        }
        return event;
      });

    const resolvedEvents = await Promise.all(events);
    session.eventQueue.push(...resolvedEvents);
  });
}

export function getQuotedMessage(session, quotedMessageId) {
  if (!quotedMessageId) return undefined;
  const rawMsg = session.messageStore.get(quotedMessageId);
  if (rawMsg) return rawMsg;
  logger.warn({ quotedMessageId, sessionId: session.id }, 'Quoted message not found in store');
  return undefined;
}
