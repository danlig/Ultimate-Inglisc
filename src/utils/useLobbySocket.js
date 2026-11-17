import { useState, useEffect, useRef, useCallback } from 'react';

const CLIENT_ID_KEY = 'inglisc_client_id_v1';
const NICKNAME_KEY = 'inglisc_nickname_v1';
const ROOM_CODE_KEY = 'inglisc_active_room_v1';

export function getOrCreateClientId() {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const generated = `c-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    localStorage.setItem(CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function loadSavedNickname() {
  try {
    return localStorage.getItem(NICKNAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveNickname(name) {
  try {
    localStorage.setItem(NICKNAME_KEY, name);
  } catch {
    // Ignore
  }
}

function getSavedRoomCode() {
  try {
    return sessionStorage.getItem(ROOM_CODE_KEY) || '';
  } catch {
    return '';
  }
}

function saveRoomCode(code) {
  try {
    if (code) sessionStorage.setItem(ROOM_CODE_KEY, code);
    else sessionStorage.removeItem(ROOM_CODE_KEY);
  } catch {
    // Ignore
  }
}

export function useLobbySocket() {
  const [clientId] = useState(getOrCreateClientId);
  const [connected, setConnected] = useState(false);
  const [lobbies, setLobbies] = useState([]);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [networkInfo, setNetworkInfo] = useState({ lanUrls: [], port: null });

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const roomCodeRef = useRef(getSavedRoomCode());

  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.lanUrls)) {
          setNetworkInfo(data);
        }
      })
      .catch(() => {});

    fetch('/api/lobbies')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.lobbies)) {
          setLobbies(data.lobbies);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let closedByUser = false;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: 'hello',
            clientId,
            roomCode: roomCodeRef.current || undefined,
          })
        );
      });

      ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'lobby_list') {
            setLobbies(msg.lobbies || []);
          } else if (msg.type === 'room_state') {
            setRoom(msg.room);
            roomCodeRef.current = msg.room?.code || '';
            saveRoomCode(roomCodeRef.current);
            setError('');
          } else if (msg.type === 'left_lobby') {
            setRoom(null);
            roomCodeRef.current = '';
            saveRoomCode('');
          } else if (msg.type === 'error') {
            setError(msg.message || 'Errore nella comunicazione con la lobby.');
          }
        } catch {
          // Ignore malformed message
        }
      });

      ws.addEventListener('close', () => {
        setConnected(false);
        if (!closedByUser) {
          reconnectTimerRef.current = setTimeout(connect, 1500);
        }
      });

      ws.addEventListener('error', () => {
        ws.close();
      });
    };

    connect();

    return () => {
      closedByUser = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [clientId]);

  const send = useCallback(
    (payload) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setError('Connessione alla rete locale non ancora attiva. Riprova tra un secondo.');
        return false;
      }
      setError('');
      ws.send(JSON.stringify({ ...payload, clientId }));
      return true;
    },
    [clientId]
  );

  return {
    clientId,
    connected,
    lobbies,
    room,
    error,
    networkInfo,
    clearError: () => setError(''),
    createLobby: (data) => send({ type: 'create_lobby', ...data }),
    joinLobby: (data) => send({ type: 'join_lobby', ...data }),
    leaveLobby: () => {
      const code = roomCodeRef.current;
      roomCodeRef.current = '';
      saveRoomCode('');
      setRoom(null);
      if (code) {
        send({ type: 'leave_lobby', code });
      }
    },
    addBot: () => send({ type: 'add_bot' }),
    removeBot: (botId) => send({ type: 'remove_bot', botId }),
    startMatch: () => send({ type: 'start_match' }),
    submitParoliereSetup: (data) => send({ type: 'paroliere_setup', ...data }),
    submitPick1: (word) => send({ type: 'pick_1', word }),
    submitDiscard: (word) => send({ type: 'discard', word }),
    submitPick2: (word) => send({ type: 'pick_2', word }),
    submitInfraction: (data) => send({ type: 'infraction', ...data }),
    nextManche: () => send({ type: 'next_manche' }),
    finishFreeMatch: () => send({ type: 'finish_free_match' }),
    restartMatch: () => send({ type: 'restart_match' }),
  };
}
