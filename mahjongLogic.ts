/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MahjongTile, GameState } from './types';

const suits: ('Crak' | 'Bam' | 'Dot')[] = ['Crak', 'Bam', 'Dot'];
const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const winds = ['North', 'East', 'South', 'West'];
const dragons = ['Red', 'Green', 'White'];

export function generateDeck(): MahjongTile[] {
  const deck: MahjongTile[] = [];

  // Add Suited Tiles (4 of each number 1-9 in all 3 suits) = 108 tiles
  suits.forEach(suit => {
    values.forEach(value => {
      for (let i = 0; i < 4; i++) {
        deck.push({ type: 'suit', suit: suit, value: value, id: `${suit}-${value}-${i}` });
      }
    });
  });

  // Add Winds (4 of each direction) = 16 tiles
  winds.forEach(wind => {
    for (let i = 0; i < 4; i++) {
      deck.push({ type: 'wind', value: wind, id: `Wind-${wind}-${i}` });
    }
  });

  // Add Dragons (4 of each color) = 12 tiles
  dragons.forEach(dragon => {
    for (let i = 0; i < 4; i++) {
      deck.push({ type: 'dragon', value: dragon, id: `Dragon-${dragon}-${i}` });
    }
  });

  // Add Flowers = 8 tiles
  for (let i = 0; i < 8; i++) {
    deck.push({ type: 'flower', value: 'Flower', id: `Flower-${i}` });
  }

  // Add Jokers = 8 tiles
  for (let i = 0; i < 8; i++) {
    deck.push({ type: 'joker', value: 'Joker', id: `Joker-${i}` });
  }

  return deck;
}

export function shuffle(deck: MahjongTile[]): MahjongTile[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function sortTiles(tiles: MahjongTile[]): MahjongTile[] {
  const typeOrder: Record<string, number> = {
    'suit': 0,
    'wind': 1,
    'dragon': 2,
    'flower': 3,
    'joker': 4,
  };

  const suitOrder: Record<string, number> = {
    'Bam': 0,
    'Crak': 1,
    'Dot': 2,
  };

  const windOrder: Record<string, number> = {
    'North': 0,
    'East': 1,
    'South': 2,
    'West': 3,
  };

  const dragonOrder: Record<string, number> = {
    'Green': 0,
    'Red': 1,
    'White': 2,
  };

  return [...tiles].sort((a, b) => {
    if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];

    if (a.type === 'suit') {
      if (a.suit !== b.suit) return suitOrder[a.suit!] - suitOrder[b.suit!];
      return (a.value as number) - (b.value as number);
    }

    if (a.type === 'wind') {
      return windOrder[a.value as string] - windOrder[b.value as string];
    }

    if (a.type === 'dragon') {
      return dragonOrder[a.value as string] - dragonOrder[b.value as string];
    }

    return 0;
  });
}

export function dealGame(): GameState {
  const deck = shuffle(generateDeck());
  
  // East (Player 1) gets 28 tiles, Player 2 gets 27 tiles
  const player1Hand = deck.splice(0, 28);
  const player2Hand = deck.splice(0, 27);
  const wall = deck; // The remaining 97 tiles

  return {
    player1Racks: {
      rackA: player1Hand.slice(0, 14),
      rackB: player1Hand.slice(14, 28),
    },
    player2Racks: {
      rackA: player2Hand.slice(0, 14),
      rackB: player2Hand.slice(14, 27),
    },
    wall,
    discardPool: [],
    activePlayer: 1,
    hasDrawn: true,
    winner: null,
  };
}
