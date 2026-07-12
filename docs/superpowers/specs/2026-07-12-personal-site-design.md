# 個人專業網站設計文件

日期：2026-07-12
狀態：使用者已於對話中逐項確認（區塊內容、雙語、GitHub Pages、Hugo、Three.js 3D）

## 目標

展示安全軟體開發專業的個人網站：專業認證、顧問/教學服務、專案作品集。
GitHub Actions CI/CD 部署至 GitHub Pages。資料易擴充維護。本地以
podman/docker-compose 啟動與測試。開發嚴格遵循 ponytail 極簡原則，
關鍵業務情境有測試保護。

## 範圍

- 本次：關於我＋專業認證、服務項目、專案/作品集（單頁式，中英雙語）
- 未來展望（不實作，僅預留）：部落格文章（Hugo 原生 `content/posts/` 可直接擴充）

## 架構

- **Hugo** 靜態網站，多語系內建功能：`/`（繁中，預設）與 `/en/`
- **零後端**。前端 JS 僅兩件事：Three.js hero 場景、IntersectionObserver 滾動進場
- **CI/CD**：push main → 測試 → `hugo --minify` → `actions/deploy-pages`。測試失敗不部署
- **本地**：`compose.yaml`（相容 podman-compose / docker compose）
  - `site` 服務：`hugo server` 即時預覽（localhost:1313）
  - `test` 服務：跑測試腳本

## 資料模型（擴充維護核心）

內容與版面完全分離；新增條目只改 YAML，不碰樣板：

```yaml
# data/certifications.yaml
- id: cissp          # 穩定識別碼
  name: CISSP        # 認證名稱（通常無需翻譯）
  issuer: ISC2
  year: 2021
  url: https://...   # 選填
```

- `data/certifications.yaml`、`data/services.yaml`、`data/projects.yaml`
- 需雙語的欄位採 `title: {zh: ..., en: ...}` 巢狀結構
- `i18n/zh-tw.yaml`、`i18n/en.yaml`：介面固定文字
- 關於我：`content/_index.md`（zh）與 `content/_index.en.md`（en）Markdown
- 初版放結構完整的示意資料，使用者後續直接改 YAML 填真實內容

## 頁面與視覺

- 單頁式首頁：hero（3D）→ 關於我 → 認證 → 服務 → 專案，錨點導覽＋語言切換
- 視覺風格：《魔鬼的計謀》暗色電影感——深藍黑底、金色點綴、幾何立體物件
- **Three.js**（使用者明確要求的例外依賴）：hero 渲染漂浮幾何多面體，
  滑鼠視差轉動；pinned 版本、自行 vendor 到 repo（不用第三方 CDN，
  符合安全專業形象與供應鏈考量）
- 內容區塊：輕量 CSS 滾動進場動畫
- 尊重 `prefers-reduced-motion`：關閉動畫、3D 場景呈靜態
- CSP meta tag、無任何外部資源請求

## 測試（關鍵業務情境）

一個測試腳本（`tests/test_site.py`，本地與 CI 都跑），守住：

1. **資料完整性**：每筆條目必要欄位齊全、雙語欄位 zh/en 都有值
   →「加資料不會弄壞網站」
2. **建置正確性**：`/index.html` 與 `/en/index.html` 都產出，
   每筆資料條目確實出現在兩種語言頁面
3. **資源有效性**：頁面引用的本地資源（CSS/JS/圖片）確實存在於產出中

## ponytail 合規備註

- 不用現成 Hugo theme（數千行冗餘）；自寫最少樣板
- 不引入 npm/Node 建置鏈；Three.js 直接 vendor 單檔
- 測試僅一檔、無測試框架
- Three.js 為使用者明確要求（「明確要求的事不懶」條款）
