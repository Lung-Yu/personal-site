#!/usr/bin/env python3
"""守住三個關鍵情境：資料完整性、雙語建置正確性、本地資源有效性。

用法：先 `hugo --minify` 產出 public/，再執行本腳本。
"""
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# 各資料檔的必要欄位；BILINGUAL 欄位須為 {zh: ..., en: ...} 且兩者皆非空
REQUIRED = {
    "certifications": ["id", "name", "issuer", "year"],
    "services": ["id", "title", "description"],
    "projects": ["id", "title", "description"],
}
BILINGUAL = {"title", "description"}

failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)
    return cond


# 1. 資料完整性
entries = {}
for name, fields in REQUIRED.items():
    path = ROOT / "data" / f"{name}.yaml"
    if not check(path.exists(), f"缺少資料檔 {path.relative_to(ROOT)}"):
        continue
    items = yaml.safe_load(path.read_text()) or []
    check(items, f"{name}: 至少要有一筆資料")
    ids = [i.get("id") for i in items]
    check(len(ids) == len(set(ids)), f"{name}: id 重複 {ids}")
    for item in items:
        label = f"{name}/{item.get('id', '?')}"
        for f in fields:
            v = item.get(f)
            if not check(v not in (None, ""), f"{label}: 缺欄位 {f}"):
                continue
            if f in BILINGUAL:
                check(
                    isinstance(v, dict) and v.get("zh") and v.get("en"),
                    f"{label}: {f} 必須同時有 zh 與 en",
                )
    entries[name] = items

# 2. 雙語建置正確性：每筆條目都要出現在對應語言頁面
for lang, page in [("zh", PUBLIC / "index.html"), ("en", PUBLIC / "en" / "index.html")]:
    if not check(page.exists(), f"未產出 {page.relative_to(ROOT)}（先執行 hugo）"):
        continue
    html = page.read_text()
    for name, items in entries.items():
        for item in items:
            probe = item.get("name") or item["title"][lang]
            check(probe in html, f"{lang} 頁面缺少 {name}/{item['id']}")

# 3. 本地資源有效性：頁面引用的站內資源都存在於產出
if PUBLIC.exists():
    for page in PUBLIC.rglob("*.html"):
        for ref in re.findall(r'(?:src|href)="([^"#?]+)', page.read_text()):
            if re.match(r"https?:|mailto:|//", ref):
                continue
            target = (PUBLIC / ref.lstrip("/")) if ref.startswith("/") else (page.parent / ref)
            if target.is_dir():
                target = target / "index.html"
            check(target.exists(), f"{page.relative_to(PUBLIC)} 引用不存在的資源 {ref}")

if failures:
    print(f"FAIL ({len(failures)}):")
    print("\n".join(f"  - {m}" for m in failures))
    sys.exit(1)
print("OK: 資料完整性、雙語建置、資源有效性 全數通過")
