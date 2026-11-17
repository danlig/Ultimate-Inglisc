# ThE InGliSc GaMe (PWA)

Party game PWA per imparare nuove parole inglesi, con modalità **Tavolo Locale (1 dispositivo)** e **Lobby Rete Locale (multi-dispositivo via WebSocket)**.

## Avvio rapido

```bash
npm install
npm start       # Compila la PWA e avvia server HTTP + WebSocket su http://localhost:4173
```

In sviluppo:

```bash
npm run dev     # Avvia Vite + Lobby LAN su http://localhost:5173
npm test        # Esegue i test unitari (Vitest)
```

## Dizionario

Include il dizionario offline **FreeDict + WikDict `eng-ita` (49.399 voci EN ↔ IT)** in `public/data/dictionary-en-it.json` (licenza CC BY-SA 3.0, vedi `public/data/LICENSE-FREEDICT.txt`).
