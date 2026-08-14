const PLATFORM_DOMAINS = {
  whatsapp: ['chat\\.whatsapp\\.com', 'wa\\.me', 'wa\\.link', 'whatsapp\\.com\\/channel'],
  telegram: ['t\\.me', 'telegram\\.me', 'telegram\\.dog'],
  signal: ['signal\\.group', 'signal\\.me'],
  instagram: ['instagram\\.com\\/j', 'ig\\.me\\/j'],
  discord: ['discord\\.(gg|com\\/invite)'],
  other: [
    'line\\.me\\/ti\\/g',
    'viber\\.com\\/g',
    'snapchat\\.com\\/add',
    'matrix\\.to\\/#',
    'element\\.io',
  ],
};

// Centralized Regex definitions per Messenger platform for Invite Link Detection
export const SPAM_INVITE_LINK_PATTERNS = {
  whatsapp: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.whatsapp.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  telegram: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.telegram.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  signal: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.signal.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  instagram: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.instagram.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  discord: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.discord.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  other: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.other.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  all: new RegExp(
    `(https?:\\/\\/)?(${Object.values(PLATFORM_DOMAINS).flat().join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
};

export const userFloodMap = new Map(); // key: groupId:userId -> array of timestamps
export const groupJoinMap = new Map(); // key: groupId -> array of timestamps
