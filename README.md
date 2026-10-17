# 🏁 Sparkle Q4 遊戲 — Q4 Game

手機版跑數競賽。終點線 **250,000 分**。

## 兩頁

| 頁面 | 用途 |
|---|---|
| `index.html` | 衝線頁：全團隊總進度 + 全員總覽（一人一條 bar）+ 各人詳細距離 |
| `enter.html` | 入數頁：揀名 → 填分數 → 提交 → 自動跳去衝線頁睇全部人進度 |

## 設定

- **終點分數**：`data.js` 第一行 `const FINISH = 250000;`
- **人員名單**：`data.js` 嘅 `ROSTER` 陣列。提交後亦可以撳住標題「🏁 Sparkle Q4 遊戲」約 1 秒開管理面板，即場加人／刪人／貼上整段名單。

## 儲存

分數存喺該裝置嘅瀏覽器 `localStorage`（key: `q4_race_*`）。同一個 repo 可以用
「⬇️ 匯出 / ⬆️ 匯入」搬分數。

## 部署

GitHub Pages，從 `main` 分支 root 出。開法：Settings → Pages → Source = Deploy from a branch → `main` / `/ (root)`。
