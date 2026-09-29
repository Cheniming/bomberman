import { Room, Client } from "colyseus";
import {
  createGame,
  createPlayer,
  freeSlot,
  startRound,
  step,
  GameState,
  PlayerInput,
  Dir,
  TICK_MS,
  ROUND_END_TICKS,
} from "../../shared/game.ts";

const DIRS: Dir[] = ["up", "down", "left", "right", null];

// 一場對戰 = 一個房間，伺服器是唯一的權威判定者
export class BattleRoom extends Room {
  maxClients = 4;
  game!: GameState;
  inputs: Record<string, PlayerInput> = {};

  onCreate(options: { private?: boolean }) {
    if (options.private) this.setPrivate(true);
    this.game = createGame(Date.now());

    this.onMessage("input", (client, msg: { dir?: Dir; bomb?: boolean }) => {
      const input = (this.inputs[client.sessionId] ??= { dir: null, bomb: false });
      if (DIRS.includes(msg.dir ?? null)) input.dir = msg.dir ?? null;
      if (msg.bomb) input.bomb = true;
    });

    this.onMessage("start", () => {
      if (this.game.phase === "waiting" && this.game.players.length >= 2) this.newRound();
    });

    this.setSimulationInterval(() => this.update(), TICK_MS);
  }

  onJoin(client: Client, options: { name?: string }) {
    const slot = freeSlot(this.game);
    const name = String(options.name ?? "").slice(0, 12) || `玩家${slot + 1}`;
    this.game.players.push(createPlayer(client.sessionId, name, slot));
    // 回合進行中加入的人先當觀眾，下一回合才上場
    if (this.game.phase === "playing") this.game.players.at(-1)!.alive = false;
    client.send("welcome", { id: client.sessionId, roomId: this.roomId });
  }

  onLeave(client: Client) {
    this.game.players = this.game.players.filter((p) => p.id !== client.sessionId);
    delete this.inputs[client.sessionId];
    if (this.game.players.length < 2) this.game.phase = "waiting";
  }

  newRound() {
    startRound(this.game, Date.now());
    for (const input of Object.values(this.inputs)) input.bomb = false;
  }

  update() {
    step(this.game, this.inputs);
    for (const input of Object.values(this.inputs)) input.bomb = false;
    if (this.game.phase === "ended" && this.game.phaseTimer >= ROUND_END_TICKS) {
      if (this.game.players.length >= 2) this.newRound();
      else this.game.phase = "waiting";
    }
    this.broadcast("state", this.game);
  }
}
