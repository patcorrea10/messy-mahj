/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TileType = 'suit' | 'wind' | 'dragon' | 'flower' | 'joker';

export interface MahjongTile {
  id: string;
  type: TileType;
  suit?: 'Crak' | 'Bam' | 'Dot';
  value: number | string;
}

export interface GameState {
  player1Racks: { rackA: MahjongTile[]; rackB: MahjongTile[] };
  player2Racks: { rackA: MahjongTile[]; rackB: MahjongTile[] };
  wall: MahjongTile[];
  discardPool: MahjongTile[];
  activePlayer: 1 | 2;
  hasDrawn: boolean;
  winner: 1 | 2 | null;
}
