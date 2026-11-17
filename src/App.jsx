import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  BookmarkCheck,
  Download,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { applyInfractionPenalty } from './game/engine.js';
import {
  loadMemoWords,
  loadSettings,
  loadStats,
  saveMemoWords,
  saveSettings,
  updateStats,
  upsertMemoWord,
} from './utils/storage.js';
import {
  loadSavedNickname,
  saveNickname,
  useLobbySocket,
} from './utils/useLobbySocket.js';
import HomeView from './components/HomeView.jsx';
import GameBoard from './components/GameBoard.jsx';
import LobbyHub from './components/LobbyHub.jsx';
import LobbyRoom from './components/LobbyRoom.jsx';
import RulesDialog from './components/RulesDialog.jsx';
import MemoDialog from './components/MemoDialog.jsx';

const INITIAL_PLAYERS = [
  { id: 'p1', name: 'Marco', color: '#0D92F4', isBot: false, score: 0 },
  { id: 'p2', name: 'Luca', color: '#E11D48', isBot: false, score: 0 },
  { id: 'p3', name: 'Sofia', color: '#10B981', isBot: false, score: 0 },
];

export default function App() {
  const [screen, setScreen] = useState('home'); // 'home' | 'lobbies' | 'game'
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [totalRounds, setTotalRounds] = useState(6);
  const [levelFilter, setLevelFilter] = useState('Tutti');
  const [lanNickname, setLanNickname] = useState(() => loadSavedNickname() || 'Marco');

  const [settings, setSettings] = useState(loadSettings);
  const [memoWords, setMemoWords] = useState(loadMemoWords);
  const [stats, setStats] = useState(loadStats);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const lobbySocket = useLobbySocket();

  // Sync theme override on :root if user toggles manually
  useEffect(() => {
    const root = document.documentElement;
    if (settings.themePreference === 'light') {
      root.style.colorScheme = 'light';
      root.dataset.theme = 'light';
    } else if (settings.themePreference === 'dark') {
      root.style.colorScheme = 'dark';
      root.dataset.theme = 'dark';
    } else {
      root.style.colorScheme = 'light dark';
      delete root.dataset.theme;
    }
    saveSettings(settings);
  }, [settings]);

  // Listen for PWA installability and online/offline events
  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    const onAppInstalled = () => {
      setInstallPromptEvent(null);
    };
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    try {
      await installPromptEvent.userChoice;
    } finally {
      setInstallPromptEvent(null);
    }
  };

  const handleChangeLanNickname = (name) => {
    setLanNickname(name);
    saveNickname(name);
  };

  const handleUpdatePlayer = (id, patch) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const handleStartMatch = () => {
    setPlayers((prev) =>
      prev.map((p, idx) => ({
        ...p,
        name: p.name.trim() || `Giocatore ${idx + 1}`,
        score: 0,
      }))
    );
    setScreen('game');
  };

  const handleUpdateScores = useCallback((deltaMap) => {
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        score: p.score + (deltaMap[p.id] || 0),
      }))
    );
    setStats(
      updateStats((s) => ({ ...s, manchesPlayed: (s.manchesPlayed || 0) + 1 }))
    );
  }, []);

  const handleApplyInfraction = useCallback((offenderId) => {
    setPlayers((prev) => applyInfractionPenalty(prev, offenderId));
    setStats(
      updateStats((s) => ({
        ...s,
        infractionsCalled: (s.infractionsCalled || 0) + 1,
      }))
    );
  }, []);

  const handleSaveMemoWord = useCallback((wordMeta) => {
    const next = upsertMemoWord(wordMeta);
    setMemoWords(next);
  }, []);

  const handleToggleMastered = (word) => {
    const next = memoWords.map((item) =>
      item.word.toLowerCase() === word.toLowerCase()
        ? { ...item, mastered: !item.mastered }
        : item
    );
    setMemoWords(next);
    saveMemoWords(next);
  };

  const handleRemoveMemoWord = (word) => {
    const next = memoWords.filter(
      (item) => item.word.toLowerCase() !== word.toLowerCase()
    );
    setMemoWords(next);
    saveMemoWords(next);
  };

  const handleMatchComplete = useCallback(() => {
    setStats(
      updateStats((s) => ({ ...s, matchesPlayed: (s.matchesPlayed || 0) + 1 }))
    );
  }, []);

  const handleRestartMatch = () => {
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
  };

  const toggleTheme = () => {
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setSettings((prev) => {
      const currentEffectiveDark =
        prev.themePreference === 'dark' ||
        (prev.themePreference === 'system' && systemDark);
      return {
        ...prev,
        themePreference: currentEffectiveDark ? 'light' : 'dark',
      };
    });
  };

  const isCurrentlyDark =
    settings.themePreference === 'dark' ||
    (settings.themePreference === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const activeLobbyRoom = lobbySocket.room;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-inner">
          <button
            type="button"
            className="brand-btn"
            onClick={() => {
              if (!activeLobbyRoom) setScreen('home');
            }}
            aria-label="Torna alla schermata iniziale di ThE InGliSc GaMe"
          >
            <img
              src="/icons/icon-192.png"
              alt=""
              width="34"
              height="34"
              className="brand-icon"
            />
            <span className="brand-wordmark">
              InGliSc <span className="brand-sub">PWA</span>
            </span>
          </button>

          <nav className="top-nav" aria-label="Azioni rapide">
            {isOffline ? (
              <span className="offline-pill" role="status">
                <WifiOff size={14} aria-hidden="true" />
                <span>Offline OK</span>
              </span>
            ) : null}

            {installPromptEvent ? (
              <button
                type="button"
                className="nav-pill nav-pill-install"
                onClick={handleInstallPwa}
              >
                <Download size={16} aria-hidden="true" />
                <span>Installa</span>
              </button>
            ) : null}

            {!activeLobbyRoom ? (
              <button
                type="button"
                className={`nav-pill ${screen === 'lobbies' ? 'is-active-nav' : ''}`}
                onClick={() => setScreen(screen === 'lobbies' ? 'home' : 'lobbies')}
              >
                <Wifi size={16} aria-hidden="true" />
                <span>Lobby ({lobbySocket.lobbies.length})</span>
              </button>
            ) : null}

            <button
              type="button"
              className="nav-pill"
              onClick={() => setRulesOpen(true)}
            >
              <BookOpen size={16} aria-hidden="true" />
              <span>Regole</span>
            </button>

            <button
              type="button"
              className="nav-pill"
              onClick={() => setMemoOpen(true)}
            >
              <BookmarkCheck size={16} aria-hidden="true" />
              <span>Memo ({memoWords.length})</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  soundEnabled: !prev.soundEnabled,
                }))
              }
              aria-pressed={settings.soundEnabled}
              aria-label={
                settings.soundEnabled ? 'Disattiva effetti sonori' : 'Attiva effetti sonori'
              }
              title={settings.soundEnabled ? 'Audio ON' : 'Audio OFF'}
            >
              {settings.soundEnabled ? (
                <Volume2 size={18} aria-hidden="true" />
              ) : (
                <VolumeX size={18} aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={isCurrentlyDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
              title={isCurrentlyDark ? 'Tema chiaro' : 'Tema scuro'}
            >
              {isCurrentlyDark ? (
                <Sun size={18} aria-hidden="true" />
              ) : (
                <Moon size={18} aria-hidden="true" />
              )}
            </button>
          </nav>
        </div>
      </header>

      <main className="main-stage">
        {activeLobbyRoom ? (
          <LobbyRoom
            room={activeLobbyRoom}
            networkInfo={lobbySocket.networkInfo}
            error={lobbySocket.error}
            soundEnabled={settings.soundEnabled}
            micClapEnabled={settings.micClapEnabled}
            onToggleMicClap={() =>
              setSettings((prev) => ({
                ...prev,
                micClapEnabled: !prev.micClapEnabled,
              }))
            }
            onLeaveLobby={() => {
              lobbySocket.leaveLobby();
              setScreen('lobbies');
            }}
            onAddBot={lobbySocket.addBot}
            onRemoveBot={lobbySocket.removeBot}
            onStartMatch={lobbySocket.startMatch}
            onSubmitParoliereSetup={lobbySocket.submitParoliereSetup}
            onSubmitPick1={lobbySocket.submitPick1}
            onSubmitDiscard={lobbySocket.submitDiscard}
            onSubmitPick2={lobbySocket.submitPick2}
            onSubmitInfraction={lobbySocket.submitInfraction}
            onNextManche={lobbySocket.nextManche}
            onFinishFreeMatch={lobbySocket.finishFreeMatch}
            onRestartMatch={lobbySocket.restartMatch}
            onSaveMemoWord={handleSaveMemoWord}
          />
        ) : screen === 'lobbies' ? (
          <LobbyHub
            nickname={lanNickname}
            onChangeNickname={handleChangeLanNickname}
            connected={lobbySocket.connected}
            lobbies={lobbySocket.lobbies}
            networkInfo={lobbySocket.networkInfo}
            error={lobbySocket.error}
            onCreateLobby={lobbySocket.createLobby}
            onJoinLobby={lobbySocket.joinLobby}
          />
        ) : screen === 'home' ? (
          <HomeView
            players={players}
            onUpdatePlayer={handleUpdatePlayer}
            totalRounds={totalRounds}
            onChangeTotalRounds={setTotalRounds}
            levelFilter={levelFilter}
            onChangeLevelFilter={setLevelFilter}
            onStartMatch={handleStartMatch}
            onOpenLobbies={() => {
              lobbySocket.clearError();
              setScreen('lobbies');
            }}
            lobbyCount={lobbySocket.lobbies.length}
            onOpenRules={() => setRulesOpen(true)}
            onOpenMemo={() => setMemoOpen(true)}
            memoCount={memoWords.length}
            stats={stats}
            canInstallPwa={Boolean(installPromptEvent)}
            onInstallPwa={handleInstallPwa}
          />
        ) : (
          <GameBoard
            players={players}
            totalRounds={totalRounds}
            levelFilter={levelFilter}
            soundEnabled={settings.soundEnabled}
            micClapEnabled={settings.micClapEnabled}
            onToggleMicClap={() =>
              setSettings((prev) => ({
                ...prev,
                micClapEnabled: !prev.micClapEnabled,
              }))
            }
            onApplyInfraction={handleApplyInfraction}
            onUpdateScores={handleUpdateScores}
            onSaveMemoWord={handleSaveMemoWord}
            onMatchComplete={handleMatchComplete}
            onExitMatch={() => setScreen('home')}
            onRestartMatch={handleRestartMatch}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>
          ThE InGliSc GaMe · Costituzione: impara nuove parole inglesi, zero
          infrazioni, conferma con un battito della mano.
        </p>
      </footer>

      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <MemoDialog
        open={memoOpen}
        onClose={() => setMemoOpen(false)}
        memoWords={memoWords}
        onToggleMastered={handleToggleMastered}
        onAddWord={handleSaveMemoWord}
        onRemoveWord={handleRemoveMemoWord}
      />
    </div>
  );
}
