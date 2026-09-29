# 炸彈超人專案

## 工作規則
- 每完成一項修改：先 `npm run typecheck`，通過後立刻 `git commit`（繁體中文 commit 訊息）。post-commit hook 會自動 push 到 GitHub，不需要另外 push。
- 使用者說「發版」或「發 vX.Y.Z」時：執行 `npm version <patch|minor|major|X.Y.Z> -m "發布 v%s"`，會自動打標籤並 push，觸發 release workflow。
- 遊戲規則只寫在 `shared/game.ts`，保持純邏輯（無 DOM、無網路），伺服器與前端共用。
- 規則或場景有變動時，同步更新 `docs/DESIGN.md` 的實作進度。

## 開發
- `npm run dev` 同時啟動伺服器（2567）與前端（5173）
- 開發模式下瀏覽器 console 可用 `__bm()` 查看目前遊戲狀態
- 版本：Colyseus 0.16、colyseus.js 0.16、Phaser 3.90（刻意鎖在這些版本，升級前先確認 API 變動）
