import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../../../config.js';
import { logger } from '../../../logger.js';

const MAX_ENTRIES = 5000;
const DEBOUNCE_MS = 2000;

let _saveTimer = null;

function getCacheFilePath() {
  const dir = process.env.DATA_DIR || DATA_DIR;
  return path.join(dir, 'translation_map_cache.json');
}

export function loadTranslationCache() {
  const file = getCacheFilePath();
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    logger.warn(
      { error: err.message },
      '⚠️ Failed to read translation_map_cache.json, starting fresh.'
    );
  }
  return {};
}

export function saveTranslationCache(data) {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
  }
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    _flushTranslationCache(data);
  }, DEBOUNCE_MS);
}

function _flushTranslationCache(data) {
  try {
    // Cap to MAX_ENTRIES by removing oldest entries (by ts field)
    const entries = Object.entries(data);
    let pruned = data;
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
      const toKeep = entries.slice(entries.length - MAX_ENTRIES);
      pruned = Object.fromEntries(toKeep);
    }
    const file = getCacheFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(pruned, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ error: err.message }, '❌ Failed to save translation_map_cache.json.');
  }
}
