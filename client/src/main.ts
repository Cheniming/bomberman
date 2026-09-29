import { GameScene, createGame, PLAYER_COLORS } from "./scene.ts";
import { LocalSession, OnlineSession, Session } from "./session.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const menu = $("menu");
const play = $("play");
const hud = $("hud");
const banner = $("banner");
const nameInput = $<HTMLInputElement>("name");
const codeInput = $<HTMLInputElement>("code");
const menuMsg = $("menu-msg");
$("version").textContent = `v${__APP_VERSION__}`;

try {
  nameInput.value = localStorage.getItem("name") ?? "";
} catch {}

let session: Session | null = null;
const scene = new GameScene();
scene.getSession = () => session;
createGame("game", scene);

function enter(s: Session) {
  session = s;
  menu.hidden = true;
  play.hidden = false;
  menuMsg.textContent = "";
}

function backToMenu(msg = "") {
  session?.destroy();
  session = null;
  play.hidden = true;
  menu.hidden = false;
  menuMsg.textContent = msg;
}

function playerName() {
  const n = nameInput.value.trim();
  try {
    localStorage.setItem("name", n);
  } catch {}
  return n;
}

async function goOnline(kind: "quick" | "create" | "join") {
  if (kind === "join" && !codeInput.value.trim()) {
    menuMsg.textContent = "請輸入房間代碼";
    return;
  }
  menuMsg.textContent = "連線中…";
  try {
    const s = await OnlineSession.connect(kind, playerName(), codeInput.value);
    s.onClose = (msg) => backToMenu(msg);
    enter(s);
  } catch (e) {
    console.error(e);
    menuMsg.textContent = "無法連線到伺服器";
  }
}

$("btn-local").onclick = () => enter(new LocalSession());
$("btn-quick").onclick = () => goOnline("quick");
$("btn-create").onclick = () => goOnline("create");
$("btn-join").onclick = () => goOnline("join");

window.addEventListener("keydown", (e) => {
  if (!session) return;
  if (e.code === "Escape") return backToMenu();
  if (e.repeat) {
    e.preventDefault();
    return;
  }
  if (session.keyDown(e.code)) e.preventDefault();
});
window.addEventListener("keyup", (e) => session?.keyUp(e.code));
window.addEventListener("blur", () => {
  // 視窗失焦時放開所有按鍵，避免角色一直走
  ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].forEach((c) =>
    session?.keyUp(c),
  );
});

// HUD 與提示文字
function hex(n: number) {
  return "#" + n.toString(16).padStart(6, "0");
}
let lastHud = "";
let lastBanner = "";
function refreshHud() {
  requestAnimationFrame(refreshHud);
  const s = session?.state;
  if (!session || !s) return;
  const players = s.players
    .map(
      (p) =>
        `<span class="p ${p.alive ? "" : "dead"}"><span class="dot" style="background:${hex(PLAYER_COLORS[p.slot])}"></span>` +
        `${escapeHtml(p.name)}${session!.myIds.includes(p.id) && session!.mode === "online" ? "（你）" : ""}` +
        ` 🏆${p.wins} 💣${p.maxBombs} 🔥${p.power}</span>`,
    )
    .join("");
  const code = session.roomCode ? `<span class="code">房間代碼：${session.roomCode}</span>` : "";
  const html = players + code;
  if (html !== lastHud) hud.innerHTML = lastHud = html;

  let text = "";
  if (s.phase === "waiting") {
    text =
      s.players.length < 2
        ? `等待其他玩家加入…<br><small>分享房間代碼：${session.roomCode ?? ""}</small>`
        : `${s.players.length} 位玩家已就緒<br><small>按空白鍵開始</small>`;
  } else if (s.phase === "ended") {
    const w = s.players.find((p) => p.id === s.winner);
    text = w ? `🏆 ${escapeHtml(w.name)} 獲勝！` : "平手！";
  }
  if (text !== lastBanner) banner.innerHTML = lastBanner = text;
}
refreshHud();

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// 開發模式下方便除錯：在 console 輸入 __bm() 查看目前狀態
if (import.meta.env.DEV) (window as unknown as { __bm: () => Session | null }).__bm = () => session;
