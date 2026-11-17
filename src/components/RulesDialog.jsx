import React from 'react';
import ModalDialog from './ModalDialog.jsx';
import { BookOpen, ShieldAlert, Award, Hand } from 'lucide-react';

export default function RulesDialog({ open, onClose }) {
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      titleId="rules-dialog-title"
      title="Costituzione & Regole"
      subtitle="Il codice ufficiale di ThE InGliSc GaMe"
      maxWidth="42rem"
    >
      <div className="rules-stack">
        <section className="rule-block constitution-block">
          <h3 className="rule-heading">
            <BookOpen size={18} aria-hidden="true" />
            <span>Costituzione</span>
          </h3>
          <ol className="rule-list">
            <li>
              <strong>Scopo educativo:</strong> Il fine del gioco è imparare nuove{' '}
              <strong>PAROLE INGLESI</strong>.
            </li>
            <li>
              <strong>Tolleranza zero:</strong> Ad ogni <strong>infrazione</strong> viene{' '}
              <strong>annullata la manche</strong> e chi sbaglia viene penalizzato di{' '}
              <strong>−1 punto</strong>.
            </li>
          </ol>
        </section>

        <section className="rule-block">
          <h3 className="rule-heading">
            <Hand size={18} aria-hidden="true" />
            <span>Svolgimento della Manche</span>
          </h3>
          <ol className="rule-list">
            <li>
              Il <strong>Paroliere</strong> sceglie <strong>1 parola inglese</strong> da
              indovinare.
            </li>
            <li>
              Il Paroliere sceglie altre <strong>4 parole inglesi</strong> che{' '}
              <strong>non siano sinonimi</strong> della parola prescelta.
            </li>
            <li>
              Il Paroliere mostra le <strong>5 opzioni inglesi</strong> e la{' '}
              <strong>traduzione in italiano</strong> agli altri due giocatori.
            </li>
            <li>
              <strong>Prima scelta:</strong> i giocatori scelgono una parola a testa.
            </li>
            <li>
              <strong>Lo scarto:</strong> il Paroliere scarta una parola scelta da un
              giocatore (oppure un&apos;altra parola non scelta se entrambi hanno puntato
              sulla parola segreta).
            </li>
            <li>
              <strong>Cambio parola:</strong> tutti possono cambiare parola dopo lo
              scarto, <strong>costretti</strong> (se la loro è stata scartata) o{' '}
              <strong>non costretti</strong>.
            </li>
            <li>
              <strong>Conferma irrevocabile:</strong> ogni scelta si conferma con un{' '}
              <strong>battito della mano sulla superficie</strong> ed è irrevocabile!
            </li>
          </ol>
        </section>

        <div className="scoring-grid">
          <section className="rule-block score-card-player">
            <h3 className="rule-heading">
              <Award size={18} aria-hidden="true" />
              <span>Punteggio Giocatore</span>
            </h3>
            <ul className="score-bullets">
              <li>
                <span className="pts-pill pts-3">+3 pt</span>
                <span>Indovina senza mai cambiare</span>
              </li>
              <li>
                <span className="pts-pill pts-1">+1 pt</span>
                <span>Vince sulla seconda parola cambiata (costretta o non)</span>
              </li>
              <li>
                <span className="pts-pill pts-0">0 pt</span>
                <span>Non indovina</span>
              </li>
            </ul>
          </section>

          <section className="rule-block score-card-paroliere">
            <h3 className="rule-heading">
              <ShieldAlert size={18} aria-hidden="true" />
              <span>Punteggio Paroliere</span>
            </h3>
            <ul className="score-bullets">
              <li>
                <span className="pts-pill pts-3">+3 pt</span>
                <span>Nessun giocatore indovina</span>
              </li>
              <li>
                <span className="pts-pill pts-1">+1 pt</span>
                <span>Un solo giocatore indovina con risposta cambiata</span>
              </li>
              <li>
                <span className="pts-pill pts-0">0 pt</span>
                <span>
                  Almeno un giocatore indovina senza cambio, oppure entrambi vincono
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </ModalDialog>
  );
}
