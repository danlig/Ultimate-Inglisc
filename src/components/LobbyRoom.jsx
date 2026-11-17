import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  Copy,
  Crown,
  Hourglass,
  Lock,
  LogOut,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
  Trophy,
  UserPlus,
  Volume2,
  Wifi,
  XCircle,
} from 'lucide-react';
import {
  getPlayerSecondPickInfo,
  normalizeWord,
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

export default function LobbyRoom({
  room,
  networkInfo,
  error,
  soundEnabled,
  micClapEnabled,
  onToggleMicClap,
  onLeaveLobby,
  onAddBot,
  onRemoveBot,
  onStartMatch,
  onSubmitParoliereSetup,
  onSubmitPick1,
  onSubmitDiscard,
  onSubmitPick2,
  onSubmitInfraction,
  onNextManche,
  onFinishFreeMatch,
  onRestartMatch,
  onSaveMemoWord,
}) {
  const [stagedChoice, setStagedChoice] = useState('');
  const [infractionOpen, setInfractionOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [savedWordKey, setSavedWordKey] = useState('');

  const manche = room.manche;
  const phase = manche?.phase || 'waiting';

  // Reset per-phase local selection cleanly when phase or manche changes
  useEffect(() => {
    setStagedChoice('');
  }, [room.mancheNumber, phase]);

  // Save revealed word to this device's Memo Parole automatically
  useEffect(() => {
    if (phase === 'round_reveal' && manche?.targetWord) {
      const key = `${room.code}-${room.mancheNumber}-${manche.targetWord}`;
      if (savedWordKey !== key) {
        setSavedWordKey(key);
        if (manche.targetMeta) {
          onSaveMemoWord(manche.targetMeta);
        }
        if (
          manche.scoreReport?.p1?.wins ||
          manche.scoreReport?.p2?.wins ||
          manche.scoreReport?.paroliere?.points > 0
        ) {
          playRevealWinSound(soundEnabled);
        }
        triggerHaptic([40, 50, 60]);
      }
    }
  }, [
    phase,
    manche?.targetWord,
    manche?.targetMeta,
    manche?.scoreReport,
    room.code,
    room.mancheNumber,
    savedWordKey,
    onSaveMemoWord,
    soundEnabled,
  ]);

  useEffect(() => {
    if (phase === 'round_cancelled') {
      playInfractionSound(soundEnabled);
      triggerHaptic([80, 50, 80]);
    }
  }, [phase, soundEnabled]);

  const roles = room.roles || {};
  const myId = room.myPlayerId;
  const isParoliere = myId === roles.paroliereId;
  const isG1 = myId === roles.guesser1Id;
  const isG2 = myId === roles.guesser2Id;
  const isGuesser = isG1 || isG2;

  const paroliere = room.players.find((p) => p.id === roles.paroliereId);
  const guesser1 = room.players.find((p) => p.id === roles.guesser1Id);
  const guesser2 = room.players.find((p) => p.id === roles.guesser2Id);
  const me = room.players.find((p) => p.id === myId);

  const myLocked1 = isG1 ? manche?.p1Locked1 : isG2 ? manche?.p2Locked1 : false;
  const myChoice1 = isG1 ? manche?.p1Choice1 : isG2 ? manche?.p2Choice1 : null;
  const myLocked2 = isG1 ? manche?.p1Locked2 : isG2 ? manche?.p2Locked2 : false;

  const secondPickInfo =
    isGuesser && manche?.discardedWord && myChoice1
      ? getPlayerSecondPickInfo(manche.options, myChoice1, manche.discardedWord)
      : null;

  useEffect(() => {
    if (
      phase === 'players_pick_2' &&
      isGuesser &&
      !myLocked2 &&
      secondPickInfo?.canKeep &&
      myChoice1
    ) {
      setStagedChoice(myChoice1);
    }
  }, [phase, isGuesser, myLocked2, secondPickInfo?.canKeep, myChoice1]);

  const shareUrl =
    networkInfo?.lanUrls?.[0] ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const handleCopyInvite = async () => {
    const text = `Unisciti a "${room.name}" su ThE InGliSc GaMe!\nLink: ${shareUrl}\nCodice Lobby: ${room.code}`;
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore
    }
  };

  // --- WAITING ROOM ---
  if (room.status === 'waiting') {
    const canStart = room.players.length === 3 && room.isHost;

    return (
      <div className="game-layout">
        <section className="stage-card">
          <div className="stage-header-row">
            <div>
              <span className="phase-kicker">Lobby Rete Locale</span>
              <h2 className="stage-title">{room.name}</h2>
              <p className="helper-note">
                {room.totalRounds > 0 ? `${room.totalRounds} manches` : 'Partita Libera'}{' '}
                · Livello: {room.levelFilter}
              </p>
            </div>

            <div className="hud-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyInvite}
              >
                {copiedCode ? (
                  <>
                    <Check size={16} aria-hidden="true" />
                    <span>Invito copiato</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} aria-hidden="true" />
                    <span>Codice: {room.code}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onLeaveLobby}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>Esci</span>
              </button>
            </div>
          </div>

          {shareUrl ? (
            <div className="lan-share-box">
              <div className="lan-share-label">
                <Wifi size={15} aria-hidden="true" />
                <span>
                  Gli altri giocatori aprono <strong>{shareUrl}</strong> e inseriscono il
                  codice <strong>{room.code}</strong>
                </span>
              </div>
            </div>
          ) : null}

          <div className="waiting-seats-grid">
            {[0, 1, 2].map((slotIdx) => {
              const p = room.players[slotIdx];
              if (!p) {
                return (
                  <div key={slotIdx} className="seat-card is-empty">
                    <span className="seat-slot-label">Posto {slotIdx + 1}</span>
                    <span className="seat-waiting-text">In attesa di giocatore...</span>
                    {room.isHost ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={onAddBot}
                      >
                        <UserPlus size={15} aria-hidden="true" />
                        <span>+ Aggiungi Bot IA</span>
                      </button>
                    ) : null}
                  </div>
                );
              }

              return (
                <div
                  key={p.id}
                  className="seat-card is-filled"
                  style={{ '--player-color': p.color }}
                >
                  <div className="seat-top-row">
                    <span className="seat-player-name">
                      {p.isBot ? <Bot size={16} aria-hidden="true" /> : null}
                      <span>{p.name}</span>
                      {p.id === myId ? ' (Tu)' : ''}
                    </span>
                    {p.isHost ? (
                      <span className="host-badge">
                        <Crown size={12} aria-hidden="true" />
                        <span>Host</span>
                      </span>
                    ) : null}
                  </div>

                  <div className="seat-bottom-row">
                    <span
                      className={`conn-dot-label ${
                        p.connected ? 'is-on' : 'is-off'
                      }`}
                    >
                      {p.isBot ? 'Bot IA' : p.connected ? 'Online' : 'Disconnesso'}
                    </span>
                    {room.isHost && p.isBot ? (
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => onRemoveBot(p.id)}
                        aria-label={`Rimuovi ${p.name}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {error ? (
            <p className="error-banner" role="alert">
              {error}
            </p>
          ) : null}

          <div className="waiting-footer-actions">
            {room.isHost ? (
              <button
                type="button"
                disabled={!canStart}
                className="btn btn-primary btn-lg"
                onClick={onStartMatch}
              >
                <Play size={20} aria-hidden="true" />
                <span>
                  {room.players.length === 3
                    ? 'Avvia Partita!'
                    : `Servono 3 giocatori (${room.players.length}/3)`}
                </span>
              </button>
            ) : (
              <div className="bot-thinking-bar" role="status">
                <Hourglass size={18} aria-hidden="true" />
                <span>In attesa che l&apos;host avvii la partita...</span>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // --- ACTIVE MATCH OR FINISHED ---
  const sortedLeaderboard = [...room.players].sort((a, b) => b.score - a.score);
  const anyPlayerGuessed =
    manche?.scoreReport &&
    (manche.scoreReport.p1.wins || manche.scoreReport.p2.wins);

  const isActiveManchePhase =
    room.status === 'playing' &&
    phase !== 'round_reveal' &&
    phase !== 'round_cancelled';

  const handleParoliereFormSubmit = ({ targetWord, translation, distractors }) => {
    if (!targetWord.trim() || distractors.some((d) => !d.trim())) {
      return 'Compila la parola segreta e tutte e 4 le altre parole.';
    }
    playSelectSound(soundEnabled);
    onSubmitParoliereSetup({
      targetWord: targetWord.trim(),
      translation: translation.trim(),
      distractors: distractors.map((d) => d.trim()),
    });
    return '';
  };

  const handleSlapPhase1 = () => {
    if (!stagedChoice) return;
    playSlapSound(soundEnabled);
    triggerHaptic(45);
    onSubmitPick1(stagedChoice);
  };

  const handleSlapPhase2 = () => {
    if (!stagedChoice) return;
    playSlapSound(soundEnabled);
    triggerHaptic(45);
    onSubmitPick2(stagedChoice);
  };

  const handleDiscardClick = (word) => {
    playDiscardSound(soundEnabled);
    triggerHaptic([35, 30, 35]);
    onSubmitDiscard(word);
  };

  return (
    <div className="game-layout">
      <ConfettiBurst
        active={
          room.status === 'finished' ||
          (phase === 'round_reveal' && anyPlayerGuessed)
        }
      />

      {/* Persistent Match HUD */}
      <section className="match-hud" aria-label="Stato partita in rete locale">
        <div className="hud-top-row">
          <div className="hud-round-pill">
            <span>
              {room.name} ({room.code}) · Manche {room.mancheNumber}
              {room.totalRounds > 0 ? ` / ${room.totalRounds}` : ' (Libera)'}
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
            {room.status === 'playing' &&
            room.totalRounds === 0 &&
            room.isHost &&
            (phase === 'round_reveal' || phase === 'round_cancelled') ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onFinishFreeMatch}
              >
                <Trophy size={16} aria-hidden="true" />
                <span>Chiudi Partita</span>
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onLeaveLobby}
            >
              Esci
            </button>
          </div>
        </div>

        <div className="scoreboard-strip">
          {room.players.map((player) => {
            const pIsParoliere = player.id === roles.paroliereId;
            const isMe = player.id === myId;
            return (
              <div
                key={player.id}
                className={`score-tile ${pIsParoliere ? 'is-paroliere' : ''} ${
                  isMe ? 'is-turn' : ''
                }`}
                style={{ '--player-color': player.color }}
              >
                <div className="score-tile-top">
                  <span className="player-name-tag">
                    {player.isBot ? <Bot size={14} aria-hidden="true" /> : null}
                    <span>
                      {player.name}
                      {isMe ? ' (Tu)' : ''}
                    </span>
                  </span>
                  <span className="role-pill">
                    {pIsParoliere ? 'Paroliere' : 'Giocatore'}
                  </span>
                </div>
                <div className="score-value">{player.score} pt</div>
              </div>
            );
          })}
        </div>
      </section>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      {/* FINISHED PODIUM */}
      {room.status === 'finished' ? (
        <section className="stage-card podium-card">
          <div className="podium-header">
            <Trophy size={42} className="trophy-gold" aria-hidden="true" />
            <h2 className="stage-title">Partita Conclusa!</h2>
            <p className="stage-desc">
              Vincitore: <strong>{sortedLeaderboard[0]?.name}</strong> con{' '}
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
                <span className="podium-name">
                  {player.name}
                  {player.id === myId ? ' (Tu)' : ''}
                </span>
                <span className="podium-score">{player.score} pt</span>
              </li>
            ))}
          </ol>

          {room.learnedWords?.length > 0 ? (
            <div className="learned-recap">
              <h3 className="subsection-title">
                Parole inglesi imparate ({room.learnedWords.length})
              </h3>
              <ul className="learned-recap-list">
                {room.learnedWords.map((item) => (
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
            {room.isHost ? (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={onRestartMatch}
              >
                <RotateCcw size={18} aria-hidden="true" />
                <span>Rivincita</span>
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-lg"
              onClick={onLeaveLobby}
            >
              <RefreshCw size={18} aria-hidden="true" />
              <span>Torna alle Lobby</span>
            </button>
          </div>
        </section>
      ) : null}

      {/* PHASE 1: PAROLIERE SETUP */}
      {room.status === 'playing' && phase === 'paroliere_setup' ? (
        isParoliere ? (
          <ParoliereSetupForm
            paroliereName={me?.name || 'Paroliere'}
            kickerText="Sei il Paroliere"
            submitLabel="Invia le 5 Opzioni ai Giocatori"
            levelFilter={room.levelFilter}
            soundEnabled={soundEnabled}
            externalError={error}
            onSubmitSetup={handleParoliereFormSubmit}
          />
        ) : (
          <section className="stage-card privacy-card">
            <div className="privacy-icon-circle accent-blue" aria-hidden="true">
              <Hourglass size={32} />
            </div>
            <h2 className="stage-title">
              {paroliere?.name} sta preparando le 5 parole...
            </h2>
            <p className="stage-desc">
              Sei un <strong>Giocatore</strong> in questa manche. Appena{' '}
              <strong>{paroliere?.name}</strong> invierà le 5 opzioni, compariranno qui
              sul tuo schermo!
            </p>
          </section>
        )
      ) : null}

      {/* PHASE 2: PLAYERS PICK 1 */}
      {room.status === 'playing' && phase === 'players_pick_1' ? (
        <section className="stage-card">
          <div className="stage-header-row">
            <div>
              <span className="phase-kicker">Fase 2 · Prima Scelta</span>
              <h2 className="stage-title">
                {isParoliere
                  ? 'I giocatori stanno scegliendo...'
                  : myLocked1
                  ? 'Scelta confermata! Attendi gli altri'
                  : 'Scegli la tua parola e batti la mano'}
              </h2>
            </div>
            {isParoliere && manche?.targetWord ? (
              <div className="secret-reminder-pill">
                <Lock size={14} aria-hidden="true" />
                <span>Segreta: {manche.targetWord}</span>
              </div>
            ) : null}
          </div>

          <div className="status-pills-row">
            <span
              className={`lock-status-pill ${manche?.p1Locked1 ? 'is-done' : ''}`}
            >
              {manche?.p1Locked1 ? '✓' : '⏳'} {guesser1?.name}
            </span>
            <span
              className={`lock-status-pill ${manche?.p2Locked1 ? 'is-done' : ''}`}
            >
              {manche?.p2Locked1 ? '✓' : '⏳'} {guesser2?.name}
            </span>
          </div>

          {manche?.targetClueIt ? (
            <div className="italian-clue-banner" role="note">
              <span className="clue-kicker">🇮🇹 Parola in italiano da tradurre:</span>
              <strong className="clue-word">{manche.targetClueIt}</strong>
            </div>
          ) : null}

          <div className="word-cards-grid">
            {manche.options.map((word) => {
              const isStaged = stagedChoice === word;
              const isMyLockedPick = myLocked1 && myChoice1 === word;
              const isSecret =
                isParoliere &&
                normalizeWord(word) === normalizeWord(manche.targetWord);

              return (
                <div
                  key={word}
                  className={`word-card-shell ${
                    isStaged || isMyLockedPick ? 'is-staged' : ''
                  } ${isSecret ? 'is-secret-target' : ''}`}
                  style={{ '--active-color': me?.color }}
                >
                  <button
                    type="button"
                    className="word-card-btn"
                    disabled={!isGuesser || myLocked1}
                    aria-pressed={isStaged || isMyLockedPick}
                    onClick={() => {
                      setStagedChoice(word);
                      playSelectSound(soundEnabled);
                    }}
                  >
                    <span className="word-card-text" lang="en">
                      {word}
                    </span>
                    <div className="word-card-badges">
                      {isSecret ? (
                        <span className="secret-chip">
                          <Lock size={11} aria-hidden="true" />
                          <span>Segreta</span>
                        </span>
                      ) : null}
                      {isMyLockedPick ? (
                        <span
                          className="choice-chip"
                          style={{ '--chip-color': me?.color }}
                        >
                          <Lock size={11} aria-hidden="true" />
                          <span>La tua scelta</span>
                        </span>
                      ) : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="speak-word-btn"
                    onClick={() => speakEnglishWord(word)}
                    aria-label={`Ascolta pronuncia di ${word}`}
                  >
                    <Volume2 size={17} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          {isGuesser && !myLocked1 ? (
            <SlapPad
              playerName={me?.name}
              playerColor={me?.color}
              selectedWord={stagedChoice}
              micClapEnabled={micClapEnabled}
              onToggleMicClap={onToggleMicClap}
              onSlapConfirm={handleSlapPhase1}
            />
          ) : (
            <div className="bot-thinking-bar" role="status">
              <Hourglass size={18} aria-hidden="true" />
              <span>
                {isParoliere
                  ? 'Attendi che entrambi i giocatori battano la mano...'
                  : 'Hai confermato la tua scelta! In attesa dell’altro giocatore...'}
              </span>
            </div>
          )}
        </section>
      ) : null}

      {/* PHASE 3: PAROLIERE DISCARD */}
      {room.status === 'playing' && phase === 'paroliere_discard' ? (
        <section className="stage-card">
          <div className="stage-header-row">
            <div>
              <span className="phase-kicker">Fase 3 · Lo Scarto</span>
              <h2 className="stage-title">
                {isParoliere
                  ? 'Tocca una parola da scartare'
                  : `${paroliere?.name} sta scegliendo lo scarto...`}
              </h2>
              <p className="helper-note">
                {isParoliere
                  ? manche.eligibleDiscards?.mode === 'player_choice'
                    ? 'Devi scartare una delle parole scelte dai giocatori (non la parola segreta).'
                    : 'Entrambi hanno scelto la parola segreta! Scarta una delle altre parole non scelte.'
                  : 'Vedi le prime scelte sul tavolo mentre il Paroliere decide quale parola eliminare.'}
              </p>
            </div>
            {isParoliere && manche?.targetWord ? (
              <div className="secret-reminder-pill">
                <Lock size={14} aria-hidden="true" />
                <span>Segreta: {manche.targetWord}</span>
              </div>
            ) : null}
          </div>

          {manche?.targetClueIt ? (
            <div className="italian-clue-banner" role="note">
              <span className="clue-kicker">🇮🇹 Parola in italiano da tradurre:</span>
              <strong className="clue-word">{manche.targetClueIt}</strong>
            </div>
          ) : null}

          <div className="word-cards-grid">
            {manche.options.map((word) => {
              const isSecret =
                isParoliere &&
                normalizeWord(word) === normalizeWord(manche.targetWord);
              const isEligible =
                isParoliere && manche.eligibleDiscards?.eligible.includes(word);
              const pickedByG1 = manche.p1Choice1 === word;
              const pickedByG2 = manche.p2Choice1 === word;

              return (
                <div
                  key={word}
                  className={`word-card-shell ${
                    isSecret ? 'is-secret-target' : ''
                  } ${
                    isParoliere
                      ? isEligible
                        ? 'is-discardable'
                        : 'is-disabled-card'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    className="word-card-btn"
                    disabled={!isEligible}
                    onClick={() => handleDiscardClick(word)}
                  >
                    <span className="word-card-text" lang="en">
                      {word}
                    </span>
                    <div className="word-card-badges">
                      {isSecret ? (
                        <span className="secret-chip">
                          <Lock size={11} aria-hidden="true" />
                          <span>Segreta</span>
                        </span>
                      ) : null}
                      {pickedByG1 ? (
                        <span
                          className="choice-chip"
                          style={{ '--chip-color': guesser1?.color }}
                        >
                          {guesser1?.name}
                        </span>
                      ) : null}
                      {pickedByG2 ? (
                        <span
                          className="choice-chip"
                          style={{ '--chip-color': guesser2?.color }}
                        >
                          {guesser2?.name}
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
        </section>
      ) : null}

      {/* PHASE 4: PLAYERS SECOND PICK */}
      {room.status === 'playing' && phase === 'players_pick_2' ? (
        <section className="stage-card">
          <div className="stage-header-row">
            <div>
              <span className="phase-kicker">Fase 4 · Cambio dopo lo Scarto</span>
              <h2 className="stage-title">
                {isParoliere
                  ? 'I giocatori stanno confermando la scelta finale...'
                  : myLocked2
                  ? 'Scelta finale confermata!'
                  : 'Conferma o cambia parola'}
              </h2>
              {isGuesser && !myLocked2 && secondPickInfo ? (
                <p className="helper-note">
                  {secondPickInfo.isForced ? (
                    <span className="forced-notice">
                      ⚠️ La tua parola (<strong>{myChoice1}</strong>) è stata
                      scartata! Sei costretto a sceglierne un&apos;altra (+1 pt se
                      indovini).
                    </span>
                  ) : (
                    <span>
                      La tua 1ª scelta (<strong>{myChoice1}</strong>) è salva:
                      mantienila per <strong>+3 pt</strong> oppure cambiala per{' '}
                      <strong>+1 pt</strong>!
                    </span>
                  )}
                </p>
              ) : null}
            </div>
          </div>

          <div className="status-pills-row">
            <span
              className={`lock-status-pill ${manche?.p1Locked2 ? 'is-done' : ''}`}
            >
              {manche?.p1Locked2 ? '✓' : '⏳'} {guesser1?.name}
            </span>
            <span
              className={`lock-status-pill ${manche?.p2Locked2 ? 'is-done' : ''}`}
            >
              {manche?.p2Locked2 ? '✓' : '⏳'} {guesser2?.name}
            </span>
          </div>

          {manche?.targetClueIt ? (
            <div className="italian-clue-banner" role="note">
              <span className="clue-kicker">🇮🇹 Parola in italiano da tradurre:</span>
              <strong className="clue-word">{manche.targetClueIt}</strong>
            </div>
          ) : null}

          <div className="word-cards-grid">
            {manche.options.map((word) => {
              const isDiscarded = word === manche.discardedWord;
              const isStaged = stagedChoice === word;
              const isOwnInitial = isGuesser && myChoice1 === word;
              const isSecret =
                isParoliere &&
                normalizeWord(word) === normalizeWord(manche.targetWord);

              return (
                <div
                  key={word}
                  className={`word-card-shell ${
                    isDiscarded ? 'is-discarded' : ''
                  } ${isStaged ? 'is-staged' : ''} ${
                    isSecret ? 'is-secret-target' : ''
                  }`}
                  style={{ '--active-color': me?.color }}
                >
                  <button
                    type="button"
                    className="word-card-btn"
                    disabled={isDiscarded || !isGuesser || myLocked2}
                    aria-pressed={isStaged}
                    onClick={() => {
                      setStagedChoice(word);
                      playSelectSound(soundEnabled);
                    }}
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
                      {isSecret ? (
                        <span className="secret-chip">
                          <Lock size={11} aria-hidden="true" />
                          <span>Segreta</span>
                        </span>
                      ) : null}
                      {isOwnInitial && !isDiscarded ? (
                        <span className="keep-chip">Tua 1ª (+3 pt)</span>
                      ) : null}
                    </div>
                  </button>
                  {!isDiscarded ? (
                    <button
                      type="button"
                      className="speak-word-btn"
                      onClick={() => speakEnglishWord(word)}
                      aria-label={`Ascolta pronuncia di ${word}`}
                    >
                      <Volume2 size={17} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {isGuesser && !myLocked2 ? (
            <SlapPad
              playerName={me?.name}
              playerColor={me?.color}
              selectedWord={stagedChoice}
              micClapEnabled={micClapEnabled}
              onToggleMicClap={onToggleMicClap}
              onSlapConfirm={handleSlapPhase2}
            />
          ) : (
            <div className="bot-thinking-bar" role="status">
              <Hourglass size={18} aria-hidden="true" />
              <span>
                {isParoliere
                  ? 'Attendi le conferme finali dei due giocatori...'
                  : 'Hai confermato! In attesa dell’altro giocatore...'}
              </span>
            </div>
          )}
        </section>
      ) : null}

      {/* PHASE 5: ROUND REVEAL */}
      {room.status === 'playing' &&
      phase === 'round_reveal' &&
      manche?.scoreReport ? (
        <section className="stage-card reveal-card">
          <div className="reveal-spotlight">
            <span className="phase-kicker">Parola Segreta Svelata</span>
            <div className="reveal-word-header">
              <h2 className="reveal-word" lang="en">
                {manche.targetMeta?.word || manche.targetWord}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => speakEnglishWord(manche.targetWord)}
              >
                <Volume2 size={18} aria-hidden="true" />
                <span>Ascolta</span>
              </button>
            </div>
            {manche.targetMeta?.ipa ? (
              <p className="reveal-ipa">
                {manche.targetMeta.ipa} · <span>{manche.targetMeta.pos}</span> ·{' '}
                <span>{manche.targetMeta.level}</span>
              </p>
            ) : null}
            <p className="reveal-translation">{manche.targetMeta?.it}</p>
            {manche.targetMeta?.example ? (
              <p className="reveal-example" lang="en">
                “{manche.targetMeta.example}”
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
              style={{ '--player-color': guesser1?.color }}
            >
              <div className="result-player-info">
                <strong>{guesser1?.name}</strong> (Giocatore)
                <span className="result-path">
                  1ª: {manche.p1Choice1} → Finale: <strong>{manche.p1Choice2}</strong>
                </span>
                <span className="result-reason">{manche.scoreReport.p1.reason}</span>
              </div>
              <span
                className={`pts-pill ${
                  manche.scoreReport.p1.points === 3
                    ? 'pts-3'
                    : manche.scoreReport.p1.points === 1
                    ? 'pts-1'
                    : 'pts-0'
                }`}
              >
                +{manche.scoreReport.p1.points} pt
              </span>
            </div>

            <div
              className="result-row"
              style={{ '--player-color': guesser2?.color }}
            >
              <div className="result-player-info">
                <strong>{guesser2?.name}</strong> (Giocatore)
                <span className="result-path">
                  1ª: {manche.p2Choice1} → Finale: <strong>{manche.p2Choice2}</strong>
                </span>
                <span className="result-reason">{manche.scoreReport.p2.reason}</span>
              </div>
              <span
                className={`pts-pill ${
                  manche.scoreReport.p2.points === 3
                    ? 'pts-3'
                    : manche.scoreReport.p2.points === 1
                    ? 'pts-1'
                    : 'pts-0'
                }`}
              >
                +{manche.scoreReport.p2.points} pt
              </span>
            </div>

            <div
              className="result-row"
              style={{ '--player-color': paroliere?.color }}
            >
              <div className="result-player-info">
                <strong>{paroliere?.name}</strong> (Paroliere)
                <span className="result-path">
                  Scarto effettuato: {manche.discardedWord}
                </span>
                <span className="result-reason">
                  {manche.scoreReport.paroliere.reason}
                </span>
              </div>
              <span
                className={`pts-pill ${
                  manche.scoreReport.paroliere.points === 3
                    ? 'pts-3'
                    : manche.scoreReport.paroliere.points === 1
                    ? 'pts-1'
                    : 'pts-0'
                }`}
              >
                +{manche.scoreReport.paroliere.points} pt
              </span>
            </div>
          </div>

          <div className="form-submit-row">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={onNextManche}
            >
              <span>
                {room.totalRounds > 0 && room.mancheNumber >= room.totalRounds
                  ? 'Vedi Classifica Finale'
                  : 'Prossima Manche (Ruota Paroliere)'}
              </span>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {/* ROUND CANCELLED (INFRACTION) */}
      {room.status === 'playing' &&
      phase === 'round_cancelled' &&
      manche?.infractionReport ? (
        <section className="stage-card cancelled-card">
          <div className="cancelled-icon" aria-hidden="true">
            <AlertTriangle size={36} />
          </div>
          <h2 className="stage-title">Manche Annullata per Infrazione</h2>
          <p className="stage-desc">
            <strong>{manche.infractionReport.offenderName}</strong> ha ricevuto una
            penalità di <strong>−1 punto</strong> (segnalata da{' '}
            {manche.infractionReport.calledBy}).
          </p>
          <p className="cancelled-reason">
            Motivo: {manche.infractionReport.reason}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={onNextManche}
          >
            <span>
              {room.totalRounds > 0 && room.mancheNumber >= room.totalRounds
                ? 'Vedi Classifica Finale'
                : 'Prossima Manche'}
            </span>
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </section>
      ) : null}

      <InfractionDialog
        open={infractionOpen}
        onClose={() => setInfractionOpen(false)}
        players={room.players}
        paroliereId={roles.paroliereId}
        onConfirmInfraction={(payload) => onSubmitInfraction(payload)}
      />
    </div>
  );
}
