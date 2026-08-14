import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = __dirname;
const localesMap = new Map();

/**
 * Dynamically loads all JSON language files from src/locales/
 */
export function loadAllLocales() {
  localesMap.clear();
  try {
    const files = fs.readdirSync(localesDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(localesDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(content);
          const langCode = parsed.meta?.code || path.basename(file, '.json');
          localesMap.set(langCode.toLowerCase(), parsed);
        } catch (e) {
          console.error(`❌ Failed to load locale file ${file}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error('❌ Failed to read locales directory:', err.message);
  }
  return localesMap;
}

// Initial load on module import
loadAllLocales();

/**
 * Returns list of dynamically available languages with metadata
 */
export function getAvailableLanguages() {
  if (localesMap.size === 0) loadAllLocales();
  const list = [];
  for (const [code, dict] of localesMap.entries()) {
    list.push({
      code,
      name: dict.meta?.name || code.toUpperCase(),
      flag: dict.meta?.flag || '🌐',
    });
  }
  return list;
}

/**
 * Returns full translation dictionary for specified language code (fallback to 'en')
 */
export function getLocaleDictionary(langCode = 'en') {
  if (localesMap.size === 0) loadAllLocales();
  const normalized = (langCode || 'en').toLowerCase().trim();
  if (localesMap.has(normalized)) {
    return localesMap.get(normalized);
  }
  // Fallback to English
  return localesMap.get('en') || {};
}

/**
 * Translates a key path (e.g. "moderation.title") for given language with parameter substitution.
 */
export function t(langCode, keyPath, params = {}) {
  const dict = getLocaleDictionary(langCode);
  const keys = keyPath.split('.');
  let val = dict;
  for (const k of keys) {
    if (val && typeof val === 'object' && k in val) {
      val = val[k];
    } else {
      val = null;
      break;
    }
  }

  if (typeof val !== 'string') {
    // Try English fallback if current lang is not English
    if (langCode !== 'en') {
      return t('en', keyPath, params);
    }
    return keyPath;
  }

  let text = val;
  for (const [pKey, pVal] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
  }
  return text;
}
