const MEMO_KEY = 'inglisc_memo_words_v2';
const SETTINGS_KEY = 'inglisc_settings_v2';
const STATS_KEY = 'inglisc_stats_v2';

export const DEFAULT_SETTINGS = {
  soundEnabled: true,
  micClapEnabled: false,
  themePreference: 'system', // 'system' | 'light' | 'dark'
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadMemoWords() {
  try {
    const raw = localStorage.getItem(MEMO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMemoWords(items) {
  try {
    localStorage.setItem(MEMO_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export function upsertMemoWord(wordMeta) {
  const existing = loadMemoWords();
  const cleanWord = String(wordMeta.word || '').trim();
  if (!cleanWord) return existing;

  const idx = existing.findIndex(
    (item) => item.word.toLowerCase() === cleanWord.toLowerCase()
  );

  const nowIso = new Date().toISOString();
  let updated;
  if (idx >= 0) {
    const prev = existing[idx];
    updated = [...existing];
    updated[idx] = {
      ...prev,
      ...wordMeta,
      it: wordMeta.it && wordMeta.it !== 'Parola personalizzata inserita dal Paroliere'
        ? wordMeta.it
        : prev.it,
      timesSeen: (prev.timesSeen || 1) + 1,
      lastSeenAt: nowIso,
    };
  } else {
    updated = [
      {
        ...wordMeta,
        word: cleanWord,
        mastered: false,
        timesSeen: 1,
        lastSeenAt: nowIso,
      },
      ...existing,
    ];
  }

  saveMemoWords(updated);
  return updated;
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { matchesPlayed: 0, manchesPlayed: 0, infractionsCalled: 0 };
    return JSON.parse(raw);
  } catch {
    return { matchesPlayed: 0, manchesPlayed: 0, infractionsCalled: 0 };
  }
}

export function updateStats(patchFn) {
  const current = loadStats();
  const next = patchFn(current);
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}
