import React, { useState, useEffect } from 'react';
import ModalDialog from './ModalDialog.jsx';
import { AlertTriangle } from 'lucide-react';

const INFRACTION_REASONS = [
  'Ha inserito un sinonimo tra le 5 parole',
  'Ha suggerito o parlato fuori turno',
  'Ha sbirciato lo schermo segreto',
  'Battito sulla superficie irregolare / fuori tempo',
  'Altra infrazione alla Costituzione',
];

export default function InfractionDialog({
  open,
  onClose,
  players,
  paroliereId,
  onConfirmInfraction,
}) {
  const [offenderId, setOffenderId] = useState(paroliereId || players[0]?.id || '');
  const [reason, setReason] = useState(INFRACTION_REASONS[0]);

  useEffect(() => {
    if (open) {
      setOffenderId(paroliereId || players[0]?.id || '');
      setReason(INFRACTION_REASONS[0]);
    }
  }, [open, paroliereId, players]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!offenderId) return;
    onConfirmInfraction({ offenderId, reason });
    onClose();
  };

  const selectedPlayer = players.find((p) => p.id === offenderId);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      titleId="infraction-dialog-title"
      title="Segnala Infrazione"
      subtitle="Costituzione Art. 2: annulla la manche e penalizza chi sbaglia di −1 punto"
      maxWidth="34rem"
    >
      <form onSubmit={handleSubmit} className="infraction-form">
        <fieldset className="form-fieldset">
          <legend className="fieldset-legend">Chi ha commesso l&apos;infrazione?</legend>
          <div className="radio-player-grid">
            {players.map((player) => {
              const isParoliere = player.id === paroliereId;
              return (
                <label
                  key={player.id}
                  className={`player-radio-pill ${
                    offenderId === player.id ? 'is-selected' : ''
                  }`}
                  style={{ '--player-color': player.color }}
                >
                  <input
                    type="radio"
                    name="offender"
                    value={player.id}
                    checked={offenderId === player.id}
                    onChange={() => setOffenderId(player.id)}
                  />
                  <span className="player-dot" aria-hidden="true" />
                  <span className="player-radio-name">{player.name}</span>
                  <span className="player-radio-role">
                    {isParoliere ? 'Paroliere' : 'Giocatore'}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="form-fieldset">
          <legend className="fieldset-legend">Motivo dell&apos;infrazione</legend>
          <div className="reason-list">
            {INFRACTION_REASONS.map((item) => (
              <label key={item} className="reason-radio">
                <input
                  type="radio"
                  name="infractionReason"
                  value={item}
                  checked={reason === item}
                  onChange={() => setReason(item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="infraction-warning-box" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            La manche verrà <strong>annullata</strong> e{' '}
            <strong>{selectedPlayer?.name || 'il giocatore'}</strong> riceverà{' '}
            <strong>−1 punto</strong>.
          </span>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn btn-danger">
            Applica Penalità (−1 pt)
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
