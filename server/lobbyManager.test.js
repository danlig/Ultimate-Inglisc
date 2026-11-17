import { describe, it, expect } from 'vitest';
import { createLobbyStore } from './lobbyManager.js';
import { lookupServerDictionary } from './fullDictionaryServer.js';

describe('LAN Lobby Manager', () => {
  it('creates a lobby, lets two other devices join, hides secret word from guessers, and scores round cleanly', () => {
    const store = createLobbyStore();

    const lobby = store.createLobby({
      hostClientId: 'dev-1',
      hostName: 'Marco',
      lobbyName: 'Tavolo Salotto',
      totalRounds: 3,
      levelFilter: 'Tutti',
    });

    expect(lobby.code).toHaveLength(4);
    expect(store.getPublicLobbyList()).toHaveLength(1);

    store.joinLobby({ code: lobby.code, clientId: 'dev-2', playerName: 'Luca' });
    store.joinLobby({ code: lobby.code, clientId: 'dev-3', playerName: 'Sofia' });

    expect(lobby.players).toHaveLength(3);

    store.startMatch({ code: lobby.code, clientId: 'dev-1' });
    expect(lobby.status).toBe('playing');

    // Paroliere (Marco / dev-1) sets 1 target + 4 distractors
    store.submitParoliereSetup({
      code: lobby.code,
      clientId: 'dev-1',
      targetWord: 'Candid',
      translation: 'Sincero',
      distractors: ['Brisk', 'Hollow', 'Fierce', 'Neat'],
    });

    // Guessers MUST NOT receive targetWord before round_reveal,
    // BUT MUST see the Italian clue (targetClueIt)
    const lucaView1 = store.sanitizeLobbyForClient(lobby, 'dev-2');
    const marcoView1 = store.sanitizeLobbyForClient(lobby, 'dev-1');
    expect(lucaView1.manche.targetWord).toBeNull();
    expect(lucaView1.manche.targetClueIt).toBe('Sincero');
    expect(marcoView1.manche.targetWord).toBe('Candid');
    expect(lucaView1.manche.options).toHaveLength(5);

    // Phase 1 picks (Luca picks Brisk, Sofia picks Candid)
    store.submitPlayerPick1({ code: lobby.code, clientId: 'dev-2', word: 'Brisk' });
    // Before Sofia picks, Sofia must not see Luca's pick
    const sofiaBefore = store.sanitizeLobbyForClient(lobby, 'dev-3');
    expect(sofiaBefore.manche.p1Locked1).toBe(true);
    expect(sofiaBefore.manche.p1Choice1).toBeNull();

    store.submitPlayerPick1({ code: lobby.code, clientId: 'dev-3', word: 'Candid' });
    expect(lobby.manche.phase).toBe('paroliere_discard');

    // Paroliere discards Brisk (cannot discard Candid)
    const marcoDiscardView = store.sanitizeLobbyForClient(lobby, 'dev-1');
    expect(marcoDiscardView.manche.eligibleDiscards.eligible).toEqual(['Brisk']);
    store.submitParoliereDiscard({ code: lobby.code, clientId: 'dev-1', word: 'Brisk' });

    expect(lobby.manche.phase).toBe('players_pick_2');

    // Luca is forced to switch -> picks Candid (+1 pt); Sofia keeps Candid (+3 pt)
    store.submitPlayerPick2({ code: lobby.code, clientId: 'dev-2', word: 'Candid' });
    store.submitPlayerPick2({ code: lobby.code, clientId: 'dev-3', word: 'Candid' });

    expect(lobby.manche.phase).toBe('round_reveal');
    const finalLuca = store.sanitizeLobbyForClient(lobby, 'dev-2');
    expect(finalLuca.manche.targetWord).toBe('Candid');

    // Both guessed -> Paroliere gets 0, Luca gets +1, Sofia gets +3
    expect(lobby.players.find((p) => p.name === 'Marco').score).toBe(0);
    expect(lobby.players.find((p) => p.name === 'Luca').score).toBe(1);
    expect(lobby.players.find((p) => p.name === 'Sofia').score).toBe(3);
  });

  it('supports adding bots, cancelling manche on infraction (-1 pt), and advancing round', () => {
    const store = createLobbyStore();
    const lobby = store.createLobby({
      hostClientId: 'h1',
      hostName: 'Anna',
      lobbyName: 'Stanza Test',
      totalRounds: 3,
    });

    store.addBot({ code: lobby.code, clientId: 'h1' });
    store.addBot({ code: lobby.code, clientId: 'h1' });
    store.startMatch({ code: lobby.code, clientId: 'h1' });

    store.submitInfraction({
      code: lobby.code,
      clientId: 'h1',
      offenderId: 'p1',
      reason: 'Sinonimo inserito',
    });

    expect(lobby.manche.phase).toBe('round_cancelled');
    expect(lobby.players.find((p) => p.id === 'p1').score).toBe(-1);

    store.advanceManche({ code: lobby.code, clientId: 'h1' });
    expect(lobby.mancheNumber).toBe(2);
    expect(lobby.paroliereIndex).toBe(1);
  });

  it('resolves entries from the offline 49k EN-IT FreeDict dictionary', () => {
    const entry = lookupServerDictionary('butterfly');
    expect(entry).not.toBeNull();
    expect(entry.it.toLowerCase()).toContain('farfalla');
  });
});
