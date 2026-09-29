import type { Dir } from "../../shared/game.ts";

// 追蹤按鍵順序：同時按住多個方向時，以最後按下的為準
export class KeyBinding {
  private stack: Exclude<Dir, null>[] = [];
  private bombQueued = false;

  constructor(
    private dirs: Record<string, Exclude<Dir, null>>,
    private bombKeys: string[],
  ) {}

  down(code: string): boolean {
    const d = this.dirs[code];
    if (d) {
      this.stack = this.stack.filter((s) => s !== d);
      this.stack.push(d);
      return true;
    }
    if (this.bombKeys.includes(code)) {
      this.bombQueued = true;
      return true;
    }
    return false;
  }

  up(code: string) {
    const d = this.dirs[code];
    if (d) this.stack = this.stack.filter((s) => s !== d);
  }

  get dir(): Dir {
    return this.stack.at(-1) ?? null;
  }

  takeBomb(): boolean {
    const b = this.bombQueued;
    this.bombQueued = false;
    return b;
  }

  reset() {
    this.stack = [];
    this.bombQueued = false;
  }
}

export const WASD = { KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" } as const;
export const ARROWS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as const;
