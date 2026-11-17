import React from 'react';
import {
  BookOpen,
  BookmarkCheck,
  Bot,
  User,
  Play,
  Download,
  Sparkles,
  Trophy,
  Wifi,
} from 'lucide-react';

const ROUND_OPTIONS = [
  { value: 3, label: '3 Manches (1 giro)' },
  { value: 6, label: '6 Manches (2 giri)' },
  { value: 9, label: '9 Manches (3 giri)' },
  { value: 0, label: 'Partita Libera (∞)' },
];

const LEVEL_OPTIONS = ['Tutti', 'Base', 'Intermedio', 'Avanzato'];

export default function HomeView({
  players,
  onUpdatePlayer,
  totalRounds,
  onChangeTotalRounds,
  levelFilter,
  onChangeLevelFilter,
  onStartMatch,
  onOpenLobbies,
  lobbyCount,
  onOpenRules,
  onOpenMemo,
  memoCount,
  stats,
  canInstallPwa,
  onInstallPwa,
}) {
  const canStart = players.every((p) => p.name.trim().length > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (canStart) {
      onStartMatch();
    }
  };

  return (
    <div className="home-layout">
      <section className="hero-card">
        <div className="hero-pattern" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-mascot-wrap">
            <img
              src="/icons/mascot.png"
              alt="Mascotte di ThE InGliSc GaMe"
              width="104"
              height="104"
              className="hero-mascot"
            />
            <span className="hero-badge">PWA PARTY GAME</span>
          </div>

          <div className="hero-title-group">
            <p className="hero-eyebrow">Impara parole inglesi giocando</p>
            <h1 className="hero-title">
              <span className="title-the">ThE</span>{' '}
              <span className="title-englisc">
                <span aria-hidden="true">🇬🇧</span> InGliSc{' '}
                <span aria-hidden="true">🇬🇧</span>
              </span>{' '}
              <span className="title-game">GaMe</span>
            </h1>
            <p className="hero-lead">
              Un <strong>Paroliere</strong>, due <strong>Giocatori</strong>, cinque
              parole inglesi e un <strong>battito della mano</strong> irrevocabile.
            </p>
          </div>
        </div>

        <div className="hero-quick-actions">
          <button
            type="button"
            className="quick-tile quick-tile-lan"
            onClick={onOpenLobbies}
          >
            <Wifi size={20} aria-hidden="true" />
            <span>Lobby Rete Locale ({lobbyCount})</span>
          </button>

          <button type="button" className="quick-tile" onClick={onOpenRules}>
            <BookOpen size={20} aria-hidden="true" />
            <span>Costituzione &amp; Regole</span>
          </button>

          <button type="button" className="quick-tile" onClick={onOpenMemo}>
            <BookmarkCheck size={20} aria-hidden="true" />
            <span>Memo Parole ({memoCount})</span>
          </button>

          {canInstallPwa ? (
            <button
              type="button"
              className="quick-tile quick-tile-install"
              onClick={onInstallPwa}
            >
              <Download size={20} aria-hidden="true" />
              <span>Installa App</span>
            </button>
          ) : null}
        </div>
      </section>

      <form className="setup-card" onSubmit={handleSubmit}>
        <div className="setup-header">
          <h2 className="section-title">Configura il Tavolo (3 Giocatori)</h2>
          {stats.matchesPlayed > 0 ? (
            <span className="mini-stat-pill">
              <Trophy size={14} aria-hidden="true" />
              <span>
                {stats.matchesPlayed}{' '}
                {stats.matchesPlayed === 1 ? 'partita' : 'partite'} giocate
              </span>
            </span>
          ) : null}
        </div>

        <div className="players-setup-grid">
          {players.map((player, idx) => (
            <div
              key={player.id}
              className="player-setup-row"
              style={{ '--player-color': player.color }}
            >
              <div className="player-setup-badge" aria-hidden="true">
                G{idx + 1}
              </div>
              <div className="player-input-wrap">
                <label htmlFor={`player-name-${player.id}`} className="field-label">
                  Giocatore {idx + 1}{' '}
                  {idx === 0 ? '(inizia come Paroliere)' : ''}
                </label>
                <input
                  id={`player-name-${player.id}`}
                  type="text"
                  maxLength={18}
                  required
                  value={player.name}
                  onChange={(e) =>
                    onUpdatePlayer(player.id, { name: e.target.value })
                  }
                  placeholder={`Nome Giocatore ${idx + 1}`}
                  enterkeyhint="next"
                />
              </div>
              <button
                type="button"
                className={`bot-toggle-btn ${player.isBot ? 'is-bot' : ''}`}
                aria-pressed={player.isBot}
                onClick={() =>
                  onUpdatePlayer(player.id, { isBot: !player.isBot })
                }
                title={
                  player.isBot
                    ? 'Controllato dal Bot IA (clicca per passare a Umano)'
                    : 'Giocatore Umano al tavolo (clicca per attivare Bot IA)'
                }
              >
                {player.isBot ? (
                  <>
                    <Bot size={16} aria-hidden="true" />
                    <span>Bot IA</span>
                  </>
                ) : (
                  <>
                    <User size={16} aria-hidden="true" />
                    <span>Umano</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="match-options-grid">
          <div className="option-block">
            <label htmlFor="rounds-select" className="field-label">
              Durata partita
            </label>
            <select
              id="rounds-select"
              value={totalRounds}
              onChange={(e) => onChangeTotalRounds(Number(e.target.value))}
            >
              {ROUND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="option-block">
            <span className="field-label">Livello parole suggerite</span>
            <div className="level-chips" role="group" aria-label="Livello dizionario">
              {LEVEL_OPTIONS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`chip-btn ${levelFilter === lvl ? 'is-active' : ''}`}
                  onClick={() => onChangeLevelFilter(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="start-cta-row">
          <button
            type="submit"
            disabled={!canStart}
            className="btn btn-primary btn-lg btn-start"
          >
            <Play size={20} aria-hidden="true" />
            <span>Start Gheim!</span>
          </button>
          <p className="offline-hint">
            <Sparkles size={14} aria-hidden="true" />
            <span>
              Funziona anche offline · Ideale al tavolo o in modalità mista Umani +
              Bot
            </span>
          </p>
        </div>
      </form>
    </div>
  );
}
