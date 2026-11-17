import React, { useState, useMemo, useEffect } from 'react';
import ModalDialog from './ModalDialog.jsx';
import { WORD_BANK } from '../data/wordBank.js';
import {
  loadFullDictionary,
  searchFullDictionary,
} from '../data/fullDictionary.js';
import { speakEnglishWord } from '../utils/audioAndHaptics.js';
import { Volume2, Star, Plus, Search, Trash2, Sparkles, BookOpen } from 'lucide-react';

export default function MemoDialog({
  open,
  onClose,
  memoWords,
  onToggleMastered,
  onAddWord,
  onRemoveWord,
}) {
  const [tab, setTab] = useState('learned'); // 'learned' | 'full' | 'curated'
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('Tutti');
  const [posFilter, setPosFilter] = useState('Tutti');
  const [newWord, setNewWord] = useState('');
  const [newIt, setNewIt] = useState('');

  const [fullDictReady, setFullDictReady] = useState(false);
  const [fullDictCount, setFullDictCount] = useState(49399);
  const [fullDictError, setFullDictError] = useState('');

  useEffect(() => {
    if (!open || tab !== 'full' || fullDictReady) return;
    setFullDictError('');
    loadFullDictionary()
      .then((dict) => {
        setFullDictCount(dict.entries.length);
        setFullDictReady(true);
      })
      .catch(() => {
        setFullDictError('Dizionario completo non ancora disponibile.');
      });
  }, [open, tab, fullDictReady]);

  const learnedSet = useMemo(
    () => new Set(memoWords.map((w) => w.word.toLowerCase())),
    [memoWords]
  );

  const filteredLearned = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memoWords.filter(
      (item) =>
        !q ||
        item.word.toLowerCase().includes(q) ||
        (item.it || '').toLowerCase().includes(q)
    );
  }, [memoWords, query]);

  const filteredCurated = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WORD_BANK.filter((entry) => {
      const matchesLevel = levelFilter === 'Tutti' || entry.level === levelFilter;
      const matchesQuery =
        !q ||
        entry.word.toLowerCase().includes(q) ||
        entry.it.toLowerCase().includes(q);
      return matchesLevel && matchesQuery;
    });
  }, [query, levelFilter]);

  const fullSearchResults = useMemo(() => {
    if (tab !== 'full' || !fullDictReady) return [];
    return searchFullDictionary(query, { limit: 60, posFilter });
  }, [tab, fullDictReady, query, posFilter]);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    onAddWord({
      word: newWord.trim(),
      it: newIt.trim() || 'Parola salvata manualmente',
      ipa: '',
      pos: 'custom',
      level: 'Personalizzata',
      example: '',
    });
    setNewWord('');
    setNewIt('');
  };

  const masteredCount = memoWords.filter((w) => w.mastered).length;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      titleId="memo-dialog-title"
      title="Memo & Dizionario EN ↔ IT"
      subtitle={`${memoWords.length} salvate · ${masteredCount} imparate · ${fullDictCount.toLocaleString('it-IT')} voci offline`}
      maxWidth="48rem"
    >
      <div className="memo-container">
        <div
          className="segmented-tabs segmented-tabs-3"
          role="tablist"
          aria-label="Sezioni Memo Parole"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'learned'}
            className={`seg-tab ${tab === 'learned' ? 'is-active' : ''}`}
            onClick={() => setTab('learned')}
          >
            Le Mie Parole ({memoWords.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'full'}
            className={`seg-tab ${tab === 'full' ? 'is-active' : ''}`}
            onClick={() => setTab('full')}
          >
            Dizionario ({Math.floor(fullDictCount / 1000)}k+)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'curated'}
            className={`seg-tab ${tab === 'curated' ? 'is-active' : ''}`}
            onClick={() => setTab('curated')}
          >
            Mazzo Gioco ({WORD_BANK.length})
          </button>
        </div>

        <div className="memo-toolbar">
          <div className="search-field">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <label htmlFor="memo-search" className="visually-hidden">
              Cerca parola inglese o italiana
            </label>
            <input
              id="memo-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === 'full'
                  ? 'Cerca su ~50.000 parole in inglese o italiano (es. casa, ephem...)'
                  : 'Cerca parola inglese o italiana...'
              }
              autocorrect="off"
              autocapitalize="none"
            />
          </div>

          {tab === 'full' ? (
            <div className="level-chips" role="group" aria-label="Categoria grammaticale">
              {[
                { id: 'Tutti', label: 'Tutte' },
                { id: 'noun', label: 'Sostantivi' },
                { id: 'verb', label: 'Verbi' },
                { id: 'adj.', label: 'Aggettivi' },
                { id: 'adv.', label: 'Avverbi' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip-btn ${posFilter === p.id ? 'is-active' : ''}`}
                  onClick={() => setPosFilter(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}

          {tab === 'curated' ? (
            <div className="level-chips" role="group" aria-label="Filtra per livello">
              {['Tutti', 'Base', 'Intermedio', 'Avanzato'].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`chip-btn ${levelFilter === lvl ? 'is-active' : ''}`}
                  onClick={() => setLevelFilter(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {tab === 'learned' ? (
          <>
            <form onSubmit={handleAddSubmit} className="quick-add-form">
              <div className="quick-add-inputs">
                <div>
                  <label htmlFor="memo-new-en" className="visually-hidden">
                    Nuova parola inglese
                  </label>
                  <input
                    id="memo-new-en"
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="Nuova parola inglese (es. Serendipity)"
                  />
                </div>
                <div>
                  <label htmlFor="memo-new-it" className="visually-hidden">
                    Significato in italiano
                  </label>
                  <input
                    id="memo-new-it"
                    type="text"
                    value={newIt}
                    onChange={(e) => setNewIt(e.target.value)}
                    placeholder="Significato italiano"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={16} aria-hidden="true" />
                <span>Aggiungi</span>
              </button>
            </form>

            {filteredLearned.length === 0 ? (
              <div className="empty-memo">
                <Sparkles size={28} aria-hidden="true" />
                <p>
                  {memoWords.length === 0
                    ? 'Nessuna parola ancora salvata! Ogni manche giocata salva automaticamente qui la parola inglese scoperta, oppure cerca nel Dizionario Completo.'
                    : 'Nessuna parola corrisponde alla ricerca.'}
                </p>
                {memoWords.length === 0 ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setTab('full')}
                  >
                    Apri Dizionario ({fullDictCount.toLocaleString('it-IT')} parole)
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="memo-list">
                {filteredLearned.map((item) => (
                  <li
                    key={item.word}
                    className={`memo-card ${item.mastered ? 'is-mastered' : ''}`}
                  >
                    <div className="memo-card-main">
                      <div className="memo-word-row">
                        <strong className="memo-word">{item.word}</strong>
                        {item.ipa ? <span className="ipa-tag">{item.ipa}</span> : null}
                        {item.pos ? <span className="pos-tag">{item.pos}</span> : null}
                        {item.level ? (
                          <span className="level-tag">{item.level}</span>
                        ) : null}
                      </div>
                      <p className="memo-it">{item.it}</p>
                      {item.example ? (
                        <p className="memo-example" lang="en">
                          “{item.example}”
                        </p>
                      ) : null}
                    </div>

                    <div className="memo-card-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => speakEnglishWord(item.word)}
                        aria-label={`Ascolta pronuncia di ${item.word}`}
                        title="Ascolta pronuncia"
                      >
                        <Volume2 size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`icon-btn ${item.mastered ? 'is-starred' : ''}`}
                        onClick={() => onToggleMastered(item.word)}
                        aria-pressed={Boolean(item.mastered)}
                        aria-label={`Segna ${item.word} come imparata`}
                        title="Segna come imparata"
                      >
                        <Star
                          size={18}
                          fill={item.mastered ? 'currentColor' : 'none'}
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => onRemoveWord(item.word)}
                        aria-label={`Rimuovi ${item.word} dal memo`}
                        title="Rimuovi"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : tab === 'full' ? (
          <>
            {fullDictError ? (
              <p className="error-banner" role="alert">
                {fullDictError}
              </p>
            ) : !fullDictReady ? (
              <div className="empty-memo">
                <BookOpen size={28} aria-hidden="true" />
                <p>Caricamento dizionario offline (49.399 voci EN ↔ IT)...</p>
              </div>
            ) : fullSearchResults.length === 0 ? (
              <div className="empty-memo">
                <Search size={26} aria-hidden="true" />
                <p>Nessuna voce trovata per &ldquo;{query}&rdquo;.</p>
              </div>
            ) : (
              <>
                <ul className="memo-list">
                  {fullSearchResults.map((entry) => {
                    const saved = learnedSet.has(entry.word.toLowerCase());
                    return (
                      <li key={`${entry.word}-${entry.pos}`} className="memo-card">
                        <div className="memo-card-main">
                          <div className="memo-word-row">
                            <strong className="memo-word">{entry.word}</strong>
                            {entry.ipa ? (
                              <span className="ipa-tag">{entry.ipa}</span>
                            ) : null}
                            {entry.pos ? (
                              <span className="pos-tag">{entry.pos}</span>
                            ) : null}
                          </div>
                          <p className="memo-it">{entry.it}</p>
                        </div>
                        <div className="memo-card-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => speakEnglishWord(entry.word)}
                            aria-label={`Ascolta pronuncia di ${entry.word}`}
                          >
                            <Volume2 size={18} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${
                              saved ? 'btn-ghost' : 'btn-primary'
                            }`}
                            disabled={saved}
                            onClick={() =>
                              onAddWord({
                                ...entry,
                                level: 'Dizionario EN-IT',
                                example: '',
                              })
                            }
                          >
                            {saved ? 'Salvata' : '+ Salva'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="dict-attribution">
                  Mostrati fino a 60 risultati su{' '}
                  {fullDictCount.toLocaleString('it-IT')} voci · Fonte: FreeDict /
                  WikDict eng-ita (CC BY-SA 3.0).
                </p>
              </>
            )}
          </>
        ) : (
          <ul className="memo-list">
            {filteredCurated.map((entry) => {
              const saved = learnedSet.has(entry.word.toLowerCase());
              return (
                <li key={entry.id} className="memo-card">
                  <div className="memo-card-main">
                    <div className="memo-word-row">
                      <strong className="memo-word">{entry.word}</strong>
                      <span className="ipa-tag">{entry.ipa}</span>
                      <span className="pos-tag">{entry.pos}</span>
                      <span className="level-tag">{entry.level}</span>
                    </div>
                    <p className="memo-it">{entry.it}</p>
                    <p className="memo-example" lang="en">
                      “{entry.example}”
                    </p>
                  </div>
                  <div className="memo-card-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => speakEnglishWord(entry.word)}
                      aria-label={`Ascolta pronuncia di ${entry.word}`}
                    >
                      <Volume2 size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${saved ? 'btn-ghost' : 'btn-primary'}`}
                      disabled={saved}
                      onClick={() => onAddWord(entry)}
                    >
                      {saved ? 'Salvata' : '+ Salva'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalDialog>
  );
}
