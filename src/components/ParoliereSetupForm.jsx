import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Search,
  Shuffle,
  Wand2,
} from 'lucide-react';
import {
  pickNonSynonymDistractors,
  pickRandomWordEntry,
  suggestDistractorsForCustomWord,
} from '../data/wordBank.js';
import {
  findPossibleSynonymConflicts,
  loadFullDictionary,
  lookupWordInFullDictionary,
  pickNonSynonymsFromFullDictionary,
  pickRandomFromFullDictionary,
  searchFullDictionary,
} from '../data/fullDictionary.js';
import { playSelectSound } from '../utils/audioAndHaptics.js';

export default function ParoliereSetupForm({
  paroliereName,
  kickerText,
  submitLabel,
  levelFilter = 'Tutti',
  usedWords = [],
  soundEnabled = true,
  externalError = '',
  onSubmitSetup,
}) {
  const [targetInput, setTargetInput] = useState('');
  const [translationInput, setTranslationInput] = useState('');
  const [distractorInputs, setDistractorInputs] = useState(['', '', '', '']);
  const [localError, setLocalError] = useState('');

  const [dictReady, setDictReady] = useState(false);
  const [dictSearchQuery, setDictSearchQuery] = useState('');
  const [showDictSearch, setShowDictSearch] = useState(false);

  useEffect(() => {
    loadFullDictionary()
      .then(() => setDictReady(true))
      .catch(() => {});
  }, []);

  const liveDictMatch = useMemo(() => {
    if (!dictReady || !targetInput.trim()) return null;
    return lookupWordInFullDictionary(targetInput);
  }, [dictReady, targetInput]);

  const dictSearchResults = useMemo(() => {
    if (!dictReady || !showDictSearch || !dictSearchQuery.trim()) return [];
    return searchFullDictionary(dictSearchQuery, { limit: 8 });
  }, [dictReady, showDictSearch, dictSearchQuery]);

  const synonymConflicts = useMemo(() => {
    if (!dictReady) return [];
    return findPossibleSynonymConflicts(targetInput, distractorInputs);
  }, [dictReady, targetInput, distractorInputs]);

  const handleDrawCurated = () => {
    const entry = pickRandomWordEntry(usedWords, levelFilter);
    const distractors = pickNonSynonymDistractors(entry, 4);
    setTargetInput(entry.word);
    setTranslationInput(entry.it);
    setDistractorInputs(distractors);
    setLocalError('');
    playSelectSound(soundEnabled);
  };

  const handleDrawFull = () => {
    const picked = pickRandomFromFullDictionary(usedWords);
    if (!picked) {
      handleDrawCurated();
      return;
    }
    setTargetInput(picked.target.word);
    setTranslationInput(picked.target.it);
    setDistractorInputs(picked.distractors);
    setLocalError('');
    playSelectSound(soundEnabled);
  };

  const handlePickFromSearch = (entry) => {
    setTargetInput(entry.word);
    setTranslationInput(entry.it);
    const nonSyns = pickNonSynonymsFromFullDictionary(entry.word, 4);
    if (nonSyns.length === 4) {
      setDistractorInputs(nonSyns);
    }
    setShowDictSearch(false);
    setDictSearchQuery('');
    setLocalError('');
    playSelectSound(soundEnabled);
  };

  const handleSuggestDistractors = () => {
    if (dictReady && targetInput.trim()) {
      const fromFull = pickNonSynonymsFromFullDictionary(targetInput, 4);
      if (fromFull.length === 4) {
        setDistractorInputs(fromFull);
        setLocalError('');
        playSelectSound(soundEnabled);
        return;
      }
    }
    setDistractorInputs(suggestDistractorsForCustomWord(targetInput, []));
    setLocalError('');
    playSelectSound(soundEnabled);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const effectiveTranslation = (translationInput || liveDictMatch?.it || '').trim();
    if (!effectiveTranslation) {
      setLocalError(
        'Inserisci la traduzione in italiano: sarà visibile a tutti i giocatori per indovinare la parola inglese!'
      );
      return;
    }
    const err = onSubmitSetup({
      targetWord: targetInput,
      translation: effectiveTranslation,
      distractors: distractorInputs,
    });
    if (typeof err === 'string' && err) {
      setLocalError(err);
    }
  };

  return (
    <section className="stage-card">
      <div className="stage-header-row">
        <div>
          <span className="phase-kicker">{kickerText}</span>
          <h2 className="stage-title">
            {paroliereName}, prepara le 5 parole inglesi
          </h2>
        </div>
        <div className="setup-draw-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDrawCurated}
          >
            <Shuffle size={16} aria-hidden="true" />
            <span>Pesca Curata</span>
          </button>
          {dictReady ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDrawFull}
              >
                <BookOpen size={16} aria-hidden="true" />
                <span>Pesca da 49k</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${
                  showDictSearch ? 'btn-primary' : 'btn-ghost'
                }`}
                onClick={() => setShowDictSearch((v) => !v)}
              >
                <Search size={16} aria-hidden="true" />
                <span>Cerca IT/EN</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {showDictSearch && dictReady ? (
        <div className="inline-dict-search">
          <label htmlFor="paroliere-dict-search" className="field-label">
            Cerca una parola in italiano o inglese nel dizionario (49.399 voci):
          </label>
          <input
            id="paroliere-dict-search"
            type="search"
            value={dictSearchQuery}
            onChange={(e) => setDictSearchQuery(e.target.value)}
            placeholder="Es. farfalla, coraggio, ephemeral..."
            autocorrect="off"
            autocapitalize="none"
          />
          {dictSearchResults.length > 0 ? (
            <ul className="inline-dict-results">
              {dictSearchResults.map((entry) => (
                <li key={`${entry.word}-${entry.pos}`}>
                  <button
                    type="button"
                    className="inline-dict-result-btn"
                    onClick={() => handlePickFromSearch(entry)}
                  >
                    <span>
                      <strong lang="en">{entry.word}</strong>{' '}
                      {entry.ipa ? <span className="ipa-tag">{entry.ipa}</span> : null}
                    </span>
                    <span className="inline-dict-it">{entry.it}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : dictSearchQuery.trim() ? (
            <p className="helper-note">Nessuna voce trovata.</p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="paroliere-form">
        <div className="secret-word-box">
          <div className="field-group">
            <label htmlFor="target-word-input" className="field-label">
              🎯 Parola inglese da indovinare (Segreta)
            </label>
            <input
              id="target-word-input"
              type="text"
              value={targetInput}
              onChange={(e) => {
                setTargetInput(e.target.value);
                setLocalError('');
              }}
              placeholder="Es. Ephemeral, Serendipity, Candid..."
              autocorrect="off"
              autocapitalize="none"
              required
            />
            {liveDictMatch ? (
              <p className="dict-autofill-hint">
                Dizionario: <strong>{liveDictMatch.ipa}</strong> — {liveDictMatch.it}
                {!translationInput ? (
                  <button
                    type="button"
                    className="link-inline-btn"
                    onClick={() => setTranslationInput(liveDictMatch.it)}
                  >
                    Usa traduzione
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="field-group">
            <label htmlFor="target-translation-input" className="field-label">
              🇮🇹 Traduzione in italiano (visibile a tutti i giocatori)
            </label>
            <input
              id="target-translation-input"
              type="text"
              value={translationInput}
              onChange={(e) => {
                setTranslationInput(e.target.value);
                setLocalError('');
              }}
              placeholder={liveDictMatch?.it || 'Es. Effimero, di breve durata'}
              required={!liveDictMatch?.it}
            />
          </div>
        </div>

        <div className="distractors-header">
          <div>
            <h3 className="subsection-title">
              4 Altre Parole Inglesi (NON sinonimi!)
            </h3>
            <p className="helper-note">
              Costituzione: se inserisci un sinonimo della parola prescelta è
              infrazione (−1 pt).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleSuggestDistractors}
          >
            <Wand2 size={16} aria-hidden="true" />
            <span>Suggerisci 4 non-sinonimi</span>
          </button>
        </div>

        <div className="distractors-grid">
          {distractorInputs.map((val, idx) => (
            <div key={idx} className="field-group">
              <label htmlFor={`distractor-${idx}`} className="field-label">
                Parola non-sinonimo #{idx + 1}
              </label>
              <input
                id={`distractor-${idx}`}
                type="text"
                value={val}
                onChange={(e) => {
                  const next = [...distractorInputs];
                  next[idx] = e.target.value;
                  setDistractorInputs(next);
                  setLocalError('');
                }}
                placeholder={`Opzione ${idx + 1}`}
                autocorrect="off"
                autocapitalize="none"
                required
              />
            </div>
          ))}
        </div>

        {synonymConflicts.length > 0 ? (
          <div className="synonym-warning-box" role="status">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>
              Possibile sinonimo rilevato dal dizionario:{' '}
              {synonymConflicts
                .map((c) => `"${c.word}" (condivide "${c.sharedMeaning}")`)
                .join(', ')}
              . Verifica prima di confermare!
            </span>
          </div>
        ) : null}

        {localError || externalError ? (
          <p className="error-banner" role="alert">
            {localError || externalError}
          </p>
        ) : null}

        <div className="form-submit-row">
          <button type="submit" className="btn btn-primary btn-lg">
            <span>{submitLabel}</span>
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
