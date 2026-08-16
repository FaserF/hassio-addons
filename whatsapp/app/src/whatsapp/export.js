import zlib from 'zlib';
import { getGroupModerationConfig } from './moderation/store.js';
import { ADDON_VERSION } from '../config.js';
import { logger } from '../logger.js';

/**
 * Generates a valid ZIP archive buffer in pure Node.js without external dependencies.
 * @param {Array<{ name: string, content: string | Buffer }>} files
 * @returns {Buffer}
 */
export function createZipBuffer(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const filenameBuf = Buffer.from(file.name, 'utf8');
    const dataBuf = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(String(file.content), 'utf8');

    const crc = zlib.crc32(dataBuf);
    const uncompressedSize = dataBuf.length;

    // Deflate compression
    const compressedData = zlib.deflateRawSync(dataBuf);
    const compressedSize = compressedData.length;

    const useDeflate = compressedSize < uncompressedSize;
    const finalData = useDeflate ? compressedData : dataBuf;
    const finalCompressedSize = useDeflate ? compressedSize : uncompressedSize;
    const compressionMethod = useDeflate ? 8 : 0;

    // Current DOS Date/Time (2026-08-16)
    const now = new Date();
    const dosTime =
      (now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2));
    const dosDate =
      ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    // Local file header (30 bytes + filename length)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // Flags (UTF-8)
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(finalCompressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(filenameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length

    const localChunk = Buffer.concat([localHeader, filenameBuf, finalData]);
    localHeaders.push(localChunk);

    // Central directory header (46 bytes + filename length)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(0x0800, 8); // Flags (UTF-8)
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(finalCompressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(filenameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // Extra field length
    centralHeader.writeUInt16LE(0, 32); // Comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number start
    centralHeader.writeUInt16LE(0, 36); // Internal file attributes
    centralHeader.writeUInt32LE(0, 38); // External file attributes
    centralHeader.writeUInt32LE(offset, 42); // Relative offset of local header

    const centralChunk = Buffer.concat([centralHeader, filenameBuf]);
    centralHeaders.push(centralChunk);

    offset += localChunk.length;
  }

  const localBuffer = Buffer.concat(localHeaders);
  const centralBuffer = Buffer.concat(centralHeaders);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Start disk
  eocd.writeUInt16LE(files.length, 8); // Total records on this disk
  eocd.writeUInt16LE(files.length, 10); // Total records
  eocd.writeUInt32LE(centralBuffer.length, 12); // Size of central directory
  eocd.writeUInt32LE(localBuffer.length, 16); // Offset of start of central directory
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([localBuffer, centralBuffer, eocd]);
}

/**
 * Calculates start timestamp in milliseconds based on timeframe parameter.
 * Default is 24 hours. Supports 'all', '24h', '1d', '7d', '30d', or custom hours/days.
 * @param {string} timeframe
 * @returns {number} cutoff timestamp in ms (0 for 'all')
 */
export function parseTimeframeCutoff(timeframe = '24h') {
  const tf = String(timeframe || '24h').trim().toLowerCase();
  if (tf === 'all') return 0;

  const now = Date.now();
  const matchHours = tf.match(/^(\d+)\s*h(?:ours?)?$/);
  if (matchHours) {
    const hours = parseInt(matchHours[1], 10);
    return now - hours * 60 * 60 * 1000;
  }

  const matchDays = tf.match(/^(\d+)\s*d(?:ays?)?$/);
  if (matchDays) {
    const days = parseInt(matchDays[1], 10);
    return now - days * 24 * 60 * 60 * 1000;
  }

  // Default: 24h
  return now - 24 * 60 * 60 * 1000;
}

/**
 * Collects and generates comprehensive export files for a group/chat.
 * @param {Object} session Baileys WhatsApp session
 * @param {string} groupId Group or Chat JID
 * @param {string} timeframe Timeframe e.g. '24h', '7d', 'all'
 * @param {string|Array<string>} componentTypes Subparameter specifying what to export ('all', 'history', 'stats', 'info', 'participants', 'security')
 * @returns {Promise<{ buffer: Buffer, filename: string, totalMessages: number, summary: Object }>}
 */
export async function generateChatExport(session, groupId, timeframe = '24h', componentTypes = 'all') {
  const cutoffMs = parseTimeframeCutoff(timeframe);
  const requestedTypes = Array.isArray(componentTypes)
    ? componentTypes.map((t) => t.toLowerCase())
    : String(componentTypes || 'all')
        .toLowerCase()
        .split(/[,;\s]+/)
        .filter(Boolean);

  const exportAll = requestedTypes.includes('all');
  const exportHistory = exportAll || requestedTypes.includes('history') || requestedTypes.includes('chat');
  const exportInfo = exportAll || requestedTypes.includes('info') || requestedTypes.includes('metadata');
  const exportSecurity = exportAll || requestedTypes.includes('security') || requestedTypes.includes('moderation');
  const exportStats = exportAll || requestedTypes.includes('stats') || requestedTypes.includes('statistics');
  const exportParticipants = exportAll || requestedTypes.includes('participants') || requestedTypes.includes('users');

  const files = [];
  const exportDate = new Date().toISOString();

  // 1. Group / Chat Metadata
  let groupMetadata = null;
  let groupSubject = groupId.split('@')[0];
  if (session?.sock?.groupMetadata && groupId.endsWith('@g.us')) {
    try {
      groupMetadata = await session.sock.groupMetadata(groupId);
      if (groupMetadata?.subject) {
        groupSubject = groupMetadata.subject;
      }
    } catch (e) {
      logger.debug({ error: e.message, groupId }, 'Could not fetch live group metadata for export');
    }
  }

  const groupInfoObj = {
    jid: groupId,
    name: groupSubject,
    is_group: groupId.endsWith('@g.us'),
    export_timestamp: exportDate,
    timeframe_filter: timeframe,
    group_owner: groupMetadata?.owner || null,
    creation_timestamp: groupMetadata?.creation ? new Date(groupMetadata.creation * 1000).toISOString() : null,
    description: groupMetadata?.desc || '',
    ephemeral_duration: groupMetadata?.ephemeralDuration || null,
    member_count: groupMetadata?.participants?.length || 0,
    settings: {
      restrict: Boolean(groupMetadata?.restrict),
      announce: Boolean(groupMetadata?.announce),
    },
  };

  if (exportInfo) {
    files.push({
      name: 'group_info.json',
      content: JSON.stringify(groupInfoObj, null, 2),
    });
  }

  // 2. Chat History (JSON & TXT)
  const storedMessages = [];
  if (session?.messageStore) {
    for (const msg of session.messageStore.values()) {
      if (!msg?.key) continue;
      const msgJid = msg.key.remoteJid;
      if (!msgJid || msgJid.toLowerCase() !== groupId.toLowerCase()) continue;

      let msgTs = 0;
      if (typeof msg.messageTimestamp === 'number') {
        msgTs = msg.messageTimestamp * 1000;
      } else if (msg.messageTimestamp && typeof msg.messageTimestamp.low === 'number') {
        msgTs = msg.messageTimestamp.low * 1000;
      } else if (msg.timestamp) {
        msgTs = Number(msg.timestamp);
      }

      if (cutoffMs > 0 && msgTs > 0 && msgTs < cutoffMs) {
        continue; // Exclude messages older than cutoff
      }

      const senderJid = msg.key.participant || (msg.key.fromMe ? (session.stats?.my_number || 'Bot') : msg.key.remoteJid);
      const pushName = msg.pushName || 'Unknown';
      const m = msg.message || {};

      let text =
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        m.audioMessage?.caption ||
        '';

      let mediaType = 'text';
      if (m.imageMessage) mediaType = 'image';
      else if (m.videoMessage) mediaType = 'video';
      else if (m.audioMessage) mediaType = 'audio';
      else if (m.documentMessage) mediaType = 'document';
      else if (m.stickerMessage) mediaType = 'sticker';
      else if (m.locationMessage) mediaType = 'location';
      else if (m.contactMessage || m.contactsArrayMessage) mediaType = 'contact';
      else if (m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3) mediaType = 'poll';

      storedMessages.push({
        id: msg.key.id,
        timestamp: msgTs > 0 ? new Date(msgTs).toISOString() : exportDate,
        sender_jid: senderJid,
        sender_name: pushName,
        is_from_me: Boolean(msg.key.fromMe),
        media_type: mediaType,
        text: text,
      });
    }
  }

  // Sort chronologically
  storedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (exportHistory) {
    files.push({
      name: 'chat_history.json',
      content: JSON.stringify(storedMessages, null, 2),
    });

    // Formatted readable TXT transcript
    const txtLines = [
      `================================================================================`,
      ` WhatsApp Chat History Export: ${groupSubject} (${groupId})`,
      ` Exported: ${exportDate} | Timeframe: ${timeframe} | Total Messages: ${storedMessages.length}`,
      `================================================================================\n`,
    ];

    for (const item of storedMessages) {
      const timeStr = item.timestamp ? item.timestamp.replace('T', ' ').replace(/\..+/, '') : '';
      const senderTag = item.is_from_me ? '🤖 [Bot]' : `${item.sender_name} (${item.sender_jid.split('@')[0]})`;
      const mediaTag = item.media_type !== 'text' ? `[${item.media_type.toUpperCase()}] ` : '';
      txtLines.push(`[${timeStr}] ${senderTag}: ${mediaTag}${item.text}`);
    }

    files.push({
      name: 'chat_history.txt',
      content: txtLines.join('\n'),
    });
  }

  // 3. Participants
  if (exportParticipants && groupMetadata?.participants) {
    const participantsList = groupMetadata.participants.map((p) => ({
      jid: p.id,
      phone: p.id.split('@')[0],
      role: p.admin === 'superadmin' ? 'Owner / Superadmin' : p.admin === 'admin' ? 'Admin' : 'Member',
      is_admin: Boolean(p.admin),
    }));
    files.push({
      name: 'participants.json',
      content: JSON.stringify(participantsList, null, 2),
    });
  }

  // 4. Security & Moderation Statistics
  const groupConfig = getGroupModerationConfig(groupId) || {};

  if (exportSecurity || exportStats) {
    const secStatsObj = {
      group_id: groupId,
      group_name: groupSubject,
      moderation_enabled: Boolean(groupConfig.enabled),
      rules: groupConfig.rules || [],
      locks: groupConfig.locks || {},
      anti_spam: groupConfig.anti_spam || {},
      anti_flood: groupConfig.anti_flood || {},
      captcha: groupConfig.captcha || {},
      translation: groupConfig.translation || {},
      warnings: groupConfig.warnings || {},
      warn_actions: groupConfig.warn_actions || [],
      filter_stats: groupConfig.stats || {},
      recent_violations_count: Object.values(groupConfig.warnings || {}).reduce((acc, val) => acc + (val || 0), 0),
    };

    files.push({
      name: 'security_statistics.json',
      content: JSON.stringify(secStatsObj, null, 2),
    });

    // CSV format for security analytics
    const csvRows = ['User JID,Phone Number,Warning Count,Status'];
    for (const [userJid, warnCount] of Object.entries(groupConfig.warnings || {})) {
      const cleanPhone = userJid.split('@')[0];
      const status = warnCount >= 3 ? 'Action Triggered / Restricted' : 'Warned';
      csvRows.push(`"${userJid}","${cleanPhone}",${warnCount},"${status}"`);
    }
    files.push({
      name: 'security_warnings.csv',
      content: csvRows.join('\n'),
    });
  }

  // 5. README & Manifest
  const manifestObj = {
    export_version: '1.0.0',
    gateway_version: ADDON_VERSION,
    generated_at: exportDate,
    chat_id: groupId,
    chat_name: groupSubject,
    timeframe: timeframe,
    total_messages_exported: storedMessages.length,
    included_files: files.map((f) => f.name),
  };

  files.push({
    name: 'export_manifest.json',
    content: JSON.stringify(manifestObj, null, 2),
  });

  files.push({
    name: 'README.txt',
    content: `WhatsApp Chat & Security Data Export Package
=====================================================
Target Chat: ${groupSubject} (${groupId})
Export Generated: ${exportDate}
Timeframe: ${timeframe} (Default: last 24h)
Addon Version: ${ADDON_VERSION}

Files Included:
- group_info.json: Full group metadata and parameters.
- chat_history.json: Machine-readable message log with timestamps.
- chat_history.txt: Formatted human-readable transcript.
- participants.json: Group member roster and administrative roles.
- security_statistics.json: Configured moderation rules, locks, and anti-spam status.
- security_warnings.csv: Spreadsheet export of user warning records.
- export_manifest.json: Integrity manifest and summary.

For security and privacy, sensitive credentials and access tokens are strictly omitted.
`,
  });

  const zipBuffer = createZipBuffer(files);
  const safeName = groupSubject.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'chat';
  const filename = `whatsapp_export_${safeName}_${timeframe}_${Date.now()}.zip`;

  return {
    buffer: zipBuffer,
    filename,
    totalMessages: storedMessages.length,
    summary: manifestObj,
  };
}
