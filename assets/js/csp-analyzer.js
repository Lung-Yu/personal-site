// CSP 政策分析器：純字串解析，不送出任何資料。
const strings = JSON.parse(document.getElementById("csp-strings").textContent);

const input = document.getElementById("csp-input");
const analyzeBtn = document.getElementById("csp-analyze-btn");
const clearBtn = document.getElementById("csp-clear-btn");
const errorEl = document.getElementById("csp-error");
const resultEl = document.getElementById("csp-result");
const directivesEl = document.getElementById("csp-directives");
const findingsEl = document.getElementById("csp-findings");

function parseCsp(text) {
  const directives = {};
  text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [name, ...sources] = entry.split(/\s+/);
      directives[name.toLowerCase()] = sources;
    });
  return directives;
}

function renderFinding(f, extra) {
  const desc = extra ? f.desc.replace(/\{(\w+)\}/g, (_, k) => extra[k] ?? "") : f.desc;
  const el = document.createElement("div");
  el.className = "finding";
  el.dataset.level = f.level;
  const level = document.createElement("div");
  level.className = "finding-level";
  level.textContent = f.level;
  const title = document.createElement("div");
  title.className = "finding-title";
  title.textContent = f.title;
  const body = document.createElement("div");
  body.className = "finding-desc";
  body.textContent = desc;
  el.append(level, title, body);
  return el;
}

function analyze() {
  errorEl.hidden = true;
  const raw = input.value.trim();
  if (!raw) {
    errorEl.textContent = strings.errEmpty;
    errorEl.hidden = false;
    resultEl.hidden = true;
    return;
  }

  const directives = parseCsp(raw);
  directivesEl.replaceChildren();
  for (const [name, sources] of Object.entries(directives)) {
    const tr = document.createElement("tr");
    const th = document.createElement("td");
    th.textContent = name;
    const td = document.createElement("td");
    td.textContent = sources.join(" ") || "(empty)";
    tr.append(th, td);
    directivesEl.append(tr);
  }

  const findings = [];
  const scriptSrc = directives["script-src"] || directives["default-src"];
  const scriptDirectiveName = directives["script-src"] ? "script-src" : "default-src";
  if (scriptSrc) {
    if (scriptSrc.includes("'unsafe-inline'")) findings.push(renderFinding(strings.f.unsafeInline, { directive: scriptDirectiveName }));
    if (scriptSrc.includes("'unsafe-eval'")) findings.push(renderFinding(strings.f.unsafeEval, { directive: scriptDirectiveName }));
    const wild = scriptSrc.find((s) => s === "*" || s === "http:" || s === "https:");
    if (wild) findings.push(renderFinding(strings.f.wildcard, { directive: scriptDirectiveName, source: wild }));
  }

  const styleSrc = directives["style-src"] || directives["default-src"];
  if (styleSrc && styleSrc.includes("'unsafe-inline'")) findings.push(renderFinding(strings.f.styleUnsafeInline));

  // 只有 script-src 已明確設定時才需要獨立檢查 default-src 的萬用字元，
  // 否則上面的 wildcard 檢查（透過 fallback）已經涵蓋這個情況，避免重複回報。
  if (directives["script-src"] && directives["default-src"]) {
    const wild = directives["default-src"].find((s) => s === "*" || s === "http:" || s === "https:");
    if (wild) findings.push(renderFinding(strings.f.defaultWildcard, { source: wild }));
  }

  if (!directives["object-src"] && !directives["default-src"]) findings.push(renderFinding(strings.f.noObjectSrc));
  if (!directives["base-uri"]) findings.push(renderFinding(strings.f.noBaseUri));
  if (!directives["frame-ancestors"]) findings.push(renderFinding(strings.f.noFrameAncestors));
  if (!directives["default-src"]) findings.push(renderFinding(strings.f.noDefaultSrc));
  if (!directives["report-uri"] && !directives["report-to"]) findings.push(renderFinding(strings.f.noReport));

  findingsEl.replaceChildren();
  if (findings.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tool-empty";
    empty.textContent = strings.noFindings;
    findingsEl.append(empty);
  } else {
    findingsEl.append(...findings);
  }
  resultEl.hidden = false;
}

analyzeBtn.addEventListener("click", analyze);
clearBtn.addEventListener("click", () => {
  input.value = "";
  errorEl.hidden = true;
  resultEl.hidden = true;
  input.focus();
});
