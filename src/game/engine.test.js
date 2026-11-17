import { describe, it, expect } from 'vitest';
import {
  validateParoliereWords,
  getMancheRoles,
  getEligibleDiscardOptions,
  getPlayerSecondPickInfo,
  calculateMancheScores,
  applyInfractionPenalty,
} from './engine.js';

describe('ThE InGliSc GaMe Engine', () => {
  it('validates 1 target + 4 unique non-synonym words', () => {
    const res = validateParoliereWords('Candid', ['Brisk', 'Hollow', 'Fierce', 'Neat']);
    expect(res.valid).toBe(true);
    expect(res.options).toHaveLength(5);

    const dup = validateParoliereWords('Candid', ['candid', 'Hollow', 'Fierce', 'Neat']);
    expect(dup.valid).toBe(false);

    const incomplete = validateParoliereWords('Candid', ['Brisk', '', 'Fierce', 'Neat']);
    expect(incomplete.valid).toBe(false);
  });

  it('rotates roles cleanly across 3 players', () => {
    const players = [
      { id: '1', name: 'Marco', score: 0 },
      { id: '2', name: 'Luca', score: 0 },
      { id: '3', name: 'Sofia', score: 0 },
    ];
    const r0 = getMancheRoles(players, 0);
    expect(r0.paroliere.name).toBe('Marco');
    expect(r0.guesser1.name).toBe('Luca');
    expect(r0.guesser2.name).toBe('Sofia');

    const r1 = getMancheRoles(players, 1);
    expect(r1.paroliere.name).toBe('Luca');
    expect(r1.guesser1.name).toBe('Marco');
    expect(r1.guesser2.name).toBe('Sofia');
  });

  it('discards a player-picked non-target when available, otherwise an unchosen word', () => {
    const options = ['Candid', 'Brisk', 'Hollow', 'Fierce', 'Neat'];

    // P1 guessed Candid (target), P2 guessed Brisk -> must discard Brisk
    const case1 = getEligibleDiscardOptions(options, 'Candid', 'Candid', 'Brisk');
    expect(case1.mode).toBe('player_choice');
    expect(case1.eligible).toEqual(['Brisk']);

    // Both guessed wrong words -> Paroliere can discard either player's choice
    const case2 = getEligibleDiscardOptions(options, 'Candid', 'Hollow', 'Fierce');
    expect(case2.mode).toBe('player_choice');
    expect(case2.eligible).toEqual(['Hollow', 'Fierce']);

    // Both guessed the target -> fallback to unchosen words
    const case3 = getEligibleDiscardOptions(options, 'Candid', 'Candid', 'Candid');
    expect(case3.mode).toBe('unchosen_word');
    expect(case3.eligible).toEqual(['Brisk', 'Hollow', 'Fierce', 'Neat']);
  });

  it('marks player as forced to change when their initial word is discarded', () => {
    const options = ['Candid', 'Brisk', 'Hollow', 'Fierce', 'Neat'];
    const forced = getPlayerSecondPickInfo(options, 'Brisk', 'Brisk');
    expect(forced.isForced).toBe(true);
    expect(forced.canKeep).toBe(false);
    expect(forced.remainingOptions).toHaveLength(4);
    expect(forced.remainingOptions).not.toContain('Brisk');

    const optional = getPlayerSecondPickInfo(options, 'Hollow', 'Brisk');
    expect(optional.isForced).toBe(false);
    expect(optional.canKeep).toBe(true);
    expect(optional.remainingOptions).toHaveLength(4);
  });

  it('scores correctly when neither player guesses (Paroliere +3)', () => {
    const s = calculateMancheScores({
      targetWord: 'Candid',
      p1Initial: 'Brisk',
      p1Final: 'Hollow',
      p2Initial: 'Fierce',
      p2Final: 'Fierce',
    });
    expect(s.p1.points).toBe(0);
    expect(s.p2.points).toBe(0);
    expect(s.paroliere.points).toBe(3);
  });

  it('scores correctly when one guesses without changing (+3 player, 0 Paroliere)', () => {
    const s = calculateMancheScores({
      targetWord: 'Candid',
      p1Initial: 'Candid',
      p1Final: 'Candid',
      p2Initial: 'Brisk',
      p2Final: 'Hollow',
    });
    expect(s.p1.points).toBe(3);
    expect(s.p2.points).toBe(0);
    expect(s.paroliere.points).toBe(0);
  });

  it('scores correctly when one guesses after changing (+1 player, +1 Paroliere)', () => {
    const s = calculateMancheScores({
      targetWord: 'Candid',
      p1Initial: 'Brisk',
      p1Final: 'Candid',
      p2Initial: 'Fierce',
      p2Final: 'Hollow',
    });
    expect(s.p1.points).toBe(1);
    expect(s.p2.points).toBe(0);
    expect(s.paroliere.points).toBe(1);
  });

  it('scores 0 for Paroliere when BOTH players guess (even if both changed)', () => {
    const s = calculateMancheScores({
      targetWord: 'Candid',
      p1Initial: 'Brisk',
      p1Final: 'Candid',
      p2Initial: 'Hollow',
      p2Final: 'Candid',
    });
    expect(s.p1.points).toBe(1);
    expect(s.p2.points).toBe(1);
    expect(s.paroliere.points).toBe(0);
  });

  it('scores 0 for Paroliere when one wins without change and one wins with change', () => {
    const s = calculateMancheScores({
      targetWord: 'Candid',
      p1Initial: 'Candid',
      p1Final: 'Candid',
      p2Initial: 'Hollow',
      p2Final: 'Candid',
    });
    expect(s.p1.points).toBe(3);
    expect(s.p2.points).toBe(1);
    expect(s.paroliere.points).toBe(0);
  });

  it('applies -1 infraction penalty cleanly', () => {
    const players = [
      { id: '1', name: 'Marco', score: 2 },
      { id: '2', name: 'Luca', score: 0 },
      { id: '3', name: 'Sofia', score: 4 },
    ];
    const updated = applyInfractionPenalty(players, '2');
    expect(updated.find((p) => p.id === '2').score).toBe(-1);
    expect(updated.find((p) => p.id === '1').score).toBe(2);
  });
});
