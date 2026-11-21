/**
 * Baileys Patch Script
 * Fixes:
 * 1. Untyped presence push notification bug (issue #1091)
 * 2. WhatsApp Channels (@newsletter) media uploads & smax-invalid 479 rejection (Baileys issue #2199, #2562, PR #2434):
 *    - Routes media to NEWSLETTER_MEDIA_PATH_MAP (/newsletter/newsletter-image, etc.)
 *    - Appends server_thumb_gen=1 for channel media
 *    - Returns thumbnailDirectPath / thumbnailSha256 from upload response
 *    - Sets url: null, fileEncSha256 = fileSha256 in newsletter media protobuf
 *    - Includes mediatype in plaintext node and extraAttrs in newsletter <message> stanzas
 * 3. Ack top-level <status> stanzas (fixes FaserF/ha-whatsapp#136, Baileys issue #2858)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BAILEYS_DIR = path.resolve(__dirname, '../node_modules/@whiskeysockets/baileys');

if (!fs.existsSync(BAILEYS_DIR)) {
  console.log('ℹ️ Baileys directory not found in node_modules, skipping patch.');
  process.exit(0);
}

let patchedCount = 0;

// 1. Patch Socket/socket.js: untyped presence bug
const socketFile = path.join(BAILEYS_DIR, 'lib/Socket/socket.js');
if (fs.existsSync(socketFile)) {
  let content = fs.readFileSync(socketFile, 'utf8');
  if (content.includes('if (creds.me?.name !== name) {')) {
    content = content.replace(
      'if (creds.me?.name !== name) {',
      'if (name && creds.me?.name !== name) {'
    );
    fs.writeFileSync(socketFile, content, 'utf8');
    console.log('✅ Patched Socket/socket.js (presence bug)');
    patchedCount++;
  }
}

// 2. Patch Defaults/index.js: export NEWSLETTER_MEDIA_PATH_MAP
const defaultsFile = path.join(BAILEYS_DIR, 'lib/Defaults/index.js');
if (fs.existsSync(defaultsFile)) {
  let content = fs.readFileSync(defaultsFile, 'utf8');
  if (!content.includes('NEWSLETTER_MEDIA_PATH_MAP')) {
    const mapCode = `
export const NEWSLETTER_MEDIA_PATH_MAP = {
    image: '/newsletter/newsletter-image',
    video: '/newsletter/newsletter-video',
    document: '/newsletter/newsletter-document',
    audio: '/newsletter/newsletter-audio',
    sticker: '/newsletter/newsletter-image',
    'thumbnail-link': '/newsletter/newsletter-thumbnail-link'
};
`;
    content = content.replace(
      'export const MEDIA_PATH_MAP = {',
      `${mapCode}\nexport const MEDIA_PATH_MAP = {`
    );
    fs.writeFileSync(defaultsFile, content, 'utf8');
    console.log('✅ Patched Defaults/index.js (NEWSLETTER_MEDIA_PATH_MAP)');
    patchedCount++;
  }
}

// 3. Patch Utils/messages.js: pass newsletter: true, url: null, fileEncSha256, thumbnails
const messagesFile = path.join(BAILEYS_DIR, 'lib/Utils/messages.js');
if (fs.existsSync(messagesFile)) {
  let content = fs.readFileSync(messagesFile, 'utf8');
  let changed = false;
  if (
    content.includes('timeoutMs: options.mediaUploadTimeoutMs') &&
    !content.includes('newsletter: true')
  ) {
    content = content.replace(
      'timeoutMs: options.mediaUploadTimeoutMs\n        });',
      'timeoutMs: options.mediaUploadTimeoutMs,\n            newsletter: true\n        });'
    );
    changed = true;
  }
  if (!content.includes('fileEncSha256: fileSha256,')) {
    // Unencrypted newsletter media requires url: null and fileEncSha256: fileSha256
    content = content.replace(
      /const \{ mediaUrl, directPath \} = await options\.upload\(filePath, \{\s*fileEncSha256B64: fileSha256B64,\s*mediaType: mediaType,\s*timeoutMs: options\.mediaUploadTimeoutMs,?\s*(newsletter: true)?\s*\}\);/,
      `const uploadResult = await options.upload(filePath, {
            fileEncSha256B64: fileSha256B64,
            mediaType: mediaType,
            timeoutMs: options.mediaUploadTimeoutMs,
            newsletter: true
        });
        const mediaUrl = uploadResult.mediaUrl;
        const directPath = uploadResult.directPath;
        const thumbnailDirectPath = uploadResult.thumbnailDirectPath;
        const thumbnailSha256 = uploadResult.thumbnailSha256;`
    );
    content = content.replace(
      `[\`\${mediaType}Message\`]: MessageTypeProto[mediaType].fromObject({
                url: mediaUrl,
                directPath,
                fileSha256,
                fileLength,
                ...uploadData,
                media: undefined
            })`,
      `[\`\${mediaType}Message\`]: MessageTypeProto[mediaType].fromObject({
                url: null,
                directPath,
                fileSha256,
                fileEncSha256: fileSha256,
                fileLength,
                ...(thumbnailDirectPath && { thumbnailDirectPath }),
                ...(thumbnailSha256 && { thumbnailSha256 }),
                ...uploadData,
                media: undefined
            })`
    );
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(messagesFile, content, 'utf8');
    console.log('✅ Patched Utils/messages.js (newsletter media protobuf & upload)');
    patchedCount++;
  }
}

// 4. Patch Utils/messages-media.js: use NEWSLETTER_MEDIA_PATH_MAP, server_thumb_gen, thumbnail info
const mediaFile = path.join(BAILEYS_DIR, 'lib/Utils/messages-media.js');
if (fs.existsSync(mediaFile)) {
  let content = fs.readFileSync(mediaFile, 'utf8');
  let changed = false;
  if (!content.includes('NEWSLETTER_MEDIA_PATH_MAP')) {
    content = content.replace(
      "import { DEFAULT_ORIGIN, MEDIA_HKDF_KEY_MAPPING, MEDIA_PATH_MAP } from '../Defaults/index.js';",
      "import { DEFAULT_ORIGIN, MEDIA_HKDF_KEY_MAPPING, MEDIA_PATH_MAP, NEWSLETTER_MEDIA_PATH_MAP } from '../Defaults/index.js';"
    );
    changed = true;
  }
  if (!content.includes('newsletter && NEWSLETTER_MEDIA_PATH_MAP')) {
    content = content.replace(
      'return async (filePath, { mediaType, fileEncSha256B64, timeoutMs }) => {',
      'return async (filePath, { mediaType, fileEncSha256B64, timeoutMs, newsletter }) => {'
    );
    content = content.replace(
      'const url = `https://${hostname}${MEDIA_PATH_MAP[mediaType]}/${fileEncSha256B64}?auth=${auth}&token=${fileEncSha256B64}`;',
      "const mediaPath = (newsletter && NEWSLETTER_MEDIA_PATH_MAP?.[mediaType]) ? NEWSLETTER_MEDIA_PATH_MAP[mediaType] : MEDIA_PATH_MAP[mediaType];\n            const extraQuery = (newsletter && (mediaType === 'image' || mediaType === 'video')) ? '&server_thumb_gen=1' : '';\n            const url = `https://${hostname}${mediaPath}/${fileEncSha256B64}?auth=${auth}&token=${fileEncSha256B64}${extraQuery}`;"
    );
    changed = true;
  }
  if (!content.includes('urls.thumbnailDirectPath = result.thumbnail_info')) {
    content = content.replace(
      'urls = {\n                        mediaUrl: result.url,\n                        directPath: result.direct_path,',
      'urls = {\n                        mediaUrl: result.url,\n                        directPath: result.direct_path,\n                        ...(result.thumbnail_info && {\n                            thumbnailDirectPath: result.thumbnail_info.thumbnail_direct_path,\n                            thumbnailSha256: result.thumbnail_info.thumbnail_sha256\n                        }),'
    );
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(mediaFile, content, 'utf8');
    console.log('✅ Patched Utils/messages-media.js (newsletter media endpoints & thumbnails)');
    patchedCount++;
  }
}

// 5. Patch Socket/messages-send.js: plaintext mediatype attr & newsletter extraAttrs
const sendFile = path.join(BAILEYS_DIR, 'lib/Socket/messages-send.js');
if (fs.existsSync(sendFile)) {
  let content = fs.readFileSync(sendFile, 'utf8');
  let changed = false;
  if (!content.includes('mediatype: mediaType')) {
    content = content.replace(
      "binaryNodeContent.push({\n                    tag: 'plaintext',\n                    attrs: {},\n                    content: bytes\n                });",
      "binaryNodeContent.push({\n                    tag: 'plaintext',\n                    attrs: mediaType ? { mediatype: mediaType } : {},\n                    content: bytes\n                });"
    );
    changed = true;
  }
  if (
    content.includes('sending newsletter message to ${jid}') &&
    !content.includes('/* newsletter-extraAttrs-patched */')
  ) {
    content = content.replace(
      /(logger\.debug\(\{ msgId \}, `sending newsletter message to \$\{jid\}`\);)/,
      '/* newsletter-extraAttrs-patched */\n                $1'
    );
    content = content.replace(
      /(type: getMessageType\(message\),\r?\n\s*\.\.\.\(additionalAttributes \|\| \{\}\))(\r?\n\s*\},)/,
      '$1,\n                        ...(extraAttrs || {})$2'
    );
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(sendFile, content, 'utf8');
    console.log('✅ Patched Socket/messages-send.js (newsletter plaintext mediatype & extraAttrs)');
    patchedCount++;
  }
}

// 6. Patch Socket/messages-recv.js: ack top-level <status> stanzas (fixes FaserF/ha-whatsapp#136, Baileys issue #2858)
const recvFile = path.join(BAILEYS_DIR, 'lib/Socket/messages-recv.js');
if (fs.existsSync(recvFile)) {
  let content = fs.readFileSync(recvFile, 'utf8');
  let changed = false;
  if (!content.includes('handleStatus')) {
    const handleStatusCode = `
    const handleStatus = async (node) => {
        try {
            if (isJidGroup(node.attrs.from) && getBinaryNodeChild(node, 'enc')) {
                await handleMessage(node);
            } else {
                await sendMessageAck(node);
            }
        }
        catch (error) {
            logger.error({ error, node: binaryNodeToString(node) }, 'error in handling status');
        }
    };
`;
    content = content.replace(
      /(const offlineNodeProcessor = makeOfflineNodeProcessor\(new Map\(\[)/,
      `${handleStatusCode}\n    $1`
    );
    content = content.replace(
      /(\['notification',\s*handleNotification\])/,
      "$1,\n        ['status', handleStatus]"
    );
    content = content.replace(
      /(ws\.on\('CB:notification',\s*async\s*\(node\)\s*=>\s*\{)/,
      "ws.on('CB:status', async (node) => {\n        await processNode('status', node, 'handling status', handleStatus);\n    });\n    $1"
    );
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(recvFile, content, 'utf8');
    console.log('✅ Patched Socket/messages-recv.js (ack top-level <status> stanzas)');
    patchedCount++;
  }
}

console.log(`🎉 Baileys patch check complete (${patchedCount} patched).`);
