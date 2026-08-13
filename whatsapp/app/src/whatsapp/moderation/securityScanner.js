import { logger } from '../../logger.js';

const urlCache = new Map();

export async function performSecurityScan(rawMsg, secScanConfig = {}, vtApiKey = '') {
  const text =
    rawMsg.message?.conversation ||
    rawMsg.message?.extendedTextMessage?.text ||
    rawMsg.message?.imageMessage?.caption ||
    rawMsg.message?.videoMessage?.caption ||
    '';

  const engine = secScanConfig.engine || 'local';
  const results = { is_malicious: false, threats: [] };

  // 1. Scan URLs
  const urls = text.match(/https?:\/\/[^\s]+/gi) || [];
  for (const url of urls) {
    if (await scanUrl(url, engine, vtApiKey)) {
      results.is_malicious = true;
      results.threats.push({ type: 'url', value: url });
    }
  }

  // 2. Scan Document/File if present
  const docMsg = rawMsg.message?.documentMessage;
  if (docMsg && secScanConfig.scan_files !== false) {
    const filename = docMsg.fileName || 'file';
    if (await scanFilenameAndMetadata(filename, engine)) {
      results.is_malicious = true;
      results.threats.push({ type: 'file', value: filename });
    }
  }

  return results;
}

async function scanUrl(url, engine, vtApiKey) {
  if (urlCache.has(url)) return urlCache.get(url);

  if (engine === 'local' || engine === 'hybrid') {
    const urlLower = url.toLowerCase();
    const maliciousPatterns = [
      'malicious',
      'phishing',
      'scam',
      'virus',
      'eicar',
      'free-crypto',
      'gift-card',
      'urgent-verify',
      'account-locked',
      'login-verify',
      'secure-update',
      'free-telegram-premium',
      'claim-reward',
    ];
    if (maliciousPatterns.some((p) => urlLower.includes(p))) {
      logger.info({ url }, 'Flagged malicious URL via local heuristic pattern');
      urlCache.set(url, true);
      return true;
    }

    if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(urlLower)) {
      logger.info({ url }, 'Flagged suspicious raw IP URL');
      urlCache.set(url, true);
      return true;
    }

    if (engine === 'local') {
      urlCache.set(url, false);
      return false;
    }
  }

  if ((engine === 'virustotal' || engine === 'hybrid') && vtApiKey) {
    try {
      const urlId = Buffer.from(url).toString('base64url').replace(/=/g, '');
      const res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
        headers: { 'x-apikey': vtApiKey },
      });
      if (res.ok) {
        const data = await res.json();
        const stats = data.data?.attributes?.last_analysis_stats || {};
        if ((stats.malicious || 0) > 0 || (stats.undesirable || 0) > 0) {
          logger.warn({ url, stats }, 'Flagged malicious URL via VirusTotal Cloud');
          urlCache.set(url, true);
          return true;
        }
      }
    } catch (e) {
      logger.debug({ error: e.message }, 'VirusTotal URL scan failed');
    }
  }

  urlCache.set(url, false);
  return false;
}

async function scanFilenameAndMetadata(filename) {
  const fname = (filename || '').toLowerCase();
  const dangerousExts = [
    '.exe',
    '.scr',
    '.pif',
    '.bat',
    '.cmd',
    '.vbs',
    '.js',
    '.ps1',
    '.hta',
    '.apk',
  ];
  if (dangerousExts.some((ext) => fname.endsWith(ext))) {
    logger.info({ filename }, 'Flagged dangerous executable file extension');
    return true;
  }
  return false;
}
