import React, { useState, useEffect, useRef } from 'react';
import { Hand, Mic, Lock } from 'lucide-react';
import { startClapDetector } from '../utils/audioAndHaptics.js';

/**
 * Signature tactile confirmation component:
 * "La conferma di una parola da parte del giocatore si effettua
 *  con un battito della mano sulla superficie ed è irrevocabile."
 */
export default function SlapPad({
  playerName,
  playerColor,
  selectedWord,
  isIrrevocableWarning = true,
  micClapEnabled = false,
  onToggleMicClap,
  onSlapConfirm,
}) {
  const [rippleKey, setRippleKey] = useState(0);
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState('');
  const onSlapRef = useRef(onSlapConfirm);
  onSlapRef.current = onSlapConfirm;

  const isReady = Boolean(selectedWord);

  useEffect(() => {
    if (!micClapEnabled || !isReady) {
      setMicActive(false);
      setMicLevel(0);
      return undefined;
    }

    let stopFn = null;
    let cancelled = false;
    setMicError('');

    startClapDetector({
      onLevel: (lvl) => {
        if (!cancelled) setMicLevel(Math.min(1, lvl * 2));
      },
      onClap: () => {
        if (!cancelled) {
          setRippleKey((k) => k + 1);
          onSlapRef.current?.();
        }
      },
    })
      .then((cleanup) => {
        if (cancelled) {
          cleanup();
        } else {
          stopFn = cleanup;
          setMicActive(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMicError('Microfono non disponibile: usa il pad touch qui sotto.');
          setMicActive(false);
        }
      });

    return () => {
      cancelled = true;
      if (stopFn) stopFn();
    };
  }, [micClapEnabled, isReady]);

  const handleTap = () => {
    if (!isReady) return;
    setRippleKey((k) => k + 1);
    onSlapConfirm();
  };

  return (
    <div className="slap-pad-wrapper" style={{ '--player-color': playerColor }}>
      <div className="slap-pad-top-row">
        <span className="slap-player-cue">
          Turno di <strong>{playerName}</strong>
        </span>
        {typeof onToggleMicClap === 'function' ? (
          <button
            type="button"
            className={`mic-toggle-pill ${micClapEnabled ? 'is-on' : ''}`}
            aria-pressed={micClapEnabled}
            onClick={onToggleMicClap}
            title="Rileva automaticamente un battito reale con il microfono"
          >
            <Mic size={14} aria-hidden="true" />
            <span>{micClapEnabled ? 'Sensore Battito ON' : 'Sensore Battito OFF'}</span>
            {micActive ? (
              <span
                className="mic-meter"
                style={{ '--meter': micLevel }}
                aria-hidden="true"
              />
            ) : null}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!isReady}
        onClick={handleTap}
        className={`slap-pad-btn ${isReady ? 'is-ready' : 'is-waiting'}`}
      >
        {rippleKey > 0 ? (
          <span key={rippleKey} className="slap-shockwave" aria-hidden="true" />
        ) : null}
        <span className="slap-hand-badge" aria-hidden="true">
          <Hand size={28} strokeWidth={2.3} />
        </span>
        <span className="slap-text-group">
          <span className="slap-main-label">
            {isReady
              ? `Batti la mano per confermare "${selectedWord}"`
              : 'Tocca prima una delle parole sopra'}
          </span>
          {isIrrevocableWarning ? (
            <span className="slap-sub-label">
              <Lock size={13} aria-hidden="true" />
              <span>
                {isReady
                  ? 'Conferma irrevocabile · Batti sul pad (o batti sul tavolo)'
                  : 'Seleziona una carta per attivare il battito'}
              </span>
            </span>
          ) : null}
        </span>
      </button>

      {micError ? (
        <p className="mic-error-note" role="status">
          {micError}
        </p>
      ) : null}
    </div>
  );
}
