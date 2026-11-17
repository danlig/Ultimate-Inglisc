import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  botChooseDiscardWord,
  botChooseFirstWord,
  botChooseSecondWord,
  botCreateParoliereRound,
  calculateMancheScores,
  enrichWordMetadata,
  getEligibleDiscardOptions,
  getMancheRoles,
  getPlayerSecondPickInfo,
  normalizeWord,
  validateParoliereWords,
} from '../game/engine.js';
import {
  playDiscardSound,
  playInfractionSound,
  playRevealWinSound,
  playSelectSound,
  playSlapSound,
  speakEnglishWord,
  triggerHaptic,
} from '../utils/audioAndHaptics.js';
import SlapPad from './SlapPad.jsx';
import InfractionDialog from './InfractionDialog.jsx';
import ConfettiBurst from './ConfettiBurst.jsx';
import ParoliereSetupForm from './ParoliereSetupForm.jsx';

export default function GameBoard({
  players,
  totalRounds,
  levelFilter,
  soundEnabled,
  micClapEnabled,
  onToggleMicClap,
  onApplyInfraction,
  onUpdateScores,
  onSaveMemoWord,
  onMatchComplete,
  onExitMatch,
  onRestartMatch,
}) {
  const [mancheNumber, setMancheNumber] = useState(1);
  const [paroliereIndex, setParoliereIndex] = useState(0);
  const [phase, setPhase] = useState('paroliere_privacy');
  const [usedWords, setUsedWords] = useState([]);
  const [learnedThisMatch, setLearnedThisMatch] = useState([]);

  // Current manche live state
  const [options, setOptions] = useState([]);
  const [targetWord, setTargetWord] = useState('');
  const [targetMeta, setTargetMeta] = useState(null);

  const [activeGuesserSlot, setActiveGuesserSlot] = useState(1); // 1 or 2
  const [stagedChoice, setStagedChoice] = useState('');
  const [p1Choice1, setP1Choice1] = useState('');
  const [p2Choice1, setP2Choice1] = useState('');
  const [discardedWord, setDiscardedWord] = useState('');
  const [p1Choice2, setP1Choice2] = useState('');
  const [p2Choice2, setP2Choice2] = useState('');

  const [roundScoreReport, setRoundScoreReport] = useState(null);
  const [infractionReport, setInfractionReport] = useState(null);
  const [infractionOpen, setInfractionOpen] = useState(false);

  const roles = getMancheRoles(players, paroliereIndex);
  const { paroliere, guesser1, guesser2 } = roles;

  const isActiveManchePhase =
    phase !== 'round_reveal' &&
    phase !== 'round_cancelled' &&
    phase !== 'match_over';

  const resetMancheState = (nextParoliereIdx, nextMancheNum) => {
    setMancheNumber(nextParoliereIdx === undefined ? mancheNumber : nextMancheNum);
    setParoliereIndex(nextParoliereIdx);
    setOptions([]);
    setTargetWord('');
    setTargetMeta(null);
    setActiveGuesserSlot(1);
    setStagedChoice('');
    setP1Choice1('');
    setP2Choice1('');
    setDiscardedWord('');
    setP1Choice2('');
    setP2Choice2('');
    setRoundScoreReport(null);
    setInfractionReport(null);
    setPhase('paroliere_privacy');
  };

  // Handle Bot turns seamlessly with short readable pauses
  useEffect(() => {
    let timerId = null;

    if (phase === 'paroliere_privacy' && paroliere.isBot) {
      timerId = setTimeout(() => {
        const botRound = botCreateParoliereRound(usedWords, levelFilter);
        const meta = enrichWordMetadata(botRound.targetWord, botRound.targetEntry.it);
        setTargetWord(botRound.targetWord);
        setTargetMeta(meta);
        setOptions(botRound.options);
        setUsedWords((prev) => [...prev, botRound.targetWord]);
        setPhase('players_pick_1');
        setActiveGuesserSlot(1);
        setStagedChoice('');
      }, 650);
    } else if (phase === 'players_pick_1') {
      const currentPlayer = activeGuesserSlot === 1 ? guesser1 : guesser2;
      if (currentPlayer.isBot) {
        timerId = setTimeout(() => {
          const pick = botChooseFirstWord(options, targetWord);
          playSlapSound(soundEnabled);
          triggerHaptic(35);
          if (activeGuesserSlot === 1) {
            setP1Choice1(pick);
            setActiveGuesserSlot(2);
            setStagedChoice('');
          } else {
            setP2Choice1(pick);
            setStagedChoice('');
            setPhase(paroliere.isBot ? 'paroliere_discard' : 'paroliere_discard_privacy');
          }
        }, 750);
      }
    } else if (phase === 'paroliere_discard' && paroliere.isBot) {
      timerId = setTimeout(() => {
        const discard = botChooseDiscardWord(options, targetWord, p1Choice1, p2Choice1);
        playDiscardSound(soundEnabled);
        triggerHaptic([30, 40, 30]);
        setDiscardedWord(discard);
        setActiveGuesserSlot(1);
        setStagedChoice('');
        setPhase('players_pick_2');
      }, 800);
    } else if (phase === 'players_pick_2') {
      const currentPlayer = activeGuesserSlot === 1 ? guesser1 : guesser2;
      const initialChoice = activeGuesserSlot === 1 ? p1Choice1 : p2Choice1;
      if (currentPlayer.isBot) {
        timerId = setTimeout(() => {
          const pick = botChooseSecondWord(
            options,
            initialChoice,
            discardedWord,
            targetWord
          );
          playSlapSound(soundEnabled);
          triggerHaptic(35);
          if (activeGuesserSlot === 1) {
            setP1Choice2(pick);
            setActiveGuesserSlot(2);
            setStagedChoice('');
          } else {
            setP2Choice2(pick);
            finalizeManche(p1Choice1, p1Choice2 || pick, p2Choice1, pick, true);
          }
        }, 750);
      }
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [
    phase,
    activeGuesserSlot,
    paroliere.isBot,
    guesser1.isBot,
    guesser2.isBot,
    options,
    targetWord,
    p1Choice1,
    p2Choice1,
    p1Choice2,
    discardedWord,
    levelFilter,
    soundEnabled,
  ]);

  const handleConfirmParoliereSetup = ({ targetWord: rawTarget, translation, distractors }) => {
    const res = validateParoliereWords(rawTarget, distractors);
    if (!res.valid) {
      return res.error;
    }

    const meta = enrichWordMetadata(res.targetWord, translation);
    setTargetWord(res.targetWord);
    setTargetMeta(meta);
    setOptions(res.options);
    setUsedWords((prev) => [...prev, res.targetWord]);
    playSelectSound(soundEnabled);
    setPhase('table_handoff');
    return '';
  };

  const handleSelectWordCard = (word) => {
    setStagedChoice(word);
    playSelectSound(soundEnabled);
  };

  const handleSlapConfirmPhase1 = () => {
    if (!stagedChoice) return;
    playSlapSound(soundEnabled);
    triggerHaptic(45);

    if (activeGuesserSlot === 1) {
      setP1Choice1(stagedChoice);
      setStagedChoice('');
      setActiveGuesserSlot(2);
    } else {
      setP2Choice1(stagedChoice);
      setStagedChoice('');
      setPhase(paroliere.isBot ? 'paroliere_discard' : 'paroliere_discard_privacy');
    }
  };

  const handleParoliereDiscard = (word) => {
    playDiscardSound(soundEnabled);
    triggerHaptic([35, 30, 35]);
    setDiscardedWord(word);
    setActiveGuesserSlot(1);
    setStagedChoice('');
    setPhase('players_pick_2');
  };

  const finalizeManche = (p1First, p1Final, p2First, p2Final) => {
    const scores = calculateMancheScores({
      targetWord,
      p1Initial: p1First,
      p1Final,
      p2Initial: p2First,
      p2Final,
    });

    onUpdateScores({
      [paroliere.id]: scores.paroliere.points,
      [guesser1.id]: scores.p1.points,
      [guesser2.id]: scores.p2.points,
    });

    const enriched = targetMeta || enrichWordMetadata(targetWord, '');
    onSaveMemoWord(enriched);
    setLearnedThisMatch((prev) => {
      if (prev.some((item) => normalizeWord(item.word) === normalizeWord(enriched.word))) {
        return prev;
      }
      return [...prev, enriched];
    });

    setRoundScoreReport(scores);
    if (scores.p1.wins || scores.p2.wins || scores.paroliere.points > 0) {
      playRevealWinSound(soundEnabled);
    }
    triggerHaptic([40, 50, 60]);
    setPhase('round_reveal');
  };

  const handleSlapConfirmPhase2 = () => {
    if (!stagedChoice) return;
    playSlapSound(soundEnabled);
    triggerHaptic(45);

    if (activeGuesserSlot === 1) {
      setP1Choice2(stagedChoice);
      setStagedChoice('');
      setActiveGuesserSlot(2);
    } else {
      const finalP2 = stagedChoice;
      setP2Choice2(finalP2);
      setStagedChoice('');
      finalizeManche(p1Choice1, p1Choice2, p2Choice1, finalP2);
    }
  };

  const handleInfractionConfirm = ({ offenderId, reason }) => {
    playInfractionSound(soundEnabled);
    triggerHaptic([80, 50, 80]);
    onApplyInfraction(offenderId);
    const offender = players.find((p) => p.id === offenderId);
    setInfractionReport({
      offenderName: offender?.name || 'Giocatore',
      offenderColor: offender?.color || '#E11D48',
      reason,
    });
    setPhase('round_cancelled');
  };

  const handleNextManche = () => {
    if (totalRounds > 0 && mancheNumber >= totalRounds) {
      onMatchComplete();
      setPhase('match_over');
      return;
    }
    resetMancheState((paroliereIndex + 1) % players.length, mancheNumber + 1);
  };

  const handleFinishFreeMatch = () => {
    onMatchComplete();
    setPhase('match_over');
  };

  // Pre-compute Phase 2 / Discard helpers
  const discardInfo = getEligibleDiscardOptions(options, targetWord, p1Choice1, p2Choice1);
  const activeGuesser = activeGuesserSlot === 1 ? guesser1 : guesser2;
  const activeInitialChoice = activeGuesserSlot === 1 ? p1Choice1 : p2Choice1;
  const secondPickInfo = getPlayerSecondPickInfo(
    options,
    activeInitialChoice,
    discardedWord
  );

  // Pre-set staged choice in Phase 3 if the player isn't forced (can easily keep or change)
  useEffect(() => {
    if (phase === 'players_pick_2' && !activeGuesser.isBot) {
      if (secondPickInfo.canKeep) {
        setStagedChoice(activeInitialChoice);
      } else {
        setStagedChoice('');
      }
    }
  }, [phase, activeGuesserSlot, activeGuesser.isBot, secondPickInfo.canKeep, activeInitialChoice]);

  const sortedLeaderboard = [...players].sort((a, b) => b.score - a.score);
  const anyPlayerGuessed =
    roundScoreReport && (roundScoreReport.p1.wins || roundScoreReport.p2.wins);

  return (
    <div className="game-layout">
      <ConfettiBurst
        active={phase === 'match_over' || (phase === 'round_reveal' && anyPlayerGuessed)}
      />

      {/* Persistent Match HUD */}
      <section className="match-hud" aria-label="Stato della partita">
        <div className="hud-top-row">
          <div className="hud-round-pill">
            <span>
              Manche {mancheNumber}
              {totalRounds > 0 ? ` / ${totalRounds}` : ' (Libera)'}
            </span>
          </div>

          <div className="hud-actions">
            {isActiveManchePhase ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setInfractionOpen(true)}
              >
                <AlertTriangle size={16} aria-hidden="true" />
                <span>Infrazione (−1)</span>
              </button>
            ) : null}
            {totalRounds === 0 &&
            (phase === 'round_reveal' || phase === 'round_cancelled') ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleFinishFreeMatch}
              >
                <Trophy size={16} aria-hidden="true" />
                <span>Chiudi Partita</span>
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onExitMatch}
            >
              Esci
            </button>
          </div>
        </div>

        <div className="scoreboard-strip">
          {players.map((player) => {
            const isParoliere = player.id === paroliere.id;
            const isActiveTurn =
              (phase === 'paroliere_setup' || phase === 'paroliere_discard')
                ? isParoliere
                : (phase === 'players_pick_1' || phase === 'players_pick_2') &&
                  player.id === activeGuesser.id;

            return (
              <div
                key={player.id}
                className={`score-tile ${isParoliere ? 'is-paroliere' : ''} ${
                  isActiveTurn ? 'is-turn' : ''
                }`}
                style={{ '--player-color': player.color }}
              >
                <div className="score-tile-top">
                  <span className="player-name-tag">
                    {player.isBot ? <Bot size={14} aria-hidden="true" /> : null}
                    <span>{player.name}</span>
                  </span>
                  <span className="role-pill">
                    {isParoliere ? 'Paroliere' : 'Giocatore'}
                  </span>
                </div>
                <div className="score-value">{player.score} pt</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PHASE: Paroliere Privacy Shield */}
      {phase === 'paroliere_privacy' ? (
        <section className="stage-card privacy-card">
          <div className="privacy-icon-circle" aria-hidden="true">
            <EyeOff size={34} />
          </div>
          <h2 className="stage-title">Turno segreto del Paroliere</h2>
          {paroliere.isBot ? (
            <p className="stage-desc">
              <strong>{paroliere.name}</strong> (Bot IA) sta scegliendo 1 parola
              inglese e 4 distrattori non sinonimi...
            </p>
          ) : (
            <>
              <p className="stage-desc">
                Passa lo schermo a <strong>{paroliere.name}</strong>. Gli altri due
                giocatori (<strong>{guesser1.name}</strong> e{' '}
                <strong>{guesser2.name}</strong>) non devono guardare!
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => setPhase('paroliere_setup')}
              >
                <Eye size={20} aria-hidden="true" />
                <span>Sono {paroliere.name}, scegli le parole</span>
              </button>
            </>
          )}
        </section>
      ) : null}

      {/* PHASE: Paroliere Word Setup */}
      {phase === 'paroliere_setup' ? (
        <ParoliereSetupForm
          paroliereName={paroliere.name}
          kickerText="Fase 1 · Segreta"
          submitLabel="Mischia e Mostra le 5 Opzioni"
          levelFilter={levelFilter}
          usedWords={usedWords}
          soundEnabled={soundEnabled}
          onSubmitSetup={handleConfirmParoliereSetup}
        />
      ) : null}

      {/* PHASE: Table Handoff */}
      {phase === 'table_handoff' ? (
        <section className="stage-card privacy-card">
          <div className="privacy-icon-circle accent-blue" aria-hidden="true">
            <Sparkles size={32} />
          </div>
          <h2 className="stage-title">Le 5 opzioni sono pronte!</h2>
          <p className="stage-desc">
            Appoggia il dispositivo sul tavolo al centro tra{' '}
            <strong>{guesser1.name}</strong> e <strong>{guesser2.name}</strong>.
            La parola segreta è nascosta!
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              setActiveGuesserSlot(1);
              setStagedChoice('');
              setPhase('players_pick_1');
            }}
          >
            <span>Mostra le 5 Parole al Tavolo</span>
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </section>
      ) : null}

      {/* PHASE: Players First Pick */}
      {phase === 'players_pick_1' ? (
        <section className="stage-card">
          <div className="stage-header-row">
            <div>
              <span className="phase-kicker">Fase 2 · Prima Scelta</span>
              <h2 className="stage-title">
                {activeGuesser.name}, scegli la tua parola inglese
              </h2>
              <p className="helper-note">
                Indovinando subito senza mai cambiare guadagni{' '}
                <strong>+3 punti</strong>!
              </p>
            </div>
          </div>

          {targetMeta?.it ? (
            <div className="italian-clue-banner" role="note">
              <span className="clue-kicker">🇮🇹 Parola in italiano da tradurre:</span>
              <strong className="clue-word">{targetMeta.it}</strong>
            </div>
          ) : null}

          <div className="word-cards-grid">
            {options.map((word) => {
              const isStaged = stagedChoice === word;
              const pickedByP1 = p1Choice1 === word;
              const pickedByP2 = p2Choice1 === word;

              return (
                <div
                  key={word}
                  className={`word-card-shell ${isStaged ? 'is-staged' : ''}`}
                  style={{ '--active-color': activeGuesser.color }}
                >
                  <button
                    type="button"
                    className="word-card-btn"
                    disabled={activeGuesser.isBot}
                    aria-pressed={isStaged}
                    onClick={() => handleSelectWordCard(word)}
                  >
                    <span className="word-card-text" lang="en">
                      {word}
                    </span>
                    <div className="word-card-badges">
                      {pickedByP1 ? (
                        <span
                          className="choice-chip"
                          style={{ '--chip-color': guesser1.color }}
                        >
                          <Lock size={11} aria-hidden="true" />
                          <span>{guesser1.name}</span>
                        </span>
                      ) : null}
                      {pickedByP2 ? (
                        <span
                          className="choice-chip"
                          style={{ '--chip-color': guesser2.color }}
                        >
                          <Lock size={11} aria-hidden="true" />
                          <span>{guesser2.name}</span>
                        </span>
                      ) : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="speak-word-btn"
                    onClick={() => speakEnglishWord(word)}
                    aria-label={`Ascolta pronuncia di ${word}`}
                    title="Pronuncia inglese"
                  >
                    <Volume2 size={17} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          {!activeGuesser.isBot ? (
            <SlapPad
              playerName={activeGuesser.name}
              playerColor={activeGuesser.color}
              selectedWord={stagedChoice}
              micClapEnabled={micClapEnabled}
              onToggleMicClap={onToggleMicClap}
              onSlapConfirm={handleSlapConfirmPhase1}
            />
          ) : (
            <div className="bot-thinking-bar" role="status">
              <Bot size={18} aria-hidden="true" />
              <span>{activeGuesser.name} sta decidendo e battendo sul tavolo...</span>
            </div>
          )}
        </section>
      ) : null}

      {/* PHASE: Paroliere Discard Privacy Curtain */}
      {phase === 'paroliere_discard_privacy' ? (
        <section className="stage-card privacy-card">
          <div className="privacy-icon-circle" aria-hidden="true">
            <EyeOff size={34} />
          </div>
          <h2 className="stage-title">Scarto del Paroliere</h2>
          <p className="stage-desc">
            Entrambi i giocatori hanno battuto la mano! Passa un secondo lo schermo a{' '}
            <strong>{paroliere.name}</strong> per scartare una parola senza mostrare la
            parola segreta.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => setPhase('paroliere_discard')}
          >
            <Eye size={20} aria-hidden="true" />
            <span>Sono {paroliere.name}, scegli lo scarto</span>
          </button>
        </section>
      ) : null}

      {/* PHASE: Paroliere Discard */}
      {phase === 'paroliere_discard' ? (
        <section className="stage-card">
          <div className="stage-header-row">
            <div>
              <span className="phase-kicker">Fase 3 · Lo Scarto</span>
              <h2 className="stage-title">
                {paroliere.name}, scarta 1 parola
              </h2>
              <p className="helper-note">
                {discardInfo.mode === 'player_choice'
                  ? 'Regola: devi scartare una delle parole scelte dai giocatori (non quella segreta).'
                  : 'Entrambi hanno scelto la parola segreta! Scarta una delle altre parole non scelte.'}
              </p>
            </div>
              <div className="secret-reminder-pill">
              <Lock size={14} aria-hidden="true" />
              <span>Segreta: {targetWord}</span>
            </div>
          </div>

          {targetMeta?.it ? (
            <div className="italian-clue-banner" role="note">
              <span className="clue-kicker">🇮🇹 Parola in italiano da tradurre:</span>
              <strong className="clue-word">{targetMeta.it}</strong>
            </div>
          ) : null}

          {paroliere.isBot ? (
            <div className="bot-thinking-bar" role="status">
              <Bot size={18} aria-hidden="true" />
              <span>{paroliere.name} sta scegliendo quale parola scartare...</span>
            </div>
          ) : (
            <div className="word-cards-grid">
              {options.map((word) => {
                const isTarget = normalizeWord(word) === normalizeWord(targetWord);
                const isEligible = discardInfo.eligible.includes(word);
                const pickedByP1 = p1Choice1 === word;
                const pickedByP2 = p2Choice1 === word;

                return (
                  <div
                    key={word}
                    className={`word-card-shell ${
                      isTarget ? 'is-secret-target' : ''
                    } ${!isEligible ? 'is-disabled-card' : 'is-discardable'}`}
                  >
                    <button
                      type="button"
                      className="word-card-btn"
                      disabled={!isEligible}
                      onClick={() => handleParoliereDiscard(word)}
                    >
                      <span className="word-card-text" lang="en">
                        {word}
                      </span>
                      <div className="word-card-badges">
                        {isTarget ? (
                          <span className="secret-chip">
                            <Lock size={11} aria-hidden="true" />
                            <span>Segreta</span>
                          </span>
                        ) : null}
                        {pickedByP1 ? (
                          <span
                            className="choice-chip"
                            style={{ '--chip-color': guesser1.color }}
                          >
                            {guesser1.name}
                          </span>
                        ) : null}
                        {pickedByP2 ? (
                          <span
                            className="choice-chip"
                            style={{ '--chip-color': guesser2.color }}
                          >
                            {guesser2.name}
                          </span>
                        ) : null}
                      </div>
                      {isEligible ? (
                        <span className="discard-cta-label">Tocca per scartare</span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* PHASE: Players Second Pick (Switch or Keep) */}
      {phase === 'players_pick_2' ? (
        <section className="stage-card">
          <div className="stage-header-row">
            <div>
              <span className="phase-kicker">Fase 4 · Cambio dopo lo Scarto</span>
              <h2 className="stage-title">
                {activeGuesser.name}, conferma o cambia parola
              </h2>
              <p className="helper-note">
                {secondPickInfo.isForced ? (
                  <span className="forced-notice">
                    ⚠️ La tua parola (<strong>{activeInitialChoice}</strong>) è stata
                    scartata! Sei costretto a sceglierne un&apos;altra (+1 pt se
                    indovini).
                  </span>
                ) : (
                  <span>
                    La tua scelta (<strong>{activeInitialChoice}</strong>) è ancora in
                    gioco: mantienila per <strong>+3 pt</strong>, oppure cambiala per{' '}
                    <strong>+1 pt</strong>!
                  </span>
                )}
              </p>
            </div>
          </div>

          {targetMeta?.it ? (
            <div className="italian-clue-banner" role="note">
              <span className="clue-kicker">🇮🇹 Parola in italiano da tradurre:</span>
              <strong className="clue-word">{targetMeta.it}</strong>
            </div>
          ) : null}

          <div className="word-cards-grid">
            {options.map((word) => {
              const isDiscarded = word === discardedWord;
              const isStaged = stagedChoice === word;
              const wasOwnInitial = word === activeInitialChoice;
              const lockedP2From1 =
                activeGuesserSlot === 1 && p2Choice1 === word && !isDiscarded;
              const lockedP1Final = activeGuesserSlot === 2 && p1Choice2 === word;

              return (
                <div
                  key={word}
                  className={`word-card-shell ${
                    isDiscarded ? 'is-discarded' : ''
                  } ${isStaged ? 'is-staged' : ''}`}
                  style={{ '--active-color': activeGuesser.color }}
                >
                  <button
                    type="button"
                    className="word-card-btn"
                    disabled={isDiscarded || activeGuesser.isBot}
                    aria-pressed={isStaged}
                    onClick={() => handleSelectWordCard(word)}
                  >
                    <span className="word-card-text" lang="en">
                      {word}
                    </span>

                    <div className="word-card-badges">
                      {isDiscarded ? (
                        <span className="discarded-chip">
                          <XCircle size={12} aria-hidden="true" />
                          <span>SCARTATA</span>
                        </span>
                      ) : null}
                      {wasOwnInitial && !isDiscarded ? (
                        <span className="keep-chip">Tua 1ª (+3 pt)</span>
                      ) : null}
                      {lockedP2From1 ? (
                        <span
                          className="choice-chip"
                          style={{ '--chip-color': guesser2.color }}
                        >
                          1ª di {guesser2.name}
                        </span>
                      ) : null}
                      {lockedP1Final ? (
                        <span
                          className="choice-chip"
                          style={{ '--chip-color': guesser1.color }}
                        >
                          <Lock size={11} aria-hidden="true" />
                          <span>{guesser1.name}</span>
                        </span>
                      ) : null}
                    </div>
                  </button>

                  {!isDiscarded ? (
                    <button
                      type="button"
                      className="speak-word-btn"
                      onClick={() => speakEnglishWord(word)}
                      aria-label={`Ascolta pronuncia di ${word}`}
                      title="Pronuncia inglese"
                    >
                      <Volume2 size={17} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!activeGuesser.isBot ? (
            <SlapPad
              playerName={activeGuesser.name}
              playerColor={activeGuesser.color}
              selectedWord={stagedChoice}
              micClapEnabled={micClapEnabled}
              onToggleMicClap={onToggleMicClap}
              onSlapConfirm={handleSlapConfirmPhase2}
            />
          ) : (
            <div className="bot-thinking-bar" role="status">
              <Bot size={18} aria-hidden="true" />
              <span>{activeGuesser.name} sta decidendo se mantenere o cambiare...</span>
            </div>
          )}
        </section>
      ) : null}

      {/* PHASE: Round Reveal & Vocabulary Learning */}
      {phase === 'round_reveal' && roundScoreReport ? (
        <section className="stage-card reveal-card">
          <div className="reveal-spotlight">
            <span className="phase-kicker">Parola Segreta Svelata</span>
            <div className="reveal-word-header">
              <h2 className="reveal-word" lang="en">
                {targetMeta?.word || targetWord}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => speakEnglishWord(targetWord)}
              >
                <Volume2 size={18} aria-hidden="true" />
                <span>Ascolta</span>
              </button>
            </div>
            {targetMeta?.ipa ? (
              <p className="reveal-ipa">
                {targetMeta.ipa} · <span>{targetMeta.pos}</span> ·{' '}
                <span>{targetMeta.level}</span>
              </p>
            ) : null}
            <p className="reveal-translation">{targetMeta?.it}</p>
            {targetMeta?.example ? (
              <p className="reveal-example" lang="en">
                “{targetMeta.example}”
              </p>
            ) : null}
            <span className="saved-memo-pill">
              <Check size={14} aria-hidden="true" />
              <span>Salvata automaticamente in Memo Parole</span>
            </span>
          </div>

          <div className="round-results-list">
            <div
              className="result-row"
              style={{ '--player-color': guesser1.color }}
            >
              <div className="result-player-info">
                <strong>{guesser1.name}</strong> (Giocatore)
                <span className="result-path">
                  1ª: {p1Choice1} → Finale: <strong>{p1Choice2}</strong>
                </span>
                <span className="result-reason">{roundScoreReport.p1.reason}</span>
              </div>
              <span
                className={`pts-pill ${
                  roundScoreReport.p1.points === 3
                    ? 'pts-3'
                    : roundScoreReport.p1.points === 1
                    ? 'pts-1'
                    : 'pts-0'
                }`}
              >
                +{roundScoreReport.p1.points} pt
              </span>
            </div>

            <div
              className="result-row"
              style={{ '--player-color': guesser2.color }}
            >
              <div className="result-player-info">
                <strong>{guesser2.name}</strong> (Giocatore)
                <span className="result-path">
                  1ª: {p2Choice1} → Finale: <strong>{p2Choice2}</strong>
                </span>
                <span className="result-reason">{roundScoreReport.p2.reason}</span>
              </div>
              <span
                className={`pts-pill ${
                  roundScoreReport.p2.points === 3
                    ? 'pts-3'
                    : roundScoreReport.p2.points === 1
                    ? 'pts-1'
                    : 'pts-0'
                }`}
              >
                +{roundScoreReport.p2.points} pt
              </span>
            </div>

            <div
              className="result-row"
              style={{ '--player-color': paroliere.color }}
            >
              <div className="result-player-info">
                <strong>{paroliere.name}</strong> (Paroliere)
                <span className="result-path">Scarto effettuato: {discardedWord}</span>
                <span className="result-reason">
                  {roundScoreReport.paroliere.reason}
                </span>
              </div>
              <span
                className={`pts-pill ${
                  roundScoreReport.paroliere.points === 3
                    ? 'pts-3'
                    : roundScoreReport.paroliere.points === 1
                    ? 'pts-1'
                    : 'pts-0'
                }`}
              >
                +{roundScoreReport.paroliere.points} pt
              </span>
            </div>
          </div>

          <div className="form-submit-row">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleNextManche}
            >
              <span>
                {totalRounds > 0 && mancheNumber >= totalRounds
                  ? 'Vedi Classifica Finale'
                  : 'Prossima Manche (Ruota Paroliere)'}
              </span>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {/* PHASE: Round Cancelled due to Infraction */}
      {phase === 'round_cancelled' && infractionReport ? (
        <section className="stage-card cancelled-card">
          <div className="cancelled-icon" aria-hidden="true">
            <AlertTriangle size={36} />
          </div>
          <h2 className="stage-title">Manche Annullata per Infrazione</h2>
          <p className="stage-desc">
            <strong>{infractionReport.offenderName}</strong> ha ricevuto una
            penalità di <strong>−1 punto</strong>.
          </p>
          <p className="cancelled-reason">Motivo: {infractionReport.reason}</p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handleNextManche}
          >
            <span>
              {totalRounds > 0 && mancheNumber >= totalRounds
                ? 'Vedi Classifica Finale'
                : 'Prossima Manche'}
            </span>
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </section>
      ) : null}

      {/* PHASE: Final Podium */}
      {phase === 'match_over' ? (
        <section className="stage-card podium-card">
          <div className="podium-header">
            <Trophy size={42} className="trophy-gold" aria-hidden="true" />
            <h2 className="stage-title">Partita Conclusa!</h2>
            <p className="stage-desc">
              Vincitore:{' '}
              <strong>{sortedLeaderboard[0]?.name}</strong> con{' '}
              <strong>{sortedLeaderboard[0]?.score} punti</strong>!
            </p>
          </div>

          <ol className="podium-list">
            {sortedLeaderboard.map((player, idx) => (
              <li
                key={player.id}
                className={`podium-row rank-${idx + 1}`}
                style={{ '--player-color': player.color }}
              >
                <span className="podium-rank">#{idx + 1}</span>
                <span className="podium-name">{player.name}</span>
                <span className="podium-score">{player.score} pt</span>
              </li>
            ))}
          </ol>

          {learnedThisMatch.length > 0 ? (
            <div className="learned-recap">
              <h3 className="subsection-title">
                Parole inglesi viste in questa partita ({learnedThisMatch.length})
              </h3>
              <ul className="learned-recap-list">
                {learnedThisMatch.map((item) => (
                  <li key={item.word} className="learned-recap-chip">
                    <span lang="en">
                      <strong>{item.word}</strong> — {item.it}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => speakEnglishWord(item.word)}
                      aria-label={`Ascolta ${item.word}`}
                    >
                      <Volume2 size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="podium-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                onRestartMatch();
                resetMancheState(0, 1);
                setUsedWords([]);
                setLearnedThisMatch([]);
              }}
            >
              <RotateCcw size={18} aria-hidden="true" />
              <span>Rivincita</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-lg"
              onClick={onExitMatch}
            >
              <RefreshCw size={18} aria-hidden="true" />
              <span>Torna alla Home</span>
            </button>
          </div>
        </section>
      ) : null}

      <InfractionDialog
        open={infractionOpen}
        onClose={() => setInfractionOpen(false)}
        players={players}
        paroliereId={paroliere.id}
        onConfirmInfraction={handleInfractionConfirm}
      />
    </div>
  );
}
