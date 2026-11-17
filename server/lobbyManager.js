import {
  applyInfractionPenalty,
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
} from '../src/game/engine.js';
import { lookupServerDictionary } from './fullDictionaryServer.js';

function enrichServerWord(word, customTranslation = '') {
  const base = enrichWordMetadata(word, customTranslation);
  if (base.pos !== 'custom') return base;
  const dict = lookupServerDictionary(word);
  if (dict) {
    return {
      word: dict.word,
      ipa: dict.ipa,
      pos: dict.pos || 'word',
      level: 'Dizionario EN-IT',
      it: customTranslation.trim() || dict.it,
      example: '',
    };
  }
  return base;
}

const PLAYER_COLORS = ['#0D92F4', '#E11D48', '#10B981'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(existingCodes) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let i = 0; i < 4; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!existingCodes.has(code)) return code;
  }
  return String(Date.now()).slice(-4);
}

export function createLobbyStore({ onStateChange, onListChange } = {}) {
  const lobbies = new Map();

  const notifyList = () => {
    if (typeof onListChange === 'function') {
      onListChange(getPublicLobbyList());
    }
  };

  const notifyRoom = (lobby) => {
    if (typeof onStateChange === 'function') {
      onStateChange(lobby);
    }
    notifyList();
  };

  const clearBotTimer = (lobby) => {
    if (lobby._botTimer) {
      clearTimeout(lobby._botTimer);
      lobby._botTimer = null;
    }
  };

  const scheduleBotActions = (lobby) => {
    clearBotTimer(lobby);
    if (lobby.status !== 'playing' || !lobby.manche) return;

    const { manche } = lobby;
    const roles = getMancheRoles(lobby.players, lobby.paroliereIndex);

    const runStep = () => {
      lobby._botTimer = null;
      if (lobby.status !== 'playing') return;

      if (manche.phase === 'paroliere_setup' && roles.paroliere.isBot) {
        const botRound = botCreateParoliereRound(lobby.usedWords, lobby.levelFilter);
        const meta = enrichWordMetadata(botRound.targetWord, botRound.targetEntry.it);
        manche.targetWord = botRound.targetWord;
        manche.targetMeta = meta;
        manche.options = botRound.options;
        lobby.usedWords.push(botRound.targetWord);
        manche.phase = 'players_pick_1';
        notifyRoom(lobby);
        scheduleBotActions(lobby);
        return;
      }

      if (manche.phase === 'players_pick_1') {
        let changed = false;
        if (roles.guesser1.isBot && !manche.p1Choice1) {
          manche.p1Choice1 = botChooseFirstWord(manche.options, manche.targetWord);
          changed = true;
        } else if (roles.guesser2.isBot && !manche.p2Choice1) {
          manche.p2Choice1 = botChooseFirstWord(manche.options, manche.targetWord);
          changed = true;
        }
        if (changed) {
          if (manche.p1Choice1 && manche.p2Choice1) {
            manche.phase = 'paroliere_discard';
          }
          notifyRoom(lobby);
          scheduleBotActions(lobby);
        }
        return;
      }

      if (manche.phase === 'paroliere_discard' && roles.paroliere.isBot) {
        manche.discardedWord = botChooseDiscardWord(
          manche.options,
          manche.targetWord,
          manche.p1Choice1,
          manche.p2Choice1
        );
        manche.phase = 'players_pick_2';
        notifyRoom(lobby);
        scheduleBotActions(lobby);
        return;
      }

      if (manche.phase === 'players_pick_2') {
        let changed = false;
        if (roles.guesser1.isBot && !manche.p1Choice2) {
          manche.p1Choice2 = botChooseSecondWord(
            manche.options,
            manche.p1Choice1,
            manche.discardedWord,
            manche.targetWord
          );
          changed = true;
        } else if (roles.guesser2.isBot && !manche.p2Choice2) {
          manche.p2Choice2 = botChooseSecondWord(
            manche.options,
            manche.p2Choice1,
            manche.discardedWord,
            manche.targetWord
          );
          changed = true;
        }
        if (changed) {
          if (manche.p1Choice2 && manche.p2Choice2) {
            completeManche(lobby);
          }
          notifyRoom(lobby);
          scheduleBotActions(lobby);
        }
      }
    };

    // Check if any active turn belongs to a bot
    const needsBot =
      (manche.phase === 'paroliere_setup' && roles.paroliere.isBot) ||
      (manche.phase === 'players_pick_1' &&
        ((roles.guesser1.isBot && !manche.p1Choice1) ||
          (roles.guesser2.isBot && !manche.p2Choice1))) ||
      (manche.phase === 'paroliere_discard' && roles.paroliere.isBot) ||
      (manche.phase === 'players_pick_2' &&
        ((roles.guesser1.isBot && !manche.p1Choice2) ||
          (roles.guesser2.isBot && !manche.p2Choice2)));

    if (needsBot) {
      lobby._botTimer = setTimeout(runStep, 700);
    }
  };

  function completeManche(lobby) {
    const { manche } = lobby;
    const roles = getMancheRoles(lobby.players, lobby.paroliereIndex);
    const scores = calculateMancheScores({
      targetWord: manche.targetWord,
      p1Initial: manche.p1Choice1,
      p1Final: manche.p1Choice2,
      p2Initial: manche.p2Choice1,
      p2Final: manche.p2Choice2,
    });

    const deltaMap = {
      [roles.paroliere.id]: scores.paroliere.points,
      [roles.guesser1.id]: scores.p1.points,
      [roles.guesser2.id]: scores.p2.points,
    };

    lobby.players = lobby.players.map((p) => ({
      ...p,
      score: p.score + (deltaMap[p.id] || 0),
    }));

    const enriched =
      manche.targetMeta || enrichServerWord(manche.targetWord, '');
    manche.targetMeta = enriched;
    if (
      !lobby.learnedWords.some(
        (w) => normalizeWord(w.word) === normalizeWord(enriched.word)
      )
    ) {
      lobby.learnedWords.push(enriched);
    }
    manche.scoreReport = scores;
    manche.phase = 'round_reveal';
  }

  function createFreshManche(lobby) {
    lobby.manche = {
      phase: 'paroliere_setup',
      targetWord: '',
      targetMeta: null,
      options: [],
      p1Choice1: '',
      p2Choice1: '',
      discardedWord: '',
      p1Choice2: '',
      p2Choice2: '',
      scoreReport: null,
      infractionReport: null,
    };
  }

  function getPublicLobbyList() {
    const list = [];
    for (const lobby of lobbies.values()) {
      list.push({
        code: lobby.code,
        name: lobby.name,
        hostName:
          lobby.players.find((p) => p.clientId === lobby.hostClientId)?.name ||
          lobby.players[0]?.name ||
          'Host',
        playerCount: lobby.players.length,
        maxPlayers: 3,
        status: lobby.status,
        totalRounds: lobby.totalRounds,
        levelFilter: lobby.levelFilter,
        createdAt: lobby.createdAt,
        players: lobby.players.map((p) => ({
          id: p.id,
          name: p.name,
          isBot: p.isBot,
          connected: p.connected,
          color: p.color,
        })),
      });
    }
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  function createLobby({
    hostClientId,
    hostName,
    lobbyName,
    totalRounds = 6,
    levelFilter = 'Tutti',
  }) {
    const cleanHostName = String(hostName || '').trim().slice(0, 18);
    if (!cleanHostName) {
      throw new Error('Inserisci il tuo nickname per creare una lobby.');
    }
    const cleanLobbyName =
      String(lobbyName || '').trim().slice(0, 28) || `Tavolo di ${cleanHostName}`;

    const code = generateRoomCode(lobbies);
    const lobby = {
      code,
      name: cleanLobbyName,
      hostClientId,
      status: 'waiting', // 'waiting' | 'playing' | 'finished'
      totalRounds: Number.isFinite(Number(totalRounds)) ? Number(totalRounds) : 6,
      levelFilter: ['Tutti', 'Base', 'Intermedio', 'Avanzato'].includes(levelFilter)
        ? levelFilter
        : 'Tutti',
      mancheNumber: 1,
      paroliereIndex: 0,
      usedWords: [],
      learnedWords: [],
      createdAt: Date.now(),
      _botTimer: null,
      players: [
        {
          id: 'p1',
          clientId: hostClientId,
          name: cleanHostName,
          color: PLAYER_COLORS[0],
          isBot: false,
          connected: true,
          score: 0,
        },
      ],
      manche: null,
    };

    lobbies.set(code, lobby);
    notifyRoom(lobby);
    return lobby;
  }

  function joinLobby({ code, clientId, playerName }) {
    const cleanCode = String(code || '').trim().toUpperCase();
    const lobby = lobbies.get(cleanCode);
    if (!lobby) {
      throw new Error(`Lobby "${cleanCode}" non trovata.`);
    }

    const cleanName = String(playerName || '').trim().slice(0, 18);
    if (!cleanName) {
      throw new Error('Inserisci il tuo nickname prima di entrare.');
    }

    // Reconnecting player
    const existing = lobby.players.find((p) => p.clientId === clientId);
    if (existing) {
      existing.connected = true;
      if (lobby.status === 'waiting') {
        existing.name = cleanName;
      }
      notifyRoom(lobby);
      return lobby;
    }

    if (lobby.status !== 'waiting') {
      throw new Error('La partita in questa lobby è già iniziata.');
    }

    if (lobby.players.length >= 3) {
      // Replace a bot slot if the room was padded with bots while waiting
      const botIndex = lobby.players.findIndex((p) => p.isBot);
      if (botIndex >= 0) {
        const slotIdx = botIndex;
        lobby.players[slotIdx] = {
          id: `p${slotIdx + 1}`,
          clientId,
          name: cleanName,
          color: PLAYER_COLORS[slotIdx],
          isBot: false,
          connected: true,
          score: 0,
        };
        notifyRoom(lobby);
        return lobby;
      }
      throw new Error('Questa lobby è già al completo (3/3 giocatori).');
    }

    const duplicateName = lobby.players.some(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase()
    );
    const finalName = duplicateName ? `${cleanName} #${lobby.players.length + 1}` : cleanName;

    const slotIdx = lobby.players.length;
    lobby.players.push({
      id: `p${slotIdx + 1}`,
      clientId,
      name: finalName,
      color: PLAYER_COLORS[slotIdx],
      isBot: false,
      connected: true,
      score: 0,
    });

    notifyRoom(lobby);
    return lobby;
  }

  function markDisconnected(code, clientId) {
    const lobby = lobbies.get(code);
    if (!lobby) return;
    const player = lobby.players.find((p) => p.clientId === clientId);
    if (player) {
      player.connected = false;
      notifyRoom(lobby);
    }
  }

  function leaveLobby({ code, clientId }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby) return null;

    if (lobby.status === 'waiting') {
      lobby.players = lobby.players.filter((p) => p.clientId !== clientId);
      const remainingHumans = lobby.players.filter((p) => !p.isBot);
      if (remainingHumans.length === 0) {
        clearBotTimer(lobby);
        lobbies.delete(lobby.code);
        notifyList();
        return null;
      }
      // Re-index slots cleanly
      lobby.players = lobby.players.map((p, idx) => ({
        ...p,
        id: `p${idx + 1}`,
        color: PLAYER_COLORS[idx],
      }));
      if (lobby.hostClientId === clientId) {
        lobby.hostClientId = remainingHumans[0].clientId;
      }
      notifyRoom(lobby);
      return lobby;
    }

    // During an active match, mark player offline so they can reconnect cleanly
    markDisconnected(lobby.code, clientId);
    return lobby;
  }

  function addBot({ code, clientId }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby) throw new Error('Lobby non trovata.');
    if (lobby.hostClientId !== clientId) {
      throw new Error('Solo l’host può aggiungere un Bot IA.');
    }
    if (lobby.status !== 'waiting') {
      throw new Error('Puoi aggiungere Bot solo prima dell’inizio.');
    }
    if (lobby.players.length >= 3) {
      throw new Error('La lobby ha già 3 giocatori.');
    }

    const slotIdx = lobby.players.length;
    lobby.players.push({
      id: `p${slotIdx + 1}`,
      clientId: `bot-${slotIdx + 1}-${Date.now()}`,
      name: `Bot ${slotIdx + 1}`,
      color: PLAYER_COLORS[slotIdx],
      isBot: true,
      connected: true,
      score: 0,
    });
    notifyRoom(lobby);
    return lobby;
  }

  function removeBot({ code, clientId, botId }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby) throw new Error('Lobby non trovata.');
    if (lobby.hostClientId !== clientId) {
      throw new Error('Solo l’host può rimuovere un Bot.');
    }
    if (lobby.status !== 'waiting') return lobby;

    lobby.players = lobby.players
      .filter((p) => !(p.id === botId && p.isBot))
      .map((p, idx) => ({
        ...p,
        id: `p${idx + 1}`,
        color: PLAYER_COLORS[idx],
      }));
    notifyRoom(lobby);
    return lobby;
  }

  function startMatch({ code, clientId }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby) throw new Error('Lobby non trovata.');
    if (lobby.hostClientId !== clientId) {
      throw new Error('Solo l’host può avviare la partita.');
    }
    if (lobby.players.length !== 3) {
      throw new Error('Servono esattamente 3 giocatori (puoi aggiungere un Bot IA).');
    }

    lobby.status = 'playing';
    lobby.mancheNumber = 1;
    lobby.paroliereIndex = 0;
    lobby.usedWords = [];
    lobby.learnedWords = [];
    lobby.players = lobby.players.map((p) => ({ ...p, score: 0 }));
    createFreshManche(lobby);
    notifyRoom(lobby);
    scheduleBotActions(lobby);
    return lobby;
  }

  function submitParoliereSetup({
    code,
    clientId,
    targetWord,
    translation = '',
    distractors,
  }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby || lobby.status !== 'playing' || !lobby.manche) {
      throw new Error('Partita non attiva.');
    }
    const roles = getMancheRoles(lobby.players, lobby.paroliereIndex);
    if (roles.paroliere.clientId !== clientId) {
      throw new Error('Solo il Paroliere di questa manche può scegliere le parole.');
    }
    if (lobby.manche.phase !== 'paroliere_setup') {
      throw new Error('Le parole sono già state impostate.');
    }

    const res = validateParoliereWords(targetWord, distractors);
    if (!res.valid) {
      throw new Error(res.error);
    }

    lobby.manche.targetWord = res.targetWord;
    lobby.manche.targetMeta = enrichServerWord(res.targetWord, translation);
    lobby.manche.options = res.options;
    lobby.usedWords.push(res.targetWord);
    lobby.manche.phase = 'players_pick_1';

    notifyRoom(lobby);
    scheduleBotActions(lobby);
    return lobby;
  }

  function submitPlayerPick1({ code, clientId, word }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby || lobby.status !== 'playing' || !lobby.manche) {
      throw new Error('Partita non attiva.');
    }
    const { manche } = lobby;
    if (manche.phase !== 'players_pick_1') {
      throw new Error('Non è la fase di prima scelta.');
    }
    if (!manche.options.includes(word)) {
      throw new Error('Parola non valida.');
    }

    const roles = getMancheRoles(lobby.players, lobby.paroliereIndex);
    if (roles.guesser1.clientId === clientId) {
      if (manche.p1Choice1) throw new Error('Scelta già confermata e irrevocabile.');
      manche.p1Choice1 = word;
    } else if (roles.guesser2.clientId === clientId) {
      if (manche.p2Choice1) throw new Error('Scelta già confermata e irrevocabile.');
      manche.p2Choice1 = word;
    } else {
      throw new Error('Solo i due giocatori possono scegliere in questa fase.');
    }

    if (manche.p1Choice1 && manche.p2Choice1) {
      manche.phase = 'paroliere_discard';
    }

    notifyRoom(lobby);
    scheduleBotActions(lobby);
    return lobby;
  }

  function submitParoliereDiscard({ code, clientId, word }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby || lobby.status !== 'playing' || !lobby.manche) {
      throw new Error('Partita non attiva.');
    }
    const { manche } = lobby;
    if (manche.phase !== 'paroliere_discard') {
      throw new Error('Non è la fase di scarto.');
    }

    const roles = getMancheRoles(lobby.players, lobby.paroliereIndex);
    if (roles.paroliere.clientId !== clientId) {
      throw new Error('Solo il Paroliere può effettuare lo scarto.');
    }

    const { eligible } = getEligibleDiscardOptions(
      manche.options,
      manche.targetWord,
      manche.p1Choice1,
      manche.p2Choice1
    );
    if (!eligible.includes(word)) {
      throw new Error('Questa parola non può essere scartata secondo le regole.');
    }

    manche.discardedWord = word;
    manche.phase = 'players_pick_2';

    notifyRoom(lobby);
    scheduleBotActions(lobby);
    return lobby;
  }

  function submitPlayerPick2({ code, clientId, word }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby || lobby.status !== 'playing' || !lobby.manche) {
      throw new Error('Partita non attiva.');
    }
    const { manche } = lobby;
    if (manche.phase !== 'players_pick_2') {
      throw new Error('Non è la fase di cambio parola.');
    }

    const roles = getMancheRoles(lobby.players, lobby.paroliereIndex);
    let slot = 0;
    let initialChoice = '';
    if (roles.guesser1.clientId === clientId) {
      if (manche.p1Choice2) throw new Error('Scelta finale già confermata.');
      slot = 1;
      initialChoice = manche.p1Choice1;
    } else if (roles.guesser2.clientId === clientId) {
      if (manche.p2Choice2) throw new Error('Scelta finale già confermata.');
      slot = 2;
      initialChoice = manche.p2Choice1;
    } else {
      throw new Error('Solo i due giocatori possono confermare in questa fase.');
    }

    const { remainingOptions } = getPlayerSecondPickInfo(
      manche.options,
      initialChoice,
      manche.discardedWord
    );
    if (!remainingOptions.includes(word)) {
      throw new Error('Devi scegliere una delle 4 parole rimaste in gioco.');
    }

    if (slot === 1) manche.p1Choice2 = word;
    else manche.p2Choice2 = word;

    if (manche.p1Choice2 && manche.p2Choice2) {
      completeManche(lobby);
    }

    notifyRoom(lobby);
    scheduleBotActions(lobby);
    return lobby;
  }

  function submitInfraction({ code, clientId, offenderId, reason }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby || lobby.status !== 'playing' || !lobby.manche) {
      throw new Error('Partita non attiva.');
    }
    const isMember = lobby.players.some((p) => p.clientId === clientId);
    if (!isMember) {
      throw new Error('Solo i giocatori di questa lobby possono segnalare infrazioni.');
    }
    if (
      lobby.manche.phase === 'round_reveal' ||
      lobby.manche.phase === 'round_cancelled'
    ) {
      throw new Error('La manche è già terminata.');
    }

    const offender = lobby.players.find((p) => p.id === offenderId);
    if (!offender) {
      throw new Error('Giocatore penalizzato non valido.');
    }

    clearBotTimer(lobby);
    lobby.players = applyInfractionPenalty(lobby.players, offenderId);
    lobby.manche.infractionReport = {
      offenderId,
      offenderName: offender.name,
      offenderColor: offender.color,
      reason: String(reason || 'Infrazione alla Costituzione').trim(),
      calledBy:
        lobby.players.find((p) => p.clientId === clientId)?.name || 'Giocatore',
    };
    lobby.manche.phase = 'round_cancelled';

    notifyRoom(lobby);
    return lobby;
  }

  function advanceManche({ code, clientId }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby || lobby.status !== 'playing' || !lobby.manche) {
      throw new Error('Partita non attiva.');
    }
    if (!lobby.players.some((p) => p.clientId === clientId)) {
      throw new Error('Non appartieni a questa lobby.');
    }
    if (
      lobby.manche.phase !== 'round_reveal' &&
      lobby.manche.phase !== 'round_cancelled'
    ) {
      throw new Error('Attendi la fine della manche corrente.');
    }

    if (lobby.totalRounds > 0 && lobby.mancheNumber >= lobby.totalRounds) {
      lobby.status = 'finished';
      notifyRoom(lobby);
      return lobby;
    }

    lobby.mancheNumber += 1;
    lobby.paroliereIndex = (lobby.paroliereIndex + 1) % lobby.players.length;
    createFreshManche(lobby);
    notifyRoom(lobby);
    scheduleBotActions(lobby);
    return lobby;
  }

  function finishFreeMatch({ code, clientId }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby || lobby.status !== 'playing') return lobby;
    if (lobby.hostClientId !== clientId) {
      throw new Error('Solo l’host può chiudere la partita libera.');
    }
    clearBotTimer(lobby);
    lobby.status = 'finished';
    notifyRoom(lobby);
    return lobby;
  }

  function restartMatch({ code, clientId }) {
    const lobby = lobbies.get(String(code || '').trim().toUpperCase());
    if (!lobby) throw new Error('Lobby non trovata.');
    if (lobby.hostClientId !== clientId) {
      throw new Error('Solo l’host può avviare la rivincita.');
    }
    lobby.status = 'playing';
    lobby.mancheNumber = 1;
    lobby.paroliereIndex = 0;
    lobby.usedWords = [];
    lobby.learnedWords = [];
    lobby.players = lobby.players.map((p) => ({ ...p, score: 0 }));
    createFreshManche(lobby);
    notifyRoom(lobby);
    scheduleBotActions(lobby);
    return lobby;
  }

  /**
   * Produces a role-safe snapshot for a specific client so Guessers never
   * receive the secret target word before round_reveal, nor see the other
   * guesser's locked pick prematurely.
   */
  function sanitizeLobbyForClient(lobby, clientId) {
    const me = lobby.players.find((p) => p.clientId === clientId) || null;
    const isHost = lobby.hostClientId === clientId;

    let sanitizedManche = null;
    let roles = null;

    if (lobby.manche && lobby.players.length === 3) {
      const r = getMancheRoles(lobby.players, lobby.paroliereIndex);
      roles = {
        paroliereId: r.paroliere.id,
        guesser1Id: r.guesser1.id,
        guesser2Id: r.guesser2.id,
      };
      const isParoliere = me?.id === r.paroliere.id;
      const isG1 = me?.id === r.guesser1.id;
      const isG2 = me?.id === r.guesser2.id;
      const { manche } = lobby;
      const isRevealed = manche.phase === 'round_reveal';

      // Who gets to see Phase 1 choices:
      // - Paroliere once both have picked (for discard)
      // - Both players once discarded/phase 2 begins (and each player sees own locked status)
      const bothPicked1 = Boolean(manche.p1Choice1 && manche.p2Choice1);
      const showP1Choice =
        isRevealed ||
        manche.phase === 'paroliere_discard' ||
        manche.phase === 'players_pick_2' ||
        (bothPicked1 && (isParoliere || isG1 || isG2));

      const eligibleDiscards =
        isParoliere && manche.phase === 'paroliere_discard'
          ? getEligibleDiscardOptions(
              manche.options,
              manche.targetWord,
              manche.p1Choice1,
              manche.p2Choice1
            )
          : null;

      sanitizedManche = {
        phase: manche.phase,
        options: manche.options,
        targetClueIt: manche.targetMeta?.it || '',
        targetWord: isParoliere || isRevealed ? manche.targetWord : null,
        targetMeta: isParoliere || isRevealed ? manche.targetMeta : null,
        p1Locked1: Boolean(manche.p1Choice1),
        p2Locked1: Boolean(manche.p2Choice1),
        p1Choice1: showP1Choice || isG1 ? manche.p1Choice1 : null,
        p2Choice1: showP1Choice || isG2 ? manche.p2Choice1 : null,
        discardedWord: manche.discardedWord || null,
        eligibleDiscards,
        p1Locked2: Boolean(manche.p1Choice2),
        p2Locked2: Boolean(manche.p2Choice2),
        p1Choice2: isRevealed || isG1 ? manche.p1Choice2 : null,
        p2Choice2: isRevealed || isG2 ? manche.p2Choice2 : null,
        scoreReport: isRevealed ? manche.scoreReport : null,
        infractionReport:
          manche.phase === 'round_cancelled' ? manche.infractionReport : null,
      };
    }

    return {
      code: lobby.code,
      name: lobby.name,
      status: lobby.status,
      totalRounds: lobby.totalRounds,
      levelFilter: lobby.levelFilter,
      mancheNumber: lobby.mancheNumber,
      paroliereIndex: lobby.paroliereIndex,
      myPlayerId: me?.id || null,
      isHost,
      players: lobby.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isBot: p.isBot,
        connected: p.connected,
        score: p.score,
        isHost: p.clientId === lobby.hostClientId,
      })),
      roles,
      manche: sanitizedManche,
      learnedWords: lobby.learnedWords,
    };
  }

  return {
    getLobby: (code) => lobbies.get(String(code || '').trim().toUpperCase()),
    getPublicLobbyList,
    createLobby,
    joinLobby,
    leaveLobby,
    markDisconnected,
    addBot,
    removeBot,
    startMatch,
    submitParoliereSetup,
    submitPlayerPick1,
    submitParoliereDiscard,
    submitPlayerPick2,
    submitInfraction,
    advanceManche,
    finishFreeMatch,
    restartMatch,
    sanitizeLobbyForClient,
  };
}
