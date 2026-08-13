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
  syncWhatsAppToTelegram,
  syncWhatsAppGroupEventToTelegram,
  syncWhatsAppDeleteToTelegram,
  syncWhatsAppEditToTelegram,
  syncWhatsAppPinToTelegram,
  startTelegramPolling,
} from '../telegram/listener.js';

startTelegramPolling();
import {
  handleModerationMessage,
  handleModerationParticipantUpdate,
  isSelfParticipant,
} from '../moderation/engine.js';
import { handleWhatsAppVoiceSTT } from '../sttHandler.js';
import { processCommand } from '../moderation/commands.js';

export { bindStore } from './store.js';
export { getChangelogUrl, checkSystemUpdates, monitorHACore } from './system.js';

const MEDIA_DIR = process.env.MEDIA_FOLDER || path.join(process.cwd(), 'media');
const processedParticipantEvents = new Map();

export function unwrapProtocolNode(m) {
  if (!m) return null;
  if (m.protocolMessage) return m.protocolMessage;
  if (m.pinInChatMessage)
    return { type: 5, pinInChatMessage: m.pinInChatMessage, key: m.pinInChatMessage.key };
  if (m.editedMessage) {
    if (m.editedMessage.message?.protocolMessage) return m.editedMessage.message.protocolMessage;
    if (m.editedMessage.protocolMessage) return m.editedMessage.protocolMessage;
    return { type: 14, editedMessage: m.editedMessage, key: m.editedMessage.key };
  }
  if (m.ephemeralMessage?.message) return unwrapProtocolNode(m.ephemeralMessage.message);
  if (m.viewOnceMessage?.message) return unwrapProtocolNode(m.viewOnceMessage.message);
  if (m.viewOnceMessageV2?.message) return unwrapProtocolNode(m.viewOnceMessageV2.message);
  if (m.viewOnceMessageV2Extension?.message)
    return unwrapProtocolNode(m.viewOnceMessageV2Extension.message);
  return null;
}

export function extractEditedText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node.trim();
  const unwrap = (m) => {
    if (!m) return null;
    if (typeof m === 'string') return m;
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.editedMessage) return unwrap(m.editedMessage);
    if (m.protocolMessage?.editedMessage) return unwrap(m.protocolMessage.editedMessage);
    if (m.ephemeralMessage?.message) return unwrap(m.ephemeralMessage.message);
    if (m.viewOnceMessage?.message) return unwrap(m.viewOnceMessage.message);
    if (m.viewOnceMessageV2?.message) return unwrap(m.viewOnceMessageV2.message);
    if (m.viewOnceMessageV2Extension?.message) return unwrap(m.viewOnceMessageV2Extension.message);
    if (m.documentWithCaptionMessage?.message) return unwrap(m.documentWithCaptionMessage.message);
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.documentMessage?.caption) return m.documentMessage.caption;
    if (m.audioMessage?.caption) return m.audioMessage.caption;
    if (m.message) return unwrap(m.message);
    return null;
  };
  const res = unwrap(node);
  return typeof res === 'string' ? res.trim() : '';
}

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
          const departureAction =
            update.action === 'remove' || update.action === 'leave' ? 'departure' : update.action;
          const updateWindowKey = `part_upd:${update.id}:${departureAction}:${normalizedParticipants.sort().join(',')}`;
          const now = Date.now();
          const existing = processedParticipantEvents.get(updateWindowKey);
          if (existing && now - existing.ts < 15000) {
            // Special case: If existing event was generic 'remove' and new event is explicit 'leave', allow 'leave' to override!
            if (existing.action === 'remove' && update.action === 'leave') {
              logger.info(
                { groupId: update.id },
                '🔄 Explicit voluntary leave event received after generic remove — upgrading action'
              );
            } else {
              logger.debug(
                { groupId: update.id, action: update.action },
                '⏩ Skipping duplicate participant update from ev event'
              );
              return;
            }
          }
          processedParticipantEvents.set(updateWindowKey, { ts: now, action: update.action });
        }

        if (update?.id && session?.sock?.groupMetadata) {
          try {
            // Evict Baileys group metadata cache so fresh admin rights take effect immediately
            if (typeof session.sock.groupMetadata.delete === 'function') {
              session.sock.groupMetadata.delete(update.id);
            }
          } catch (_e) {}
        }

        const resolvedGroupName = session.groupCache?.get(update.id) || update.id;
        syncWhatsAppGroupEventToTelegram(
          update.id,
          resolvedGroupName,
          update.action,
          normalizedParticipants
        );

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

import { handleOptOutCommand } from '../../rbac.js';

export function handleIncomingMessages(session) {
  session.sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || m.messages.length === 0) return;
    session.stats.received += m.messages.length;

    // Check for anti-spam opt-out command (/stoplogin, !stoplogin, /optout)
    for (const msg of m.messages) {
      if (!msg.key?.fromMe && msg.message) {
        const text = extractEditedText(msg.message).trim().toLowerCase();
        if (
          text === '/stoplogin' ||
          text === '!stoplogin' ||
          text === '/blocklogin' ||
          text === '/optout'
        ) {
          const senderJid = msg.key.participant || msg.key.remoteJid;
          const optedOut = handleOptOutCommand(senderJid);
          if (optedOut && session.sock) {
            try {
              await reply(
                session,
                msg,
                '🚫 Du wurdest erfolgreich von weiteren Login-Benachrichtigungen des WhatsApp Gateways gesperrt.'
              );
            } catch (_e) {}
          }
        }
      }
    }

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
          st === 140 ||
          st === 141 ||
          st === 151 ||
          st === 161 ||
          st === 166 ||
          st === 168 ||
          st === 189 ||
          stNum === 27 ||
          stNum === 31 ||
          stNum === 71 ||
          stNum === 140 ||
          stNum === 141 ||
          stNum === 151 ||
          stNum === 161 ||
          stNum === 166 ||
          stNum === 168 ||
          stNum === 189 ||
          (stStr.includes('ADD') && !stStr.includes('DEMOTE')) ||
          stStr.includes('JOIN')
        ) {
          action = 'add';
        } else if (st === 32 || stNum === 32 || stStr.includes('LEAVE')) {
          action = 'leave';
        } else if (
          st === 28 ||
          st === 33 ||
          stNum === 28 ||
          stNum === 33 ||
          (stStr.includes('REMOVE') && !stStr.includes('DEMOTE'))
        ) {
          action = 'remove';
        } else if (
          st === 29 ||
          st === 30 ||
          st === 147 ||
          st === 148 ||
          stNum === 29 ||
          stNum === 30 ||
          stNum === 147 ||
          stNum === 148 ||
          stStr.includes('PROMOTE') ||
          stStr.includes('DEMOTE')
        ) {
          action =
            st === 30 || stNum === 30 || st === 148 || stNum === 148 || stStr.includes('DEMOTE')
              ? 'demote'
              : 'promote';
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
          const departureAction = action === 'remove' || action === 'leave' ? 'departure' : action;
          const updateWindowKey = `part_upd:${groupId}:${departureAction}:${normalizedParticipants.sort().join(',')}`;
          const now = Date.now();
          const existing = processedParticipantEvents.get(updateWindowKey);
          if (existing && now - existing.ts < 15000) {
            // Special case: If existing event was generic 'remove' and new event is explicit 'leave', allow 'leave' to override!
            if (existing.action === 'remove' && action === 'leave') {
              logger.info(
                { groupId },
                '🔄 Explicit voluntary leave event received after generic remove — upgrading action'
              );
            } else {
              logger.debug(
                { groupId, action },
                '⏩ Skipping duplicate participant update from messageStubType'
              );
              continue;
            }
          }
          processedParticipantEvents.set(updateWindowKey, { ts: now, action });
          // Cleanup old keys
          if (processedParticipantEvents.size > 100) {
            for (const [k, obj] of processedParticipantEvents.entries()) {
              if (now - (obj?.ts || 0) > 30000) processedParticipantEvents.delete(k);
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
          if (groupId && session?.sock?.groupMetadata) {
            try {
              if (typeof session.sock.groupMetadata.delete === 'function') {
                session.sock.groupMetadata.delete(groupId);
              }
            } catch (_e) {}
          }

          const resolvedGroupName = session.groupCache?.get(groupId) || groupId;
          syncWhatsAppGroupEventToTelegram(
            groupId,
            resolvedGroupName,
            action,
            normalizedParticipants
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

      // Check for incoming REVOKE / message deletion protocol nodes
      const protNode = unwrapProtocolNode(msg.message);
      if (
        protNode &&
        (protNode.type === 0 || protNode.type === 'REVOKE' || String(protNode.type) === '0')
      ) {
        const deletedId = protNode.key?.id;
        const targetJid = protNode.key?.remoteJid || msg.key?.remoteJid;
        if (deletedId && targetJid) {
          logger.info(
            { deletedId, targetJid },
            '🗑️ Detected WhatsApp message deletion (protocolMessage REVOKE)'
          );
          syncWhatsAppDeleteToTelegram(deletedId, targetJid);
        }
      } else if (
        protNode &&
        (protNode.type === 14 || protNode.type === 'MESSAGE_EDIT' || String(protNode.type) === '14')
      ) {
        const editedWaMsgId = protNode.key?.id;
        const targetJid = protNode.key?.remoteJid || msg.key?.remoteJid;
        const newText = extractEditedText(protNode.editedMessage || msg.message);
        if (editedWaMsgId && targetJid && newText) {
          logger.info(
            { editedWaMsgId, targetJid },
            '✏️ Detected WhatsApp message edit (protocolMessage MESSAGE_EDIT)'
          );
          const isGroup = targetJid.endsWith('@g.us');
          const groupName = isGroup ? session.groupCache?.get(targetJid) || targetJid : '';
          const senderName = msg.pushName || session.contactCache?.get(targetJid)?.name || '';
          syncWhatsAppEditToTelegram(editedWaMsgId, targetJid, newText, groupName, senderName);
        }
      } else if (
        protNode &&
        (protNode.type === 5 ||
          protNode.type === 'PIN_IN_CHAT' ||
          String(protNode.type) === '5' ||
          protNode.pinInChatMessage)
      ) {
        const pinObj = protNode.pinInChatMessage || protNode;
        const pinnedWaMsgId = pinObj.key?.id || protNode.key?.id;
        const targetJid = pinObj.key?.remoteJid || protNode.key?.remoteJid || msg.key?.remoteJid;
        const pinType = pinObj.type !== undefined ? pinObj.type : 1;
        if (pinnedWaMsgId && targetJid) {
          const isPinned = pinType === 1;
          logger.info(
            { pinnedWaMsgId, targetJid, isPinned },
            '📌 Detected WhatsApp message pin update (protocolMessage PIN_IN_CHAT)'
          );
          syncWhatsAppPinToTelegram(pinnedWaMsgId, targetJid, isPinned);
        }
      }
    }

    const events = m.messages
      .filter((msg) => {
        if (msg.key.remoteJid === 'status@broadcast') return false;
        if (msg.messageStubType) return false; // Skip system notifications (member join/leave/promotions) from moderation processing
        if (
          unwrapProtocolNode(msg.message) ||
          msg.message?.protocolMessage ||
          msg.message?.editedMessage ||
          msg.message?.pinInChatMessage
        )
          return false; // Skip protocol control nodes (edits, deletes, pins) from raw text forwarding
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
        // matchedText is the canonical URL WhatsApp resolves for link-preview messages.
        // When a user sends a bare link, .text equals the typed URL but matchedText holds
        // the fully-resolved/canonical form. We include it in the searchable text so that
        // anti-spam and blacklist checks always see the actual URL regardless of format.
        // Unwrap message wrappers (e.g. ephemeralMessage, viewOnceMessage, viewOnceMessageV2)
        const unwrapMessage = (m) => {
          if (!m) return {};
          if (m.ephemeralMessage?.message) return unwrapMessage(m.ephemeralMessage.message);
          if (m.viewOnceMessage?.message) return unwrapMessage(m.viewOnceMessage.message);
          if (m.viewOnceMessageV2?.message) return unwrapMessage(m.viewOnceMessageV2.message);
          if (m.viewOnceMessageV2Extension?.message)
            return unwrapMessage(m.viewOnceMessageV2Extension.message);
          if (m.documentWithCaptionMessage?.message)
            return unwrapMessage(m.documentWithCaptionMessage.message);
          return m;
        };
        const realMsgObj = unwrapMessage(msg.message);

        const extMsg = realMsgObj?.extendedTextMessage;
        const matchedText = extMsg?.matchedText || '';
        let text =
          realMsgObj?.conversation ||
          extMsg?.text ||
          matchedText ||
          realMsgObj?.buttonsResponseMessage?.selectedDisplayText ||
          realMsgObj?.templateButtonReplyMessage?.selectedId ||
          realMsgObj?.imageMessage?.caption ||
          realMsgObj?.videoMessage?.caption ||
          realMsgObj?.documentMessage?.caption ||
          realMsgObj?.audioMessage?.caption ||
          '';
        // Fallback: If primary text extraction is empty or doesn't contain a link/domain,
        // perform a deep recursive property search on the entire message node to extract any string content / URL.
        // DO NOT perform fallback extraction on reactionMessage nodes!
        if (
          !text &&
          !realMsgObj?.reactionMessage &&
          !/(https?:\/\/|t\.me\/|wa\.me\/|chat\.whatsapp\.com\/)/i.test(text || '')
        ) {
          const extractStrings = (obj, depth = 0) => {
            if (!obj || depth > 5) return [];
            let found = [];
            if (typeof obj === 'string') {
              const trimmed = obj.trim();
              if (
                trimmed &&
                !/^[0-9A-F]{16,32}$/i.test(trimmed) &&
                !/@(g\.us|s\.whatsapp\.net|lid)$/i.test(trimmed)
              ) {
                found.push(trimmed);
              }
            } else if (typeof obj === 'object') {
              for (const key of Object.keys(obj)) {
                // Skip keys that hold raw binary buffers, keys, or IDs
                if (
                  [
                    'mediaKey',
                    'fileSha256',
                    'fileEncSha256',
                    'directPath',
                    'url',
                    'clientUrl',
                    'deprecatedMms3Url',
                    'jpegThumbnail',
                    'streamingSidecar',
                    'encApiKey',
                    'vcard',
                    'vCard',
                    'degreesLatitude',
                    'degreesLongitude',
                    'accuracyInMeters',
                    'speedInMps',
                    'degreesClockwiseFromMagneticNorth',
                    'protocolMessage',
                    'editedMessage',
                    'key',
                    'id',
                    'remoteJid',
                    'participant',
                    'remoteJidAlt',
                    'participantAlt',
                  ].includes(key)
                )
                  continue;
                found = found.concat(extractStrings(obj[key], depth + 1));
              }
            }
            return found;
          };
          const allStrings = extractStrings(msg.message);
          const urlMatch = allStrings.find(
            (s) =>
              /(https?:\/\/|t\.me\/|wa\.me\/|chat\.whatsapp\.com\/)/i.test(s) &&
              !/(a\.whatsapp\.net|mmg\.whatsapp\.net)/i.test(s)
          );
          if (urlMatch && !text.includes(urlMatch)) {
            text = text ? `${text} ${urlMatch}` : urlMatch;
          } else if (!text && allStrings.length > 0) {
            text = allStrings.join(' ');
          }
        }
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
        const messageType = getContentType(realMsgObj);
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
          const pollObj =
            originalPoll?.message?.pollCreationMessage ||
            originalPoll?.message?.pollCreationMessageV2 ||
            originalPoll?.message?.pollCreationMessageV3;
          const originalPollName = pollObj?.name || '';
          const pollResult = await resolvePollVotes(msg, originalPoll, session);
          vote = pollResult.vote;
          const qTitle = originalPollName ? `: ${originalPollName}` : '';
          if (pollResult.error) {
            text = `📊 [Poll Vote Update${qTitle}]\n🗳️ Vote: (${pollResult.error})`;
          } else if (vote.length > 0) {
            text = `📊 [Poll Vote Update${qTitle}]\n🗳️ Vote: ${vote.join(', ')}`;
          } else {
            text = `📊 [Poll Vote Update${qTitle}]\n🗳️ Vote: Retracted (No options selected)`;
          }
        } else if (messageType === 'eventMessage') {
          eventType = 'event';
          const evData = msg.message.eventMessage;
          const evName = evData?.name || 'Untitled Event';
          const evDesc = evData?.description || '';
          const evStart = evData?.startTime
            ? new Date(Number(evData.startTime) * 1000).toLocaleString('de-DE', {
                dateStyle: 'full',
                timeStyle: 'short',
                timeZone: 'Europe/Berlin',
              })
            : null;
          const evLoc = evData?.location?.name || '';
          const evLink = evData?.joinLink || '';
          const evCanceled = evData?.isCanceled ? ' ❌ ABGESAGT' : '';
          const lines = [`📅 *[Event${evCanceled}]: ${evName}*`];
          if (evStart) lines.push(`🕐 ${evStart}`);
          if (evDesc) lines.push(`📝 ${evDesc}`);
          if (evLoc) lines.push(`📍 ${evLoc}`);
          if (evLink) lines.push(`🔗 ${evLink}`);
          text = lines.join('\n');
        } else if (messageType === 'contactMessage' || messageType === 'contactsArrayMessage') {
          mediaType = 'contact';
          const contactObj = msg.message?.contactMessage || msg.message?.contactsArrayMessage;
          const displayName =
            contactObj?.displayName ||
            (contactObj?.vcard ? contactObj.vcard.match(/FN:(.*)/)?.[1]?.trim() : null) ||
            'Contact Card';
          const phoneMatch = contactObj?.vcard
            ? contactObj.vcard.match(/TEL.*:(.*)/)?.[1]?.trim()
            : '';
          const phoneInfo = phoneMatch ? ` (${phoneMatch})` : '';
          text = `👤 [Contact: ${displayName}${phoneInfo}]`;
        } else if (messageType === 'locationMessage' || messageType === 'liveLocationMessage') {
          mediaType = 'location';
          const locObj = msg.message?.locationMessage || msg.message?.liveLocationMessage;
          const locName = locObj?.name || locObj?.address || '';
          const locDetails = locName ? `: ${locName}` : '';
          text = `📍 [Location Share${locDetails}]`;
        } else if (messageType && messageType.startsWith('pollCreation')) {
          mediaType = 'poll';
          eventType = 'poll';
          const pollObj =
            msg.message?.pollCreationMessage ||
            msg.message?.pollCreationMessageV2 ||
            msg.message?.pollCreationMessageV3;
          const question = pollObj?.name || 'Untitled';
          const options = pollObj?.options?.map((o) => o.optionName).filter(Boolean) || [];
          const optStr =
            options.length > 0
              ? `\nOptions:\n${options.map((o, i) => `  ${i + 1}️⃣ ${o}`).join('\n')}`
              : '';
          text = `📊 [Poll: ${question}]${optStr}`;
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
            mediaType = messageType
              .replace('Message', '')
              .replace('documentWithCaption', 'document')
              .replace('ptv', 'video');

            const friendlyLabelMap = {
              sticker: '🎨 [Sticker]',
              image: '📷 [Image]',
              video: '🎥 [GIF/Video]',
              audio: '🎵 [Audio]',
              document: '📄 [Document]',
            };
            const friendlyLabel = friendlyLabelMap[mediaType] || `[${mediaType}]`;
            text = caption ? caption : friendlyLabel;
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
          // Self-sent message: track as sent
          trackSent(session, senderDisplay, displayText);
          // If message is in a 1:1 self/admin chat, also track as received so it appears in Inbound Queue and HA received sensor
          const isToAdminPrimary = isAdmin(msg.key.remoteJid, session);
          const isToAdminAlt = msg.key.remoteJidAlt
            ? isAdmin(msg.key.remoteJidAlt, session)
            : false;
          const is1on1Chat = !msg.key.remoteJid.endsWith('@g.us');
          if (isToAdminPrimary || isToAdminAlt || is1on1Chat) {
            trackReceived(session, senderDisplay, displayText);
          }
        } else {
          trackReceived(session, senderDisplay, displayText);
        }

        const senderCandidates = [
          msg.key?.participant,
          msg.key?.participantAlt,
          msg.participant,
          msg.key?.remoteJidAlt,
          msg.verifiedBizName,
          // In group chats where msg.key.participant might be absent in non-standard protocol nodes,
          // check if remoteJid is a user JID or extract any JID string from msg.key
          !msg.key?.remoteJid?.endsWith('@g.us') ? msg.key?.remoteJid : null,
        ].filter(
          (c) => typeof c === 'string' && (c.endsWith('@s.whatsapp.net') || c.endsWith('@lid'))
        );

        let effectiveSenderJid = senderCandidates[0] || '';
        if (!effectiveSenderJid) {
          if (msg.key.fromMe) {
            const selfPn = session.stats.my_number || session.sock?.user?.id?.split(':')[0];
            if (selfPn) effectiveSenderJid = `${selfPn}@s.whatsapp.net`;
          } else if (msg.key?.remoteJidAlt && typeof msg.key.remoteJidAlt === 'string') {
            effectiveSenderJid = msg.key.remoteJidAlt;
          }
        }
        if (effectiveSenderJid && !senderCandidates.includes(effectiveSenderJid)) {
          senderCandidates.push(effectiveSenderJid);
        }
        let effectiveSenderNumber = effectiveSenderJid
          ? effectiveSenderJid.split('@')[0].replace(/\D/g, '')
          : '';
        if (
          (!effectiveSenderNumber || effectiveSenderJid.endsWith('@lid')) &&
          session.contactCache
        ) {
          for (const cand of senderCandidates) {
            for (const c of session.contactCache.values()) {
              const cLid = c.lid ? normalizeJid(c.lid) : '';
              const cId = c.id ? normalizeJid(c.id) : '';
              if (cLid === normalizeJid(cand) || cId === normalizeJid(cand)) {
                const pnDigits = (cId || cLid).split('@')[0].replace(/\D/g, '');
                if (pnDigits) {
                  effectiveSenderNumber = pnDigits;
                  break;
                }
              }
            }
            if (effectiveSenderNumber && !effectiveSenderNumber.startsWith('1576')) break;
          }
        }
        if (!effectiveSenderNumber) {
          for (const cand of senderCandidates) {
            const d = String(cand).split('@')[0].replace(/\D/g, '');
            if (d) {
              effectiveSenderNumber = d;
              break;
            }
          }
        }

        const senderName = msg.pushName || session.contactCache.get(senderJid)?.name || '';

        const personJid = effectiveSenderJid;
        let isGroupAdmin = false;

        // In group chats, check if user is a real WhatsApp Group Admin via groupMetadata
        if (isGroup && session?.sock?.groupMetadata) {
          try {
            const meta = await session.sock.groupMetadata(senderJid);
            const candidateDigitsList = senderCandidates
              .map((c) => c.split('@')[0].replace(/\D/g, ''))
              .filter(Boolean);

            // Also check contactCache for LID <-> PN resolution
            if (session.contactCache) {
              for (const candJid of senderCandidates) {
                for (const c of session.contactCache.values()) {
                  const cLid = c.lid ? normalizeJid(c.lid) : '';
                  const cId = c.id ? normalizeJid(c.id) : '';
                  if (cLid === normalizeJid(candJid) || cId === normalizeJid(candJid)) {
                    const pnDigits = (cId || cLid).split('@')[0].replace(/\D/g, '');
                    if (pnDigits && !candidateDigitsList.includes(pnDigits)) {
                      candidateDigitsList.push(pnDigits);
                    }
                  }
                }
              }
            }

            const part = meta?.participants?.find((p) => {
              const pId = p.id ? normalizeJid(p.id) : '';
              const pDigits = pId.split('@')[0].replace(/\D/g, '');
              if (!pDigits) return false;
              if (senderCandidates.some((candJid) => pId === normalizeJid(candJid))) return true;
              return candidateDigitsList.some((cd) => {
                if (!cd) return false;
                if (cd === pDigits) return true;
                if (cd.length >= 7 && pDigits.length >= 7) {
                  return cd.endsWith(pDigits) || pDigits.endsWith(cd);
                }
                return false;
              });
            });
            if (part && (part.admin === 'admin' || part.admin === 'superadmin')) {
              isGroupAdmin = true;
            }
            logger.info(
              { senderJid, matchedPartId: part?.id, partAdminRole: part?.admin, isGroupAdmin },
              '🔍 Group admin lookup resolved'
            );
          } catch (metaErr) {
            logger.warn(
              { groupId: senderJid, error: metaErr?.message },
              '⚠️ Could not fetch groupMetadata to determine admin status'
            );
          }
        }

        const isAdminUser = Boolean(
          msg.key.fromMe || (isGroup ? isGroupAdmin : isAdmin(personJid, session))
        );

        const event = {
          id: msg.key.id,
          type: eventType,
          content: text,
          vote: vote,
          sender: isGroup ? personJid : senderJid,
          person_jid: personJid,
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
          is_admin: isAdminUser,
          is_group_admin: isGroupAdmin,
        };

        triggerWebhook(event);
        handleFirstContact(session, event);
        const resolvedGroupName = isGroup
          ? session.groupCache?.get(senderJid) ||
            session.chatCache?.get(senderJid)?.name ||
            senderJid
          : null;
        syncWhatsAppToTelegram(
          msg,
          senderJid,
          resolvedGroupName,
          senderName,
          text,
          mediaUrl,
          mediaPath,
          mediaType
        );

        logger.info(
          {
            senderJid,
            effectiveSenderNumber,
            isGroupAdmin,
            isAdminUser,
            textSnippet: text?.slice(0, 50),
          },
          '🛡️ Moderation evaluation for group message'
        );

        // 1. Process as command (requiring actual admin status for admin commands)
        let handledAsCommand = false;
        if (text) {
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
          if (messageType === 'audioMessage') {
            await handleWhatsAppVoiceSTT(session, senderJid, msg);
          }
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

  if (session.sock?.ev) {
    session.sock.ev.on('messages.delete', async (item) => {
      try {
        const keys = Array.isArray(item) ? item : item?.keys || (item?.key ? [item.key] : []);
        for (const key of keys) {
          if (key && key.id && key.remoteJid) {
            logger.info(
              { id: key.id, remoteJid: key.remoteJid },
              '🗑️ Received messages.delete event from Baileys'
            );
            syncWhatsAppDeleteToTelegram(key.id, key.remoteJid);
          }
        }
      } catch (err) {
        logger.debug({ error: err.message }, 'Error handling messages.delete event');
      }
    });

    session.sock.ev.on('messages.update', async (updates) => {
      try {
        for (const item of updates || []) {
          const update = item.update || {};
          const key = item.key || update.key;
          const prot = unwrapProtocolNode(update.message);
          if (prot && (prot.type === 0 || prot.type === 'REVOKE' || String(prot.type) === '0')) {
            const deletedId = prot.key?.id || key?.id;
            const targetJid = prot.key?.remoteJid || key?.remoteJid;
            if (deletedId && targetJid) {
              logger.info(
                { deletedId, targetJid },
                '🗑️ Received messages.update (REVOKE) event from Baileys'
              );
              syncWhatsAppDeleteToTelegram(deletedId, targetJid);
            }
          } else if (
            prot &&
            (prot.type === 14 || prot.type === 'MESSAGE_EDIT' || String(prot.type) === '14')
          ) {
            const editedWaMsgId = prot.key?.id || key?.id;
            const targetJid = prot.key?.remoteJid || key?.remoteJid;
            const newText = extractEditedText(prot.editedMessage || update.message);
            if (editedWaMsgId && targetJid && newText) {
              logger.info(
                { editedWaMsgId, targetJid },
                '✏️ Received messages.update (MESSAGE_EDIT) event from Baileys'
              );
              const isGroup = targetJid.endsWith('@g.us');
              const groupName = isGroup ? session.groupCache?.get(targetJid) || targetJid : '';
              const senderName = session.contactCache?.get(targetJid)?.name || '';
              syncWhatsAppEditToTelegram(editedWaMsgId, targetJid, newText, groupName, senderName);
            }
          } else if (
            prot &&
            (prot.type === 5 ||
              prot.type === 'PIN_IN_CHAT' ||
              String(prot.type) === '5' ||
              prot.pinInChatMessage)
          ) {
            const pinObj = prot.pinInChatMessage || prot;
            const pinnedWaMsgId = pinObj.key?.id || prot.key?.id || key?.id;
            const targetJid = pinObj.key?.remoteJid || prot.key?.remoteJid || key?.remoteJid;
            const pinType = pinObj.type !== undefined ? pinObj.type : 1;
            if (pinnedWaMsgId && targetJid) {
              const isPinned = pinType === 1;
              logger.info(
                { pinnedWaMsgId, targetJid, isPinned },
                '📌 Received messages.update (PIN_IN_CHAT) event from Baileys'
              );
              syncWhatsAppPinToTelegram(pinnedWaMsgId, targetJid, isPinned);
            }
          }
        }
      } catch (err) {
        logger.debug({ error: err.message }, 'Error handling messages.update event');
      }
    });
  }
}

export function getQuotedMessage(session, quotedMessageId) {
  if (!quotedMessageId) return undefined;
  const rawMsg = session.messageStore.get(quotedMessageId);
  if (rawMsg) return rawMsg;
  logger.warn({ quotedMessageId, sessionId: session.id }, 'Quoted message not found in store');
  return undefined;
}
