# 💣 炸彈超人

網頁版多人連線炸彈超人。TypeScript + Phaser 3（前端）+ Colyseus（連線伺服器）。

## 開始開發

```bash
npm install
npm run dev
```

- 遊戲：http://localhost:5173
- 伺服器：ws://localhost:2567
- 同一個網路下的朋友可以用終端機顯示的 `Network` 網址連進來一起玩

## 操作

| 模式 | 移動 | 放炸彈 |
|---|---|---|
| 本機 P1 | WASD | 空白鍵 |
| 本機 P2 | 方向鍵 | Enter |
| 線上 | WASD / 方向鍵 | 空白鍵 |

`Esc` 回選單。

## 專案結構

```
shared/game.ts    遊戲規則核心（伺服器與前端共用）
server/           Colyseus 伺服器（權威判定）
client/           網頁前端（Phaser 繪圖、選單、連線）
docs/DESIGN.md    遊戲設計文件
.github/workflows 自動部署與發布
```

## 自動化

| 時機 | 自動執行 |
|---|---|
| 每次 `git commit` | 自動 push 到 GitHub（`.githooks/post-commit`） |
| push 到 `main` | 網頁版部署到 GitHub Pages |
| push 到 `main` 且改到 server/shared | 伺服器部署到 Fly.io（需設定 `FLY_API_TOKEN`） |
| `npm version patch`（或 minor / major） | 版本號 +1、打標籤、push，GitHub 自動建立 Release |

### 啟用線上對戰伺服器（一次性設定）

1. 到 [fly.io](https://fly.io) 註冊，安裝 `flyctl` 並登入
2. 把 `fly.toml` 的 `app` 改成自己的名稱，執行 `fly launch --no-deploy --copy-config`
3. `fly tokens create deploy` 產生 token，貼到 GitHub repo → Settings → Secrets → Actions，名稱 `FLY_API_TOKEN`
4. GitHub repo → Settings → Variables → Actions 新增 `SERVER_URL`，值為 `wss://<你的 app 名稱>.fly.dev`
