// 遊戲規則核心：純邏輯、無 I/O。伺服器（權威判定）與前端（本機模式）共用。

export const W = 15;
export const H = 13;
export const TICK_RATE = 20; // 每秒更新次數
export const TICK_MS = 1000 / TICK_RATE;

export const BOMB_TICKS = 3 * TICK_RATE; // 3 秒引爆
export const FLAME_TICKS = Math.round(0.5 * TICK_RATE); // 火焰持續 0.5 秒
export const ROUND_END_TICKS = 3 * TICK_RATE; // 回合結束後 3 秒重開

export const BASE_SPEED = 0.12; // 格/tick
export const SPEED_STEP = 0.02;
export const MAX_SPEED = 0.22;
export const MAX_BOMBS = 8;
export const MAX_POWER = 8;

export const SOFT_WALL_RATE = 0.65;
export const ITEM_DROP_RATE = 0.3;

export enum Tile {
  Empty = 0,
  Hard = 1,
  Soft = 2,
}

export type Dir = "up" | "down" | "left" | "right" | null;
export type ItemType = "bomb" | "fire" | "speed";

export interface Player {
  id: string;
  name: string;
  slot: number; // 0–3，決定出生點與顏色
  x: number; // 格座標，整數為格子中心
  y: number;
  alive: boolean;
  speed: number;
  maxBombs: number;
  power: number;
  wins: number;
}

export interface Bomb {
  x: number;
  y: number;
  owner: string;
  timer: number;
  power: number;
  passers: string[]; // 放下時站在上面的玩家，離開前可以穿過
}

export interface Flame {
  x: number;
  y: number;
  timer: number;
  drop?: ItemType; // 火焰熄滅後掉出的道具
}

export interface Item {
  x: number;
  y: number;
  type: ItemType;
}

export type Phase = "waiting" | "playing" | "ended";

export interface GameState {
  tick: number;
  seed: number;
  phase: Phase;
  phaseTimer: number;
  winner: string | null; // null 且 phase=ended 表示平手
  tiles: Tile[];
  players: Player[];
  bombs: Bomb[];
  flames: Flame[];
  items: Item[];
}

export interface PlayerInput {
  dir: Dir;
  bomb: boolean; // 單次觸發，step 後清除
}

export const SPAWNS: [number, number][] = [
  [1, 1],
  [W - 2, H - 2],
  [W - 2, 1],
  [1, H - 2],
];

// 可重現的亂數（mulberry32）
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const idx = (x: number, y: number) => y * W + x;

function isSafeZone(x: number, y: number) {
  return SPAWNS.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 1);
}

export function generateMap(seed: number): Tile[] {
  const rand = rng(seed);
  const tiles: Tile[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      if (border || pillar) tiles.push(Tile.Hard);
      else if (!isSafeZone(x, y) && rand() < SOFT_WALL_RATE) tiles.push(Tile.Soft);
      else tiles.push(Tile.Empty);
    }
  }
  return tiles;
}

export function createPlayer(id: string, name: string, slot: number): Player {
  const [x, y] = SPAWNS[slot];
  return { id, name, slot, x, y, alive: true, speed: BASE_SPEED, maxBombs: 1, power: 1, wins: 0 };
}

export function createGame(seed: number): GameState {
  return {
    tick: 0,
    seed,
    phase: "waiting",
    phaseTimer: 0,
    winner: null,
    tiles: generateMap(seed),
    players: [],
    bombs: [],
    flames: [],
    items: [],
  };
}

export function freeSlot(state: GameState): number {
  for (let s = 0; s < SPAWNS.length; s++) {
    if (!state.players.some((p) => p.slot === s)) return s;
  }
  return -1;
}

// 開新回合：重生地圖、重置玩家數值（保留勝場）
export function startRound(state: GameState, seed: number) {
  state.seed = seed;
  state.tiles = generateMap(seed);
  state.bombs = [];
  state.flames = [];
  state.items = [];
  state.winner = null;
  state.phase = "playing";
  state.phaseTimer = 0;
  for (const p of state.players) {
    const fresh = createPlayer(p.id, p.name, p.slot);
    Object.assign(p, fresh, { wins: p.wins });
  }
}

const DIRS: Record<Exclude<Dir, null>, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function bombAt(state: GameState, x: number, y: number) {
  return state.bombs.find((b) => b.x === x && b.y === y);
}

function blocked(state: GameState, x: number, y: number, pid: string) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  if (state.tiles[idx(x, y)] !== Tile.Empty) return true;
  const b = bombAt(state, x, y);
  return !!b && !b.passers.includes(pid);
}

function movePlayer(state: GameState, p: Player, dir: Dir) {
  if (!dir) return;
  const [dx, dy] = DIRS[dir];
  const spd = p.speed;
  // 沿移動軸以外的另一軸：主軸 a、側軸 b
  const horiz = dx !== 0;
  const d = horiz ? dx : dy;
  const a = horiz ? p.x : p.y;
  const b = horiz ? p.y : p.x;
  const isBlocked = (ta: number, tb: number) =>
    horiz ? blocked(state, ta, tb, p.id) : blocked(state, tb, ta, p.id);

  const rb = Math.round(b);
  if (Math.abs(b - rb) > 1e-3) {
    // 側軸沒對齊：轉角輔助，朝前方有路的那一排推正
    const ca = Math.round(a);
    const lo = Math.floor(b);
    const hi = Math.ceil(b);
    const near = b - lo < hi - b ? lo : hi;
    const far = near === lo ? hi : lo;
    const target = !isBlocked(ca + d, near) ? near : !isBlocked(ca + d, far) ? far : null;
    if (target === null) return;
    const nb = b + Math.sign(target - b) * Math.min(spd, Math.abs(target - b));
    if (horiz) p.y = nb;
    else p.x = nb;
    return;
  }

  const ca = Math.round(a);
  let na = a + d * spd;
  if (isBlocked(ca + d, rb) && d * (na - ca) > 0) na = ca; // 前方被擋：停在格子中心
  if (horiz) {
    p.x = na;
    p.y = rb;
  } else {
    p.y = na;
    p.x = rb;
  }
}

function placeBomb(state: GameState, p: Player) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  if (state.tiles[idx(x, y)] !== Tile.Empty || bombAt(state, x, y)) return;
  const active = state.bombs.filter((b) => b.owner === p.id).length;
  if (active >= p.maxBombs) return;
  const passers = state.players
    .filter((q) => q.alive && Math.abs(q.x - x) < 1 && Math.abs(q.y - y) < 1)
    .map((q) => q.id);
  state.bombs.push({ x, y, owner: p.id, timer: BOMB_TICKS, power: p.power, passers });
}

function rollDrop(state: GameState, x: number, y: number): ItemType | undefined {
  const rand = rng(state.seed ^ (state.tick * 7919) ^ idx(x, y));
  if (rand() >= ITEM_DROP_RATE) return undefined;
  const r = rand();
  return r < 0.4 ? "bomb" : r < 0.8 ? "fire" : "speed";
}

function addFlame(state: GameState, x: number, y: number, drop?: ItemType) {
  const existing = state.flames.find((f) => f.x === x && f.y === y);
  if (existing) {
    existing.timer = FLAME_TICKS;
    if (drop) existing.drop = drop;
  } else {
    state.flames.push({ x, y, timer: FLAME_TICKS, drop });
  }
}

// 連鎖爆炸用佇列處理
function explode(state: GameState, first: Bomb) {
  const queue: Bomb[] = [first];
  while (queue.length) {
    const bomb = queue.shift()!;
    const i = state.bombs.indexOf(bomb);
    if (i < 0) continue;
    state.bombs.splice(i, 1);
    addFlame(state, bomb.x, bomb.y);
    for (const [dx, dy] of Object.values(DIRS)) {
      for (let r = 1; r <= bomb.power; r++) {
        const x = bomb.x + dx * r;
        const y = bomb.y + dy * r;
        const tile = state.tiles[idx(x, y)];
        if (tile === Tile.Hard) break;
        if (tile === Tile.Soft) {
          state.tiles[idx(x, y)] = Tile.Empty;
          addFlame(state, x, y, rollDrop(state, x, y));
          break;
        }
        addFlame(state, x, y);
        const other = bombAt(state, x, y);
        if (other) {
          queue.push(other);
          break;
        }
        const itemIdx = state.items.findIndex((it) => it.x === x && it.y === y);
        if (itemIdx >= 0) {
          state.items.splice(itemIdx, 1);
          break;
        }
      }
    }
  }
}

function applyItem(p: Player, type: ItemType) {
  if (type === "bomb") p.maxBombs = Math.min(MAX_BOMBS, p.maxBombs + 1);
  if (type === "fire") p.power = Math.min(MAX_POWER, p.power + 1);
  if (type === "speed") p.speed = Math.min(MAX_SPEED, p.speed + SPEED_STEP);
}

// 推進一個 tick。inputs 以玩家 id 為鍵。
export function step(state: GameState, inputs: Record<string, PlayerInput>) {
  state.tick++;

  if (state.phase === "ended") {
    state.phaseTimer++;
    return;
  }
  if (state.phase !== "playing") return;

  for (const p of state.players) {
    if (!p.alive) continue;
    const input = inputs[p.id];
    if (!input) continue;
    movePlayer(state, p, input.dir);
    if (input.bomb) placeBomb(state, p);
  }

  // 玩家離開炸彈格後，就不能再穿過它
  for (const b of state.bombs) {
    b.passers = b.passers.filter((id) => {
      const q = state.players.find((p) => p.id === id);
      return !!q && Math.abs(q.x - b.x) < 1 && Math.abs(q.y - b.y) < 1;
    });
  }

  // 火焰倒數；熄滅時掉出道具
  for (const f of state.flames) f.timer--;
  for (const f of state.flames) {
    if (f.timer <= 0 && f.drop) state.items.push({ x: f.x, y: f.y, type: f.drop });
  }
  state.flames = state.flames.filter((f) => f.timer > 0);

  // 炸彈倒數，碰到火焰立即引爆
  for (const b of [...state.bombs]) {
    b.timer--;
    const hit = state.flames.some((f) => f.x === b.x && f.y === b.y);
    if (b.timer <= 0 || hit) explode(state, b);
  }

  // 碰到火焰就出局；撿道具
  for (const p of state.players) {
    if (!p.alive) continue;
    const tx = Math.round(p.x);
    const ty = Math.round(p.y);
    if (state.flames.some((f) => f.x === tx && f.y === ty)) {
      p.alive = false;
      continue;
    }
    const itemIdx = state.items.findIndex((it) => it.x === tx && it.y === ty);
    if (itemIdx >= 0) {
      applyItem(p, state.items[itemIdx].type);
      state.items.splice(itemIdx, 1);
    }
  }

  // 勝負判定（至少 2 人才判）
  if (state.players.length >= 2) {
    const alive = state.players.filter((p) => p.alive);
    if (alive.length <= 1) {
      state.phase = "ended";
      state.phaseTimer = 0;
      state.winner = alive[0]?.id ?? null;
      if (alive[0]) alive[0].wins++;
    }
  }
}
