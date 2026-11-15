/**
 * Baileys Patch Script
 * Fixes:
 * 1. Untyped presence push notification bug (issue #1091)
 * 2. WhatsApp Channels (@newsletter) media uploads & smax-invalid 479 rejection:
 *    - Routes media to NEWSLETTER_MEDIA_PATH_MAP (/newsletter/newsletter-image, etc.)
 *    - Appends server_thumb_gen=1 for channel media
 *    - Includes extraAttrs (mediatype) in newsletter <message> stanzas
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

// 3. Patch Utils/messages.js: pass newsletter: true to options.upload
const messagesFile = path.join(BAILEYS_DIR, 'lib/Utils/messages.js');
if (fs.existsSync(messagesFile)) {
  let content = fs.readFileSync(messagesFile, 'utf8');
  if (
    content.includes('timeoutMs: options.mediaUploadTimeoutMs') &&
    !content.includes('newsletter: true')
  ) {
    content = content.replace(
      'timeoutMs: options.mediaUploadTimeoutMs\n        });',
      'timeoutMs: options.mediaUploadTimeoutMs,\n            newsletter: true\n        });'
    );
    fs.writeFileSync(messagesFile, content, 'utf8');
    console.log('✅ Patched Utils/messages.js (newsletter upload flag)');
    patchedCount++;
  }
}

// 4. Patch Utils/messages-media.js: use NEWSLETTER_MEDIA_PATH_MAP and server_thumb_gen
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
  if (changed) {
    fs.writeFileSync(mediaFile, content, 'utf8');
    console.log('✅ Patched Utils/messages-media.js (newsletter media endpoints)');
    patchedCount++;
  }
}

// 5. Patch Socket/messages-send.js: spread extraAttrs in newsletter stanza
const sendFile = path.join(BAILEYS_DIR, 'lib/Socket/messages-send.js');
if (fs.existsSync(sendFile)) {
  let content = fs.readFileSync(sendFile, 'utf8');
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
    fs.writeFileSync(sendFile, content, 'utf8');
    console.log('✅ Patched Socket/messages-send.js (newsletter extraAttrs)');
    patchedCount++;
  }
}

console.log(`🎉 Baileys patch check complete (${patchedCount} patched).`);
