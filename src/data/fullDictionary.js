/**
 * Client-side loader & search engine for the 49,399-entry FreeDict EN-IT dictionary
 * stored in /data/dictionary-en-it.json (precached offline by the PWA Service Worker).
 */

let cachedPromise = null;
let cachedData = null;

function parseCompactEntries(rawRows) {
  const entries = new Array(rawRows.length);
  const byLowerWord = new Map();

  for (let idx = 0; idx < rawRows.length; idx += 1) {
    const row = rawRows[idx];
    const entry = {
      word: row[0],
      ipa: row[1] || '',
      pos: row[2] || '',
      it: row[3] || '',
    };
    entries[idx] = entry;
    byLowerWord.set(entry.word.toLowerCase(), entry);
  }

  return { entries, byLowerWord };
}

export function loadFullDictionary() {
  if (cachedData) {
    return Promise.resolve(cachedData);
  }
  if (!cachedPromise) {
    cachedPromise = fetch('/data/dictionary-en-it.json')
      .then((res) => {
        if (!res.ok) throw new Error('Impossibile caricare il dizionario.');
        return res.json();
      })
      .then((raw) => {
        cachedData = parseCompactEntries(raw);
        return cachedData;
      })
      .catch((err) => {
        cachedPromise = null;
        throw err;
      });
  }
  return cachedPromise;
}

export function getCachedDictionarySync() {
  return cachedData;
}

export function lookupWordInFullDictionary(word) {
  if (!cachedData || !word) return null;
  return cachedData.byLowerWord.get(String(word).trim().toLowerCase()) || null;
}

/**
 * Searches both English headwords and Italian translations.
 * Prioritizes exact matches, then prefix matches, then substring matches.
 */
export function searchFullDictionary(query, { limit = 60, posFilter = 'Tutti' } = {}) {
  if (!cachedData) return [];
  const { entries } = cachedData;
  const q = String(query || '').trim().toLowerCase();

  const matchesPos = (entry) =>
    posFilter === 'Tutti' || entry.pos.includes(posFilter);

  if (!q) {
    const initial = [];
    for (let i = 0; i < entries.length && initial.length < limit; i += 1) {
      if (matchesPos(entries[i]) && /^[a-z]{4,14}$/i.test(entries[i].word)) {
        initial.push(entries[i]);
      }
    }
    return initial;
  }

  const exact = [];
  const startsEn = [];
  const startsIt = [];
  const contains = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!matchesPos(entry)) continue;

    const wLow = entry.word.toLowerCase();
    const itLow = entry.it.toLowerCase();

    if (wLow === q || itLow === q) {
      exact.push(entry);
    } else if (wLow.startsWith(q)) {
      if (startsEn.length < limit) startsEn.push(entry);
    } else if (
      itLow.startsWith(q) ||
      itLow.split(/[,;]\s*/).some((part) => part === q || part.startsWith(q))
    ) {
      if (startsIt.length < limit) startsIt.push(entry);
    } else if (wLow.includes(q) || itLow.includes(q)) {
      if (contains.length < limit) contains.push(entry);
    }
  }

  return [...exact, ...startsEn, ...startsIt, ...contains].slice(0, limit);
}

function getItalianTokens(itString) {
  return new Set(
    String(itString || '')
      .toLowerCase()
      .split(/[,;/()]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3)
  );
}

/**
 * Checks if a candidate distractor shares an Italian translation with targetWord,
 * helping prevent accidental synonyms per game rules.
 */
export function findPossibleSynonymConflicts(targetWord, distractors) {
  if (!cachedData || !targetWord) return [];
  const targetEntry = lookupWordInFullDictionary(targetWord);
  if (!targetEntry) return [];

  const targetTokens = getItalianTokens(targetEntry.it);
  if (targetTokens.size === 0) return [];

  const conflicts = [];
  for (const d of distractors) {
    if (!d || !d.trim()) continue;
    const dEntry = lookupWordInFullDictionary(d);
    if (!dEntry) continue;
    const dTokens = getItalianTokens(dEntry.it);
    for (const tok of dTokens) {
      if (targetTokens.has(tok)) {
        conflicts.push({ word: d.trim(), sharedMeaning: tok });
        break;
      }
    }
  }
  return conflicts;
}

function isGoodGameCandidate(entry) {
  return (
    /^[a-z]{4,11}$/.test(entry.word) &&
    Boolean(entry.it) &&
    !entry.pos.includes('prop.n.')
  );
}

/**
 * Picks a random single-word English entry from the 49k dictionary and 4 non-synonym distractors.
 */
export function pickRandomFromFullDictionary(usedWords = []) {
  if (!cachedData) return null;
  const { entries } = cachedData;
  const usedSet = new Set(usedWords.map((w) => String(w).trim().toLowerCase()));

  let target = null;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const candidate = entries[Math.floor(Math.random() * entries.length)];
    if (isGoodGameCandidate(candidate) && !usedSet.has(candidate.word.toLowerCase())) {
      target = candidate;
      break;
    }
  }
  if (!target) return null;

  const distractors = pickNonSynonymsFromFullDictionary(target.word, 4);
  return { target, distractors };
}

export function pickNonSynonymsFromFullDictionary(targetWord, count = 4) {
  if (!cachedData) return [];
  const { entries } = cachedData;
  const targetNorm = String(targetWord || '').trim().toLowerCase();
  const targetEntry = lookupWordInFullDictionary(targetWord);
  const targetTokens = targetEntry ? getItalianTokens(targetEntry.it) : new Set();
  const targetPrimaryPos = targetEntry?.pos?.split('/')[0] || '';

  const picked = [];
  const pickedSet = new Set([targetNorm]);

  for (let attempt = 0; attempt < 900 && picked.length < count; attempt += 1) {
    const candidate = entries[Math.floor(Math.random() * entries.length)];
    const cNorm = candidate.word.toLowerCase();
    if (pickedSet.has(cNorm) || !isGoodGameCandidate(candidate)) {
      continue;
    }

    // For the first 500 attempts, prefer words with the same part-of-speech for plausible distractors
    if (
      attempt < 500 &&
      targetPrimaryPos &&
      candidate.pos &&
      !candidate.pos.includes(targetPrimaryPos)
    ) {
      continue;
    }

    const cTokens = getItalianTokens(candidate.it);
    let overlaps = false;
    for (const tok of cTokens) {
      if (targetTokens.has(tok)) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      pickedSet.add(cNorm);
      picked.push(candidate.word);
    }
  }

  return picked;
}
