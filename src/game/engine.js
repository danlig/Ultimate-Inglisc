import {
  findWordEntry,
  pickNonSynonymDistractors,
  pickRandomWordEntry,
} from '../data/wordBank.js';
import { lookupWordInFullDictionary } from '../data/fullDictionary.js';

export function normalizeWord(word) {
  return String(word ?? '').trim().toLowerCase();
}

export function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Validates the 1 target word + 4 non-synonym words chosen by the Paroliere.
 */
export function validateParoliereWords(targetWord, distractors) {
  const cleanTarget = String(targetWord ?? '').trim();
  const cleanDistractors = (distractors || []).map((d) => String(d ?? '').trim());

  if (!cleanTarget) {
    return { valid: false, error: 'Inserisci la parola inglese segreta da indovinare.' };
  }
  if (cleanDistractors.length !== 4 || cleanDistractors.some((d) => !d)) {
    return { valid: false, error: 'Inserisci tutte e 4 le altre parole (non sinonimi).' };
  }

  const all = [cleanTarget, ...cleanDistractors];
  const seen = new Set();
  for (const w of all) {
    const norm = normalizeWord(w);
    if (seen.has(norm)) {
      return {
        valid: false,
        error: `La parola "${w}" è duplicata: le 5 opzioni devono essere tutte diverse.`,
      };
    }
    seen.add(norm);
  }

  return {
    valid: true,
    targetWord: cleanTarget,
    distractors: cleanDistractors,
    options: shuffleArray(all),
  };
}

/**
 * Derives the Paroliere and the two Guessers for a manche.
 */
export function getMancheRoles(players, paroliereIndex) {
  const safeIdx = ((paroliereIndex % players.length) + players.length) % players.length;
  const paroliere = players[safeIdx];
  const guessers = players.filter((_, idx) => idx !== safeIdx);
  return {
    paroliereIndex: safeIdx,
    paroliere,
    guesser1: guessers[0],
    guesser2: guessers[1],
  };
}

/**
 * Determines which words the Paroliere may discard after Phase 1.
 * Rule: "Il paroliere ne scarta una di un giocatore (altrimenti un'altra parola non scelta)"
 * The Paroliere cannot discard the secret target word itself.
 */
export function getEligibleDiscardOptions(options, targetWord, p1Choice1, p2Choice1) {
  const targetNorm = normalizeWord(targetWord);
  const p1Norm = normalizeWord(p1Choice1);
  const p2Norm = normalizeWord(p2Choice1);

  const playerPickedNonTargets = options.filter((word) => {
    const wNorm = normalizeWord(word);
    return wNorm !== targetNorm && (wNorm === p1Norm || wNorm === p2Norm);
  });

  if (playerPickedNonTargets.length > 0) {
    return {
      mode: 'player_choice',
      eligible: playerPickedNonTargets,
    };
  }

  // Fallback when both players picked the target word: discard another unchosen word.
  const unchosenNonTargets = options.filter((word) => {
    const wNorm = normalizeWord(word);
    return wNorm !== targetNorm && wNorm !== p1Norm && wNorm !== p2Norm;
  });

  return {
    mode: 'unchosen_word',
    eligible: unchosenNonTargets,
  };
}

/**
 * Returns Phase 3 options for a guesser after a word was discarded.
 * Rule: "Tutti possono cambiare parola dopo lo scarto, costretti o non."
 */
export function getPlayerSecondPickInfo(options, initialChoice, discardedWord) {
  const discardNorm = normalizeWord(discardedWord);
  const initialNorm = normalizeWord(initialChoice);
  const remainingOptions = options.filter((w) => normalizeWord(w) !== discardNorm);
  const isForced = initialNorm === discardNorm;

  return {
    isForced,
    canKeep: !isForced,
    remainingOptions,
  };
}

/**
 * Exact scoring calculation per official rules:
 *
 * Giocatore:
 * - 3 punti: indovina senza mai cambiare
 * - 1 punto: vince sulla seconda parola cambiata (costretta o non)
 * - 0 punti: non indovina
 *
 * Paroliere:
 * - 3 punti: nessun giocatore indovina
 * - 1 punto: un solo giocatore indovina con risposta cambiata
 * - 0 punti: almeno un giocatore indovina senza cambio OPPURE entrambi vincono
 */
export function calculateMancheScores({
  targetWord,
  p1Initial,
  p1Final,
  p2Initial,
  p2Final,
}) {
  const targetNorm = normalizeWord(targetWord);

  const p1Changed = normalizeWord(p1Final) !== normalizeWord(p1Initial);
  const p2Changed = normalizeWord(p2Final) !== normalizeWord(p2Initial);

  const p1Wins = normalizeWord(p1Final) === targetNorm;
  const p2Wins = normalizeWord(p2Final) === targetNorm;

  const p1Points = p1Wins ? (p1Changed ? 1 : 3) : 0;
  const p2Points = p2Wins ? (p2Changed ? 1 : 3) : 0;

  let parolierePoints = 0;
  let paroliereReason = '';

  if (!p1Wins && !p2Wins) {
    parolierePoints = 3;
    paroliereReason = 'Nessun giocatore ha indovinato la parola (+3 pt)';
  } else if (p1Wins && p2Wins) {
    parolierePoints = 0;
    paroliereReason = 'Entrambi i giocatori hanno indovinato (0 pt)';
  } else if ((p1Wins && !p1Changed) || (p2Wins && !p2Changed)) {
    parolierePoints = 0;
    paroliereReason = 'Almeno un giocatore ha indovinato senza mai cambiare (0 pt)';
  } else {
    parolierePoints = 1;
    paroliereReason = 'Un solo giocatore ha indovinato cambiando parola (+1 pt)';
  }

  return {
    p1: {
      wins: p1Wins,
      changed: p1Changed,
      points: p1Points,
      reason: p1Wins
        ? p1Changed
          ? 'Indovinata cambiando parola (+1 pt)'
          : 'Indovinata al 1° colpo senza cambio (+3 pt)'
        : 'Parola sbagliata (0 pt)',
    },
    p2: {
      wins: p2Wins,
      changed: p2Changed,
      points: p2Points,
      reason: p2Wins
        ? p2Changed
          ? 'Indovinata cambiando parola (+1 pt)'
          : 'Indovinata al 1° colpo senza cambio (+3 pt)'
        : 'Parola sbagliata (0 pt)',
    },
    paroliere: {
      points: parolierePoints,
      reason: paroliereReason,
    },
  };
}

/**
 * Constitution Rule #2:
 * "Ad ogni infrazione viene annullata la manche e chi sbaglia viene penalizzato di un punto"
 */
export function applyInfractionPenalty(players, offenderId) {
  return players.map((player) =>
    player.id === offenderId ? { ...player, score: player.score - 1 } : player
  );
}

// --- Bot AI helpers for solo/duo playtesting & practice ---

export function botCreateParoliereRound(usedWords = [], levelFilter = 'Tutti') {
  const entry = pickRandomWordEntry(usedWords, levelFilter);
  const distractors = pickNonSynonymDistractors(entry, 4);
  const options = shuffleArray([entry.word, ...distractors]);
  return {
    targetWord: entry.word,
    targetEntry: entry,
    distractors,
    options,
  };
}

export function botChooseFirstWord(options, targetWord) {
  // Slight preference for plausible guessing (~35% chance to hit target directly)
  const roll = Math.random();
  if (roll < 0.35) {
    return targetWord;
  }
  const nonTargets = options.filter((w) => normalizeWord(w) !== normalizeWord(targetWord));
  return nonTargets[Math.floor(Math.random() * nonTargets.length)];
}

export function botChooseDiscardWord(options, targetWord, p1Choice1, p2Choice1) {
  const { eligible } = getEligibleDiscardOptions(options, targetWord, p1Choice1, p2Choice1);
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function botChooseSecondWord(options, initialChoice, discardedWord, targetWord) {
  const { isForced, remainingOptions } = getPlayerSecondPickInfo(
    options,
    initialChoice,
    discardedWord
  );

  if (isForced) {
    // Must pick among remaining 4
    if (Math.random() < 0.4 && remainingOptions.includes(targetWord)) {
      return targetWord;
    }
    return remainingOptions[Math.floor(Math.random() * remainingOptions.length)];
  }

  // Not forced: 65% keeps original choice to chase 3 pts, 35% switches
  if (Math.random() < 0.65) {
    return initialChoice;
  }
  const others = remainingOptions.filter((w) => normalizeWord(w) !== normalizeWord(initialChoice));
  return others[Math.floor(Math.random() * others.length)];
}

export function enrichWordMetadata(word, customTranslation = '') {
  const entry = findWordEntry(word);
  if (entry) {
    return {
      word: entry.word,
      ipa: entry.ipa,
      pos: entry.pos,
      level: entry.level,
      it: customTranslation.trim() || entry.it,
      example: entry.example,
    };
  }
  const dictEntry = lookupWordInFullDictionary(word);
  if (dictEntry) {
    return {
      word: dictEntry.word,
      ipa: dictEntry.ipa,
      pos: dictEntry.pos || 'word',
      level: 'Dizionario EN-IT',
      it: customTranslation.trim() || dictEntry.it,
      example: '',
    };
  }
  return {
    word: String(word).trim(),
    ipa: '',
    pos: 'custom',
    level: 'Personalizzata',
    it: customTranslation.trim() || 'Parola personalizzata inserita dal Paroliere',
    example: '',
  };
}
