import os from 'node:os';
import { WebSocketServer } from 'ws';
import { createLobbyStore } from './lobbyManager.js';

export function getLanUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const info of entries) {
      if (info.family === 'IPv4' && !info.internal) {
        urls.push(`http://${info.address}:${port}`);
      }
    }
  }
  return urls;
}

export function attachLobbyToServer(httpServer, { getPort } = {}) {
  if (!httpServer) return null;

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map(); // ws -> { clientId, roomCode }

  const sendJson = (ws, payload) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  };

  const broadcastLobbyList = (list) => {
    for (const [ws] of clients.entries()) {
      sendJson(ws, { type: 'lobby_list', lobbies: list });
    }
  };

  const broadcastRoomState = (lobby) => {
    for (const [ws, meta] of clients.entries()) {
      if (meta.roomCode === lobby.code) {
        sendJson(ws, {
          type: 'room_state',
          room: store.sanitizeLobbyForClient(lobby, meta.clientId),
        });
      }
    }
  };

  const store = createLobbyStore({
    onStateChange: broadcastRoomState,
    onListChange: broadcastLobbyList,
  });

  // Handle WebSocket upgrades only on /ws so Vite HMR stays untouched
  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', 'http://localhost');
    if (reqUrl.pathname !== '/ws') {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    clients.set(ws, { clientId: null, roomCode: null });

    sendJson(ws, { type: 'lobby_list', lobbies: store.getPublicLobbyList() });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        sendJson(ws, { type: 'error', message: 'Messaggio JSON non valido.' });
        return;
      }

      const meta = clients.get(ws);
      if (!meta) return;

      if (msg.clientId) {
        meta.clientId = String(msg.clientId);
      }

      try {
        switch (msg.type) {
          case 'hello': {
            sendJson(ws, {
              type: 'lobby_list',
              lobbies: store.getPublicLobbyList(),
            });
            if (msg.roomCode && meta.clientId) {
              const existing = store.getLobby(msg.roomCode);
              if (existing && existing.players.some((p) => p.clientId === meta.clientId)) {
                meta.roomCode = existing.code;
                const player = existing.players.find((p) => p.clientId === meta.clientId);
                if (player) player.connected = true;
                broadcastRoomState(existing);
              }
            }
            break;
          }

          case 'create_lobby': {
            const lobby = store.createLobby({
              hostClientId: meta.clientId,
              hostName: msg.hostName,
              lobbyName: msg.lobbyName,
              totalRounds: msg.totalRounds,
              levelFilter: msg.levelFilter,
            });
            meta.roomCode = lobby.code;
            broadcastRoomState(lobby);
            break;
          }

          case 'join_lobby': {
            const lobby = store.joinLobby({
              code: msg.code,
              clientId: meta.clientId,
              playerName: msg.playerName,
            });
            meta.roomCode = lobby.code;
            broadcastRoomState(lobby);
            break;
          }

          case 'leave_lobby': {
            const code = msg.code || meta.roomCode;
            meta.roomCode = null;
            if (code) {
              store.leaveLobby({ code, clientId: meta.clientId });
            }
            sendJson(ws, { type: 'left_lobby' });
            break;
          }

          case 'add_bot': {
            store.addBot({ code: msg.code || meta.roomCode, clientId: meta.clientId });
            break;
          }

          case 'remove_bot': {
            store.removeBot({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
              botId: msg.botId,
            });
            break;
          }

          case 'start_match': {
            store.startMatch({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
            });
            break;
          }

          case 'paroliere_setup': {
            store.submitParoliereSetup({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
              targetWord: msg.targetWord,
              translation: msg.translation,
              distractors: msg.distractors,
            });
            break;
          }

          case 'pick_1': {
            store.submitPlayerPick1({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
              word: msg.word,
            });
            break;
          }

          case 'discard': {
            store.submitParoliereDiscard({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
              word: msg.word,
            });
            break;
          }

          case 'pick_2': {
            store.submitPlayerPick2({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
              word: msg.word,
            });
            break;
          }

          case 'infraction': {
            store.submitInfraction({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
              offenderId: msg.offenderId,
              reason: msg.reason,
            });
            break;
          }

          case 'next_manche': {
            store.advanceManche({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
            });
            break;
          }

          case 'finish_free_match': {
            store.finishFreeMatch({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
            });
            break;
          }

          case 'restart_match': {
            store.restartMatch({
              code: msg.code || meta.roomCode,
              clientId: meta.clientId,
            });
            break;
          }

          default:
            sendJson(ws, { type: 'error', message: `Comando sconosciuto: ${msg.type}` });
        }
      } catch (err) {
        sendJson(ws, {
          type: 'error',
          message: err?.message || 'Errore nella lobby.',
        });
      }
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      clients.delete(ws);
      if (meta?.roomCode && meta?.clientId) {
        store.markDisconnected(meta.roomCode, meta.clientId);
      }
    });
  });

  // HTTP middleware for /api/lobbies and /api/network-info
  const middleware = (req, res, next) => {
    const reqUrl = new URL(req.url || '/', 'http://localhost');
    if (reqUrl.pathname === '/api/lobbies' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ lobbies: store.getPublicLobbyList() }));
      return;
    }
    if (reqUrl.pathname === '/api/network-info' && req.method === 'GET') {
      const addr = httpServer.address();
      const port =
        (typeof getPort === 'function' && getPort()) ||
        (addr && typeof addr === 'object' ? addr.port : 4173);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ lanUrls: getLanUrls(port), port }));
      return;
    }
    if (typeof next === 'function') next();
  };

  return { middleware, store };
}

export function lobbyVitePlugin() {
  return {
    name: 'inglisc-lan-lobby',
    configureServer(server) {
      const attached = attachLobbyToServer(server.httpServer, {
        getPort: () => server.config.server.port || 5173,
      });
      if (attached) {
        server.middlewares.use(attached.middleware);
      }
    },
    configurePreviewServer(server) {
      const attached = attachLobbyToServer(server.httpServer, {
        getPort: () => server.config.preview.port || 4173,
      });
      if (attached) {
        server.middlewares.use(attached.middleware);
      }
    },
  };
}
