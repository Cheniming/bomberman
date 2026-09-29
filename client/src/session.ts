import { Client, Room } from "colyseus.js";
import {
  createGame,
  createPlayer,
  startRound,
  step,
  GameState,
  PlayerInput,
  TICK_MS,
  ROUND_END_TICKS,
} from "../../shared/game.ts";
import { KeyBinding, WASD, ARROWS } from "./input.ts";

export interface Session {
  mode: "local" | "online";
  state: GameState | null;
  myIds: string[];
  roomCode?: string;
  update(dtMs: number): void;
  keyDown(code: string): boolean;
  keyUp(code: string): void;
  destroy(): void;
}

// 本機雙人：遊戲邏輯直接在瀏覽器跑
export class LocalSession implements Session {
  mode = "local" as const;
  state: GameState;
  myIds = ["p1", "p2"];
  private keys = [
    new KeyBinding(WASD, ["Space"]),
    new KeyBinding(ARROWS, ["Enter", "NumpadEnter"]),
  ];
  private acc = 0;

  constructor() {
    this.state = createGame(Date.now());
    this.state.players.push(createPlayer("p1", "玩家 1", 0), createPlayer("p2", "玩家 2", 1));
    startRound(this.state, Date.now());
  }

  update(dtMs: number) {
    this.acc = Math.min(this.acc + dtMs, 250);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      const inputs: Record<string, PlayerInput> = {};
      this.myIds.forEach((id, i) => {
        inputs[id] = { dir: this.keys[i].dir, bomb: this.keys[i].takeBomb() };
      });
      step(this.state, inputs);
      if (this.state.phase === "ended" && this.state.phaseTimer >= ROUND_END_TICKS) {
        startRound(this.state, Date.now());
      }
    }
  }

  keyDown(code: string) {
    return this.keys.some((k) => k.down(code));
  }

  keyUp(code: string) {
    this.keys.forEach((k) => k.up(code));
  }

  destroy() {}
}

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname || "localhost"}:2567`;

// 線上：只送按鍵，畫面以伺服器廣播的狀態為準
export class OnlineSession implements Session {
  mode = "online" as const;
  state: GameState | null = null;
  myIds: string[] = [];
  roomCode?: string;
  onClose?: (msg: string) => void;
  private keys = new KeyBinding({ ...WASD, ...ARROWS }, ["Space", "Enter", "NumpadEnter"]);
  private lastDir: string | null = null;
  private closing = false;

  private constructor(private room: Room) {
    this.myIds = [room.sessionId];
    this.roomCode = room.roomId;
    room.onMessage("state", (s: GameState) => (this.state = s));
    room.onMessage("welcome", () => {});
    room.onLeave(() => {
      if (!this.closing) this.onClose?.("與伺服器的連線中斷");
    });
  }

  static async connect(kind: "quick" | "create" | "join", name: string, code = "") {
    const client = new Client(SERVER_URL);
    const room =
      kind === "quick"
        ? await client.joinOrCreate("battle", { name })
        : kind === "create"
          ? await client.create("battle", { name, private: true })
          : await client.joinById(code.trim(), { name });
    return new OnlineSession(room);
  }

  update() {}

  // 按鍵一變化就立刻送出，不等下一個畫面更新
  private flush() {
    const dir = this.keys.dir;
    if (dir !== this.lastDir) {
      this.lastDir = dir;
      this.room.send("input", { dir });
    }
    if (this.keys.takeBomb()) {
      if (this.state?.phase === "waiting") this.room.send("start");
      else this.room.send("input", { bomb: true });
    }
  }

  keyDown(code: string) {
    const handled = this.keys.down(code);
    if (handled) this.flush();
    return handled;
  }

  keyUp(code: string) {
    this.keys.up(code);
    this.flush();
  }

  destroy() {
    this.closing = true;
    this.room.leave();
  }
}
