import React, { useState } from 'react';
import {
  Check,
  Copy,
  DoorOpen,
  PlusCircle,
  Radio,
  Users,
  Wifi,
} from 'lucide-react';

const ROUND_OPTIONS = [
  { value: 3, label: '3 Manches (1 giro)' },
  { value: 6, label: '6 Manches (2 giri)' },
  { value: 9, label: '9 Manches (3 giri)' },
  { value: 0, label: 'Partita Libera (∞)' },
];

const LEVEL_OPTIONS = ['Tutti', 'Base', 'Intermedio', 'Avanzato'];

export default function LobbyHub({
  nickname,
  onChangeNickname,
  connected,
  lobbies,
  networkInfo,
  error,
  onCreateLobby,
  onJoinLobby,
}) {
  const [lobbyName, setLobbyName] = useState('');
  const [totalRounds, setTotalRounds] = useState(6);
  const [levelFilter, setLevelFilter] = useState('Tutti');
  const [joinCode, setJoinCode] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');

  const shareUrl =
    networkInfo?.lanUrls?.[0] ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const handleCopyUrl = async () => {
    if (!shareUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(shareUrl);
      setTimeout(() => setCopiedUrl(''), 2000);
    } catch {
      // Ignore clipboard failure on non-HTTPS origins
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    onCreateLobby({
      hostName: nickname.trim(),
      lobbyName: lobbyName.trim(),
      totalRounds,
      levelFilter,
    });
  };

  const handleCodeJoinSubmit = (e) => {
    e.preventDefault();
    if (!nickname.trim() || !joinCode.trim()) return;
    onJoinLobby({ code: joinCode.trim().toUpperCase(), playerName: nickname.trim() });
  };

  return (
    <div className="lobby-hub-layout">
      <section className="stage-card lobby-identity-card">
        <div className="lobby-identity-top">
          <div>
            <span className="phase-kicker">Multiplayer su Rete Locale (Wi-Fi)</span>
            <h2 className="stage-title">Lobby Multi-Dispositivo</h2>
            <p className="helper-note">
              Ogni giocatore usa il proprio telefono o PC. Solo il Paroliere vede la
              parola segreta!
            </p>
          </div>
          <span className={`ws-status-pill ${connected ? 'is-online' : 'is-offline'}`}>
            <Radio size={14} aria-hidden="true" />
            <span>{connected ? 'Server Rete Attivo' : 'Riconnessione...'}</span>
          </span>
        </div>

        <div className="identity-share-grid">
          <div className="field-group">
            <label htmlFor="lan-nickname" className="field-label">
              Il tuo Nickname
            </label>
            <input
              id="lan-nickname"
              type="text"
              maxLength={18}
              value={nickname}
              onChange={(e) => onChangeNickname(e.target.value)}
              placeholder="Es. Marco, Luca, Sofia..."
              required
            />
          </div>

          {shareUrl ? (
            <div className="lan-share-box">
              <div className="lan-share-label">
                <Wifi size={15} aria-hidden="true" />
                <span>Indirizzo per altri dispositivi sulla stessa Wi‑Fi:</span>
              </div>
              <div className="lan-share-url-row">
                <code className="lan-url-code">{shareUrl}</code>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCopyUrl}
                >
                  {copiedUrl ? (
                    <>
                      <Check size={15} aria-hidden="true" />
                      <span>Copiato</span>
                    </>
                  ) : (
                    <>
                      <Copy size={15} aria-hidden="true" />
                      <span>Copia</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="error-banner" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <div className="lobby-columns-grid">
        <form className="stage-card" onSubmit={handleCreateSubmit}>
          <div className="stage-header-row">
            <h3 className="section-title">Crea Nuova Lobby</h3>
          </div>

          <div className="field-group">
            <label htmlFor="lobby-name-input" className="field-label">
              Nome della stanza (opzionale)
            </label>
            <input
              id="lobby-name-input"
              type="text"
              maxLength={28}
              value={lobbyName}
              onChange={(e) => setLobbyName(e.target.value)}
              placeholder={
                nickname.trim() ? `Tavolo di ${nickname.trim()}` : 'Es. Tavolo Salotto'
              }
            />
          </div>

          <div className="field-group">
            <label htmlFor="lobby-rounds-select" className="field-label">
              Durata partita
            </label>
            <select
              id="lobby-rounds-select"
              value={totalRounds}
              onChange={(e) => setTotalRounds(Number(e.target.value))}
            >
              {ROUND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <span className="field-label">Livello parole suggerite</span>
            <div className="level-chips">
              {LEVEL_OPTIONS.map((lvl) => (
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
          </div>

          <button
            type="submit"
            disabled={!nickname.trim() || !connected}
            className="btn btn-primary btn-lg"
          >
            <PlusCircle size={19} aria-hidden="true" />
            <span>Crea Lobby &amp; Entra</span>
          </button>
        </form>

        <section className="stage-card">
          <div className="stage-header-row">
            <h3 className="section-title">
              Lobby Aperte ({lobbies.length})
            </h3>
          </div>

          <form onSubmit={handleCodeJoinSubmit} className="join-code-form">
            <div className="join-code-input-wrap">
              <label htmlFor="join-code-input" className="visually-hidden">
                Codice lobby a 4 caratteri
              </label>
              <input
                id="join-code-input"
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Codice (es. AB12)"
                autocorrect="off"
                autocapitalize="characters"
              />
            </div>
            <button
              type="submit"
              disabled={!nickname.trim() || !joinCode.trim() || !connected}
              className="btn btn-secondary"
            >
              <DoorOpen size={17} aria-hidden="true" />
              <span>Entra</span>
            </button>
          </form>

          {lobbies.length === 0 ? (
            <div className="empty-lobby-box">
              <Users size={28} aria-hidden="true" />
              <p>
                Nessuna lobby attiva nella rete locale al momento. Creane una qui a
                fianco per far entrare gli altri dispositivi!
              </p>
            </div>
          ) : (
            <ul className="lobby-list">
              {lobbies.map((item) => {
                const isWaiting = item.status === 'waiting';
                const hasBotSlot = item.players.some((p) => p.isBot);
                const canJoin =
                  isWaiting && (item.playerCount < item.maxPlayers || hasBotSlot);

                return (
                  <li key={item.code} className="lobby-list-card">
                    <div className="lobby-card-info">
                      <div className="lobby-card-title-row">
                        <strong className="lobby-card-name">{item.name}</strong>
                        <span className="room-code-badge">{item.code}</span>
                        <span
                          className={`room-status-badge ${
                            isWaiting ? 'is-waiting' : 'is-playing'
                          }`}
                        >
                          {isWaiting ? 'In attesa' : 'In corso'}
                        </span>
                      </div>
                      <p className="lobby-card-meta">
                        Host: <strong>{item.hostName}</strong> · {item.playerCount}/
                        {item.maxPlayers} giocatori ·{' '}
                        {item.totalRounds > 0
                          ? `${item.totalRounds} manches`
                          : 'Libera'}{' '}
                        · {item.levelFilter}
                      </p>
                      <div className="lobby-player-chips">
                        {item.players.map((p) => (
                          <span
                            key={p.id}
                            className="mini-player-chip"
                            style={{ '--player-color': p.color }}
                          >
                            {p.name}
                            {p.isBot ? ' 🤖' : ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canJoin || !nickname.trim() || !connected}
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        onJoinLobby({
                          code: item.code,
                          playerName: nickname.trim(),
                        })
                      }
                    >
                      {canJoin ? 'Partecipa' : isWaiting ? 'Piena' : 'Avviata'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
