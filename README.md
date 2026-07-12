# 個人專業網站

安全軟體開發顧問形象網站。Hugo 靜態網站、中英雙語、Three.js 3D hero，
GitHub Actions 自動測試與部署至 GitHub Pages。

## 本地開發（podman 或 docker）

```sh
podman-compose up          # 或 docker compose up
# → http://localhost:1313 （改檔案即時重載）

podman-compose run --rm test   # 或 docker compose run --rm test
# → 建置 + 執行 tests/test_site.py
```

## 更新內容（不需要碰程式碼）

| 想改什麼 | 改哪個檔 |
|---|---|
| 新增/修改認證 | `data/certifications.yaml` |
| 新增/修改服務 | `data/services.yaml` |
| 新增/修改專案 | `data/projects.yaml` |
| 關於我（中/英） | `content/_index.md` / `content/_index.en.md` |
| 介面文字翻譯 | `i18n/zh-tw.yaml` / `i18n/en.yaml` |
| 聯絡 email / GitHub | `hugo.yaml` 的 `params` |

雙語欄位規則：`title`、`description` 必須同時提供 `zh` 與 `en`，
測試會擋下缺漏，push 後 CI 測試不過就不會部署。

## 部署

push 到 `main` → GitHub Actions 跑測試 → 建置 → 部署 GitHub Pages。

## 架構備註

- 設計文件：`docs/superpowers/specs/2026-07-12-personal-site-design.md`
- Three.js v0.185.1 直接 vendor 於 `static/js/`（無第三方 CDN、無 npm 建置鏈）
- 測試：`tests/test_site.py`（資料完整性、雙語建置、資源有效性）
- 未來擴充部落格：直接新增 `content/posts/`，Hugo 原生支援
