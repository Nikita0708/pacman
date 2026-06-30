/**
 * Level data and parsing.
 *
 * The maze is authored as a human-readable character grid and parsed into a
 * numeric TileType matrix that matches the legend in the spec. Keeping the map
 * in its own module means game logic never depends on a specific layout — new
 * levels are just new layouts (Open/Closed Principle).
 *
 * Legend:
 *   #  wall           .  pellet          o  power pellet
 *   (space) empty     -  ghost house     P  Pac-Man spawn      T  tunnel
 */
import { TileType } from './types';
import type { GridPosition, MazeData } from './types';

const LEVEL_LAYOUT: readonly string[] = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  'T......##....##....##......T',
  '###.##.#####.##.#####.##.###',
  '###.##.#####.##.#####.##.###',
  '###.##.##..........##.##.###',
  '###.##.##.###--###.##.##.###',
  '###.##.##.#      #.##.##.###',
  'T      ## #      # ##      T',
  '###.##.##.#      #.##.##.###',
  '###o##.##.########.##.##.###',
  '###.##.##..........##.##.###',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#............P.............#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#.........................o#',
  '############################',
];

const CHAR_TO_TILE: Readonly<Record<string, TileType>> = {
  '#': TileType.WALL,
  '.': TileType.PELLET,
  o: TileType.POWER_PELLET,
  ' ': TileType.EMPTY,
  '-': TileType.GHOST_HOUSE,
  P: TileType.PACMAN_SPAWN,
  T: TileType.TUNNEL,
};

const toTile = (character: string): TileType => {
  const tile = CHAR_TO_TILE[character];
  if (tile === undefined) {
    throw new Error(`Unknown maze character: "${character}"`);
  }
  return tile;
};

/**
 * Parses a character layout into a validated MazeData structure. Throws on a
 * ragged layout so a broken map fails loudly at module load, not mid-game.
 */
export const parseMaze = (layout: readonly string[]): MazeData => {
  const rows = layout.length;
  const columns = layout[0]?.length ?? 0;
  const grid: TileType[][] = [];
  const tunnelRows: number[] = [];
  let pelletCount = 0;
  let pacmanSpawn: GridPosition = { col: 0, row: 0 };

  for (let row = 0; row < rows; row += 1) {
    const line = layout[row] ?? '';
    if (line.length !== columns) {
      throw new Error(
        `Maze row ${row} has width ${line.length}, expected ${columns}.`,
      );
    }

    const tileRow: TileType[] = new Array<TileType>(columns);
    let rowHasTunnel = false;

    for (let col = 0; col < columns; col += 1) {
      const tile = toTile(line.charAt(col));
      tileRow[col] = tile;

      if (tile === TileType.PELLET || tile === TileType.POWER_PELLET) {
        pelletCount += 1;
      } else if (tile === TileType.PACMAN_SPAWN) {
        pacmanSpawn = { col, row };
      } else if (tile === TileType.TUNNEL) {
        rowHasTunnel = true;
      }
    }

    if (rowHasTunnel) {
      tunnelRows.push(row);
    }
    grid.push(tileRow);
  }

  return { grid, columns, rows, pelletCount, pacmanSpawn, tunnelRows };
};

/** The parsed level, computed once at module load. */
export const MAZE: MazeData = parseMaze(LEVEL_LAYOUT);

/** Numeric matrix view of the level, matching the legend above. */
export const LEVEL: readonly (readonly TileType[])[] = MAZE.grid;

/** Returns a fresh, mutable copy of the maze grid for a new game or level. */
export const createGrid = (): TileType[][] => MAZE.grid.map((row) => [...row]);
