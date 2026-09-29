import Phaser from "phaser";
import { W, H, Tile, BOMB_TICKS, GameState, ItemType } from "../../shared/game.ts";
import type { Session } from "./session.ts";

export const T = 48; // 每格像素
export const PLAYER_COLORS = [0xf5f5f5, 0xff5252, 0x448aff, 0xffd740];
const ITEM_STYLE: Record<ItemType, { color: number; icon: string }> = {
  bomb: { color: 0x3949ab, icon: "💣" },
  fire: { color: 0xe65100, icon: "🔥" },
  speed: { color: 0x2e7d32, icon: "👟" },
};

export class GameScene extends Phaser.Scene {
  getSession: () => Session | null = () => null;
  private g!: Phaser.GameObjects.Graphics;
  private texts = new Map<string, Phaser.GameObjects.Text>();
  private display = new Map<string, { x: number; y: number }>();

  constructor() {
    super("game");
  }

  create() {
    this.g = this.add.graphics();
  }

  update(_time: number, delta: number) {
    const session = this.getSession();
    session?.update(delta);
    const s = session?.state;
    this.g.clear();
    const used = new Set<string>();
    if (s) this.draw(s, delta, used, session!.mode === "online");
    for (const [k, t] of this.texts) {
      if (!used.has(k)) {
        t.destroy();
        this.texts.delete(k);
      }
    }
  }

  private text(key: string, used: Set<string>, x: number, y: number, str: string, size: number) {
    used.add(key);
    let t = this.texts.get(key);
    if (!t) {
      t = this.add.text(0, 0, str, { fontSize: `${size}px`, fontFamily: "system-ui, sans-serif", color: "#fff" });
      t.setOrigin(0.5).setDepth(10);
      this.texts.set(key, t);
    }
    if (t.text !== str) t.setText(str);
    t.setPosition(x, y);
  }

  private draw(s: GameState, delta: number, used: Set<string>, smooth: boolean) {
    const g = this.g;
    const now = this.time.now;

    // 地形
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tile = s.tiles[y * W + x];
        const px = x * T;
        const py = y * T;
        if (tile === Tile.Hard) {
          g.fillStyle(0x546e7a).fillRect(px, py, T, T);
          g.fillStyle(0x78909c).fillRect(px + 3, py + 3, T - 6, T - 10);
        } else {
          g.fillStyle((x + y) % 2 ? 0x388e3c : 0x43a047).fillRect(px, py, T, T);
          if (tile === Tile.Soft) {
            g.fillStyle(0x8d6e63).fillRect(px + 2, py + 2, T - 4, T - 4);
            g.lineStyle(2, 0x6d4c41);
            g.lineBetween(px + 2, py + T / 2, px + T - 2, py + T / 2);
            g.lineBetween(px + T / 2, py + 2, px + T / 2, py + T / 2);
            g.lineBetween(px + T / 4, py + T / 2, px + T / 4, py + T - 2);
            g.lineBetween(px + (3 * T) / 4, py + T / 2, px + (3 * T) / 4, py + T - 2);
          }
        }
      }
    }

    // 道具
    for (const it of s.items) {
      const st = ITEM_STYLE[it.type];
      g.fillStyle(st.color).fillRoundedRect(it.x * T + 6, it.y * T + 6, T - 12, T - 12, 6);
      this.text(`item:${it.x},${it.y}`, used, it.x * T + T / 2, it.y * T + T / 2, st.icon, 22);
    }

    // 炸彈：越接近引爆跳動越快
    for (const b of s.bombs) {
      const urgency = 1 - b.timer / BOMB_TICKS;
      const pulse = 1 + 0.08 * Math.sin(now / (180 - 140 * urgency));
      const cx = b.x * T + T / 2;
      const cy = b.y * T + T / 2 + 2;
      g.fillStyle(0x000000, 0.3).fillEllipse(cx, cy + T * 0.3, T * 0.6, T * 0.18);
      g.fillStyle(0x212121).fillCircle(cx, cy, T * 0.34 * pulse);
      g.fillStyle(0x616161).fillCircle(cx - 6, cy - 6, 4);
      g.fillStyle(urgency > 0.7 ? 0xff1744 : 0xffab00).fillCircle(cx + 10, cy - 14, 4);
    }

    // 火焰
    for (const f of s.flames) {
      const px = f.x * T;
      const py = f.y * T;
      g.fillStyle(0xff6d00, 0.9).fillRect(px + 2, py + 2, T - 4, T - 4);
      g.fillStyle(0xffea00, 0.9).fillRect(px + 10, py + 10, T - 20, T - 20);
    }

    // 玩家
    for (const p of s.players) {
      if (!p.alive) {
        this.display.delete(p.id);
        continue;
      }
      let d = this.display.get(p.id);
      if (!d || !smooth || Math.hypot(d.x - p.x, d.y - p.y) > 2) d = { x: p.x, y: p.y };
      else {
        const k = Math.min(1, delta / 50);
        d = { x: d.x + (p.x - d.x) * k, y: d.y + (p.y - d.y) * k };
      }
      this.display.set(p.id, d);
      const cx = d.x * T + T / 2;
      const cy = d.y * T + T / 2;
      g.fillStyle(0x000000, 0.3).fillEllipse(cx, cy + T * 0.34, T * 0.55, T * 0.16);
      g.fillStyle(PLAYER_COLORS[p.slot]).fillCircle(cx, cy, T * 0.36);
      g.lineStyle(2, 0x000000, 0.5).strokeCircle(cx, cy, T * 0.36);
      g.fillStyle(0x111111).fillCircle(cx - 6, cy - 3, 3).fillCircle(cx + 6, cy - 3, 3);
      this.text(`name:${p.id}`, used, cx, cy - T * 0.62, p.name, 12);
    }
  }
}

export function createGame(parent: string, scene: GameScene) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W * T,
    height: H * T,
    backgroundColor: "#1b1d22",
    scene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  });
}
