import { downloadMediaMessage, getContentType } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mime from 'mime-types';
import { logger } from '../../logger.js';
import { ADDON_VERSION, INTEGRATION_VERSION, BAILEYS_VERSION } from '../../config.js';
import { fetchHAVersions } from '../../ha.js';
import { formatDuration } from '../../utils/format.js';
import { maskData, isAdmin, normalizeJid } from '../../utils/security.js';
import { triggerWebhook } from '../../webhook.js';
import {
  trackReceived,
  trackSent,
  trackFailure,
  handleFirstContact,
  reply,
  runDiagnostic,
} from '../actions.js';
import { addLog, sessions, getAuthDir } from '../../session.js';

import { resolvePollVotes } from './poll.js';
import { registerAckListener } from './ack.js';
import { registerReactionListener } from './reactions.js';
import { registerPresenceListener } from './presence.js';
import {
  handleModerationMessage,
  handleModerationParticipantUpdate,
  isSelfParticipant,
} from '../moderation/engine.js';
import { processCommand } from '../moderation/commands.js';

export { bindStore } from './store.js';
export { getChangelogUrl, checkSystemUpdates, monitorHACore } from './system.js';

const MEDIA_DIR = process.env.MEDIA_FOLDER || path.join(process.cwd(), 'media');
const processedParticipantEvents = new Map();

export function registerAllListeners(session) {
  registerAckListener(session);
  registerReactionListener(session);
  registerPresenceListener(session);

  if (session.sock?.ev) {
    session.sock.ev.on('group-participants.update', async (update) => {
      try {
        logger.info(
          { updateId: update?.id, action: update?.action, participants: update?.participants },
          '👥 Received group-participants.update event from Baileys'
        );
        const normalizedParticipants = (update?.participants || [])
          .map((p) => {
            let str =
              typeof p === 'object' && p !== null
                ? p.id || p.jid || p.user || p.phoneNumber || ''
                : String(p || '');
            if (typeof p === 'object' && p !== null && p.phoneNumber) {
              const cleanPn = String(p.phoneNumber).replace(/\D/g, '');
              if (cleanPn) return `${cleanPn}@s.whatsapp.net`;
            }
            if (str.startsWith('{') || str.includes('id')) {
              try {
                const parsed = JSON.parse(str);
                str = parsed.id || parsed.jid || parsed.user || str;
              } catch (e) {
                /* ignore */
              }
            }
            if (!str) return null;
            // Extract clean phone JID or LID if embedded in error/log text
            const jidMatch = str.match(/(\d{8,}@(s\.whatsapp\.net|lid))/i);
            if (jidMatch) return jidMatch[1].toLowerCase();
            const digits = str.split('@')[0].replace(/\D/g, '');
            if (!digits) return null;
            return `${digits}@s.whatsapp.net`;
          })
          .filter(Boolean);

        if (update?.id && update?.action && normalizedParticipants.length > 0) {
          const updateWindowKey = `part_upd:${update.id}:${update.action}:${normalizedParticipants.sort().join(',')}`;
          const now = Date.now();
          if (processedParticipantEvents.has(updateWindowKey) && now - processedParticipantEvents.get(updateWindowKey) < 15000) {
            logger.debug({ groupId: update.id, action: update.action }, '⏩ Skipping duplicate participant update from ev event');
            return;
          }
          processedParticipantEvents.set(updateWindowKey, now);
        }

        await handleModerationParticipantUpdate(session, {
          ...update,
          participants: normalizedParticipants,
        });
      } catch (err) {
        logger.error({ error: err.message }, 'Error in moderation participant update handler');
      }
    });
  }
}

export function handleIncomingMessages(session) {
  session.sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || m.messages.length === 0) return;
    session.stats.received += m.messages.length;

    // Check for group system stub messages (e.g. member add/remove/leave via message notification)
    for (const msg of m.messages) {
      if (msg.messageStubType && msg.key?.remoteJid?.endsWith('@g.us')) {
        const groupId = msg.key.remoteJid;
        logger.info(
          {
            groupId,
            stubType: msg.messageStubType,
            stubParams: msg.messageStubParameters,
            participant: msg.participant,
            keyParticipant: msg.key?.participant,
            keyParticipantAlt: msg.key?.participantAlt,
          },
          '📩 Received group messageStubType notification'
        );
        let rawParticipants = (msg.messageStubParameters || []).filter(Boolean);

        if (rawParticipants.length === 0) {
          const candidates = [
            msg.participant,
            msg.key?.participantAlt,
            msg.key?.remoteJidAlt,
            msg.key?.participant,
          ].filter(Boolean);

          // Exclude self bot ID if other candidates exist (so we identify the joining user, not the bot key)
          const nonSelfCandidates = candidates.filter((c) => !isSelfParticipant(c, session));
          rawParticipants = nonSelfCandidates;
        }

        const st = msg.messageStubType;
        const stNum = Number(st);
        const stStr = String(st).toUpperCase();

        let action = null;
        if (
          st === 27 ||
          st === 31 ||
          st === 71 ||
          st === 143 ||
          stNum === 27 ||
          stNum === 31 ||
          stNum === 71 ||
          stNum === 143 ||
          stStr.includes('ADD') ||
          stStr.includes('JOIN')
        ) {
          action = 'add';
        } else if (st === 32 || stNum === 32 || stStr.includes('LEAVE')) {
          action = 'leave';
        } else if (
          st === 28 ||
          st === 29 ||
          st === 33 ||
          st === 144 ||
          stNum === 28 ||
          stNum === 29 ||
          stNum === 33 ||
          stNum === 144 ||
          stStr.includes('REMOVE')
        ) {
          action = 'remove';
        }

        // Normalize participants array to ensure full clean JID strings (e.g. "49123456789@s.whatsapp.net")
        const normalizedParticipants = rawParticipants
          .map((p) => {
            let str =
              typeof p === 'object' && p !== null
                ? p.id || p.jid || p.user || p.phoneNumber || ''
                : String(p || '');
            if (typeof p === 'object' && p !== null && p.phoneNumber) {
              const cleanPn = String(p.phoneNumber).replace(/\D/g, '');
              if (cleanPn) return `${cleanPn}@s.whatsapp.net`;
            }
            if (str.startsWith('{') || str.includes('id')) {
              try {
                const parsed = JSON.parse(str);
                str = parsed.id || parsed.jid || parsed.user || str;
              } catch (e) {
                /* ignore */
              }
            }
            if (!str) return null;
            // Extract clean phone JID or LID if embedded in error/log text
            const jidMatch = str.match(/(\d{8,}@(s\.whatsapp\.net|lid))/i);
            if (jidMatch) return jidMatch[1].toLowerCase();
            const digits = str.split('@')[0].replace(/\D/g, '');
            if (!digits) return null;
            return `${digits}@s.whatsapp.net`;
          })
          .filter(Boolean);

        if (action && normalizedParticipants.length > 0) {
          // Deduplicate events to prevent double processing (since Baileys emits both group-participants.update and messageStubType for the same change)
          const updateWindowKey = `part_upd:${groupId}:${action}:${normalizedParticipants.sort().join(',')}`;
          const now = Date.now();
          if (processedParticipantEvents.has(updateWindowKey) && now - processedParticipantEvents.get(updateWindowKey) < 15000) {
            logger.debug({ groupId, action }, '⏩ Skipping duplicate participant update from messageStubType');
            continue;
          }
          processedParticipantEvents.set(updateWindowKey, now);
          // Cleanup old keys
          if (processedParticipantEvents.size > 100) {
            for (const [k, ts] of processedParticipantEvents.entries()) {
              if (now - ts > 30000) processedParticipantEvents.delete(k);
            }
          }

          logger.info(
            {
              groupId,
              action,
              stubType: msg.messageStubType,
              rawParticipants,
              normalizedParticipants,
            },
            '👥 Participant update detected via messageStubType'
          );
          handleModerationParticipantUpdate(session, {
            id: groupId,
            action,
            participants: normalizedParticipants,
          }).catch((err) => {
            logger.error({ error: err.message }, 'Error handling stubType participant update');
          });
        } else {
          logger.debug(
            {
              groupId,
              stubType: msg.messageStubType,
              stubParams: msg.messageStubParameters,
            },
            'ℹ️ Group messageStubType received (not mapped to add/remove action)'
          );
        }
      }
    }

    const events = m.messages
      .filter((msg) => {
        if (msg.key.remoteJid === 'status@broadcast') return false;
        if (msg.key.fromMe) {
          // Allow outgoing messages if they are to an admin (usually to self) OR in a group
          const isToAdminPrimary = isAdmin(msg.key.remoteJid, session);
          const isToAdminAlt = msg.key.remoteJidAlt
            ? isAdmin(msg.key.remoteJidAlt, session)
            : false;
          const isToAdmin = isToAdminPrimary || isToAdminAlt;
          const isGroup = msg.key.remoteJid.endsWith('@g.us');

          if (!isToAdmin && !isGroup) {
            logger.info(
              `🔍 Outgoing message filtered. session.user.id: ${session.sock?.user?.id}, remoteJid: ${msg.key.remoteJid}, remoteJidAlt: ${msg.key.remoteJidAlt || 'N/A'}`
            );
          }
          return isToAdmin || isGroup;
        }
        return true;
      })
      .map(async (msg) => {
        let text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.buttonsResponseMessage?.selectedDisplayText ||
          msg.message?.templateButtonReplyMessage?.selectedId ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          msg.message?.documentMessage?.caption ||
          msg.message?.audioMessage?.caption ||
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

        const isGroup = senderJid.endsWith('@g.us');
        const messageType = getContentType(msg.message);
        let mediaUrl = null,
          mediaPath = null,
          mediaType = null,
          mimeType = null,
          caption = null,
          eventType = 'message',
          vote = [];

        if (messageType === 'pollUpdateMessage') {
          eventType = 'poll_update';
          const pollUpdateMsg = msg.message.pollUpdateMessage;
          const pollCreationId = pollUpdateMsg?.pollCreationMessageKey?.id;
          const originalPoll = pollCreationId ? session.messageStore.get(pollCreationId) : null;
          const pollResult = await resolvePollVotes(msg, originalPoll, session);
          vote = pollResult.vote;
          if (pollResult.error) {
            text = `[Poll Vote] (${pollResult.error})`;
          } else if (vote.length > 0) {
            text = `[Poll Vote] ${vote.join(', ')}`;
          } else {
            text = `[Poll Vote] (No options selected or vote retracted)`;
          }
        } else if (messageType === 'eventMessage') {
          eventType = 'event';
          const evData = msg.message.eventMessage;
          text = `[Event] ${evData?.name || 'Untitled'}${evData?.description ? `: ${evData.description}` : ''}`;
        } else if (messageType === 'contactMessage' || messageType === 'contactsArrayMessage') {
          mediaType = 'contact';
          const contactObj = msg.message?.contactMessage || msg.message?.contactsArrayMessage;
          const displayName =
            contactObj?.displayName || (contactObj?.vcard ? 'vCard Contact' : 'Contact Card');
          text = text || `[Contact: ${displayName}]`;
        } else if (messageType === 'locationMessage' || messageType === 'liveLocationMessage') {
          mediaType = 'location';
          text = text || '[Location Share]';
        } else if (messageType && messageType.startsWith('pollCreation')) {
          mediaType = 'poll';
          eventType = 'poll';
          text = text || '[Poll Creation]';
        }

        const innerMsgObj = msg.message?.[messageType];
        const isForwarded = Boolean(innerMsgObj?.contextInfo?.isForwarded);

        const supportedMediaTypes = [
          'imageMessage',
          'videoMessage',
          'ptvMessage',
          'audioMessage',
          'documentMessage',
          'documentWithCaptionMessage',
          'stickerMessage',
        ];
        if (supportedMediaTypes.includes(messageType)) {
          try {
            const mediaContent = msg.message[messageType];
            caption = mediaContent.caption || '';
            text = text || caption || `[Media: ${messageType}]`;
            mediaType = messageType
              .replace('Message', '')
              .replace('documentWithCaption', 'document')
              .replace('ptv', 'video');
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
              if (!fs.existsSync(MEDIA_DIR)) {
                fs.mkdirSync(MEDIA_DIR, { recursive: true });
              }
              fs.writeFileSync(savePath, buffer);
              mediaPath = savePath;
              mediaUrl = `/media/${filename}`;
              // Attach media metadata to the stored message so /api/messages can expose it
              msg._mediaUrl = mediaUrl;
              msg._mediaType = mediaType;
              msg._mediaMime = mimeType;
              msg._caption = caption;
            }
          } catch (err) {
            text = `${text} (Media Download Failed)`;
            trackFailure(session, senderJid.split('@')[0], `Media: ${messageType}`, err.message);
          }
        }

        const senderDisplay = senderJid.includes('@g.us') ? senderJid : senderJid.split('@')[0];
        const displayText = text || `[${messageType || 'Unknown'}]`;
        if (msg.key.fromMe) {
          // Self-sent message (e.g. admin sending to themselves): track only as sent
          trackSent(session, senderDisplay, displayText);
        } else {
          trackReceived(session, senderDisplay, displayText);
          session.stats.last_received_message = maskData(displayText);
          session.stats.last_received_sender = maskData(senderDisplay);
          session.stats.last_received_time = Date.now();
        }

        const participant = msg.key.participant || msg.participant;
        const participantAlt = msg.key.participantAlt;
        let effectiveSenderJid = senderJid;
        if (
          participantAlt &&
          typeof participantAlt === 'string' &&
          (participantAlt.endsWith('@s.whatsapp.net') || participantAlt.endsWith('@lid'))
        ) {
          effectiveSenderJid = participantAlt;
        } else if (
          participant &&
          typeof participant === 'string' &&
          (participant.endsWith('@s.whatsapp.net') || participant.endsWith('@lid'))
        ) {
          effectiveSenderJid = participant;
        } else if (msg.key.fromMe) {
          const selfPn = session.stats.my_number || session.sock?.user?.id?.split(':')[0];
          if (selfPn) effectiveSenderJid = `${selfPn}@s.whatsapp.net`;
        } else if (isGroup) {
          // Group message with no valid participant JID — sender unknown, skip to avoid
          // using the group JID as the sender_number which causes moderation false-positives
          logger.debug(
            { msgId: msg.key.id, groupId: senderJid },
            'Group message with no participant JID — sender_number will be empty'
          );
          effectiveSenderJid = '';
        }
        const effectiveSenderNumber = effectiveSenderJid ? effectiveSenderJid.split('@')[0] : '';

        const senderName = msg.pushName || session.contactCache.get(senderJid)?.name || '';

        const event = {
          id: msg.key.id,
          type: eventType,
          content: text,
          vote: vote,
          sender: senderJid,
          sender_name: senderName,
          from: senderJid,
          sender_number: effectiveSenderNumber,
          is_group: isGroup,
          is_forwarded: isForwarded,
          media_url: mediaUrl,
          media_path: mediaPath,
          media_type: mediaType,
          media_mimetype: mimeType,
          caption: caption,
          raw: msg,
          session_id: session.id,
        };

        const personJid = effectiveSenderJid;
        let isAdminUser = Boolean(msg.key.fromMe || isAdmin(personJid, session));

        // In group chats, also verify if user is a WhatsApp Group Admin via groupMetadata
        if (!isAdminUser && isGroup && session?.sock?.groupMetadata) {
          try {
            const meta = await session.sock.groupMetadata(senderJid);
            const targetDigits = (personJid || '').split('@')[0].replace(/\D/g, '');
            const part = meta?.participants?.find((p) => {
              const pId = p.id ? normalizeJid(p.id) : '';
              const pDigits = pId.split('@')[0].replace(/\D/g, '');
              return (
                (targetDigits && pDigits && targetDigits === pDigits) ||
                (personJid && pId === normalizeJid(personJid))
              );
            });
            if (part && (part.admin === 'admin' || part.admin === 'superadmin')) {
              isAdminUser = true;
            }
          } catch (_metaErr) {
            /* ignore metadata fetch failure */
          }
        }

        triggerWebhook(event);
        handleFirstContact(session, event);

        // 1. Process as group command
        let handledAsCommand = false;
        if (text && isGroup) {
          handledAsCommand = await processCommand(
            session,
            msg,
            text,
            personJid,
            isAdminUser,
            senderJid
          );
        }

        // 2. Process via Moderation Engine if not a handled command
        if (!handledAsCommand) {
          await handleModerationMessage(session, event);
        }

        if (text && typeof text === 'string') {
          const body = text
            .trim()
            .replace(/^['"`\s]+|['"`\s]+$/g, '')
            .toLowerCase();
          if (body.startsWith('ha-app-')) {
            if (body === 'ha-app-ping') {
              await reply(session, senderJid, { text: 'Pong! 🏓' });
            } else if (body === 'ha-app-getid') {
              await reply(session, senderJid, { text: `Chat ID: \`${senderJid}\`` });
            } else if (isAdminUser && (body === 'ha-app-diag' || body === 'ha-app-diagnose')) {
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
                `📊 *WhatsApp Integration Status*\n\n` +
                `• *HA App Version:* ${ADDON_VERSION} (https://github.com/FaserF/hassio-addons)\n` +
                `• *Integration Version:* ${INTEGRATION_VERSION} (https://github.com/FaserF/ha-whatsapp)\n` +
                `• *Baileys Version:* ${BAILEYS_VERSION}\n` +
                `• *HA Core:* ${haInfo.core}\n` +
                `• *HA OS:* ${haInfo.os || 'Unknown'}\n` +
                `• *HA Safe Mode:* ${haInfo.safe_mode ? '⚠️ Yes' : 'No'}\n` +
                `• *Uptime:* ${formatDuration(Date.now() - session.stats.start_time)}\n` +
                `• *Session:* ${session.id}\n` +
                `• *Connected:* ${session.isConnected ? '✅' : '❌'}\n\n` +
                `*Message Statistics:*\n` +
                `• *Sent:* ${session.stats.sent || 0}\n` +
                `• *Received:* ${session.stats.received || 0}\n` +
                `• *Failed:* ${session.stats.failed || 0}\n\n` +
                `📑 *Support:*\n` +
                `• *Docs:* https://faserf.github.io/ha-whatsapp/\n` +
                `• *Issues:* https://github.com/FaserF/ha-whatsapp/issues`;
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
            } else if (isAdminUser && (body === 'ha-app-errors' || body === 'ha-app-issues')) {
              const haInfo = await fetchHAVersions();
              const errors = [];
              const warnings = [];

              for (const [id, s] of sessions.entries()) {
                const authDir = getAuthDir(id);
                const hasCreds = fs.existsSync(path.join(authDir, 'creds.json'));
                if (!s.isConnected && (hasCreds || s.sock || s.reconnectAttempts > 0)) {
                  const reason =
                    s.stats?.last_disconnect_reason || s.disconnectReason || 'Disconnected';
                  errors.push(`• *Session ${id}:* Disconnected (${reason})`);
                }
                if (s.passkeyDetected && hasCreds) {
                  errors.push(`• *Session ${id}:* Passkey restriction detected on phone`);
                }
              }

              if (haInfo.core === 'Unknown') {
                errors.push('• *Home Assistant Core:* Unreachable / Offline');
              }
              if (haInfo.safe_mode) {
                warnings.push('• *Home Assistant Core:* Booted in SAFE MODE');
              }

              if (session.stats.failed > 0) {
                const lastReason = session.stats.last_error_reason
                  ? ` (${session.stats.last_error_reason})`
                  : '';
                warnings.push(
                  `• *Failed Messages:* ${session.stats.failed} send failure(s) recorded${lastReason}`
                );
              }

              const logErrors = (session.connectionLogs || [])
                .filter((l) => l.type === 'error' || l.type === 'warning')
                .slice(0, 3);

              if (errors.length === 0 && warnings.length === 0 && logErrors.length === 0) {
                await reply(session, senderJid, {
                  text: '🟢 *System Health: 100% OK*\n\nNo active errors or warnings detected across Addon and Integration.',
                });
              } else {
                let report = '🚨 *WhatsApp System Diagnostic & Error Report*\n\n';
                if (errors.length > 0) {
                  report += `🔴 *Errors (${errors.length}):*\n` + errors.join('\n') + '\n\n';
                }
                if (warnings.length > 0) {
                  report += `⚠️ *Warnings (${warnings.length}):*\n` + warnings.join('\n') + '\n\n';
                }
                if (logErrors.length > 0) {
                  report +=
                    `📜 *Recent Warning Logs:*\n` +
                    logErrors.map((l) => `• \`[${l.timestamp}]\` ${l.msg}`).join('\n') +
                    '\n\n';
                }
                report +=
                  '💡 *Tip:* Use `ha-app-restart` to attempt reconnection or `ha-app-logs` for details.';
                await reply(session, senderJid, { text: report });
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
                `*Group Management Commands:*\n` +
                `Enable commands in the Addon UI and use \`!help\` (or your configured prefix) in a group for moderation commands.\n\n` +
                (isAdminUser
                  ? `*Admin Commands:*\n• \`ha-app-errors\`: Show filtered errors & warnings\n• \`ha-app-diag\`: Run diagnostics\n• \`ha-app-restart\`: Restart connection\n• \`ha-app-logs\`: View recent logs\n`
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
