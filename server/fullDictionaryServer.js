import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICT_PATH = path.resolve(__dirname, '../public/data/dictionary-en-it.json');

let byLowerWord = null;

function ensureLoaded() {
  if (byLowerWord) return;
  byLowerWord = new Map();
  try {
    if (!fs.existsSync(DICT_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));
    for (const row of raw) {
      byLowerWord.set(String(row[0]).toLowerCase(), {
        word: row[0],
        ipa: row[1] || '',
        pos: row[2] || '',
        it: row[3] || '',
      });
    }
  } catch {
    // Graceful fallback to curated wordBank if file missing
  }
}

export function lookupServerDictionary(word) {
  ensureLoaded();
  if (!word) return null;
  return byLowerWord.get(String(word).trim().toLowerCase()) || null;
}
