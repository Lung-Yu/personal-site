// CSP 政策分析器：純字串解析，不送出任何資料。
const strings = JSON.parse(document.getElementById("csp-strings").textContent);

const input = document.getElementById("csp-input");
const analyzeBtn = document.getElementById("csp-analyze-btn");
const sampleBtn = document.getElementById("csp-sample-btn");
const clearBtn = document.getElementById("csp-clear-btn");
const errorEl = document.getElementById("csp-error");
const resultEl = document.getElementById("csp-result");
const directivesEl = document.getElementById("csp-directives");
const findingsEl = document.getElementById("csp-findings");
const templateTextEl = document.getElementById("csp-template-text");
const templateCopyBtn = document.getElementById("csp-template-copy-btn");
const fixedEl = document.getElementById("csp-fixed");
const fixedTextEl = document.getElementById("csp-fixed-text");
const fixedCopyBtn = document.getElementById("csp-fixed-copy-btn");

// 刻意選一個混雜多種常見弱點的範例，讓使用者一鍵看到工具實際能抓出什麼。
const SAMPLE_CSP =
  "default-src *; script-src 'self' 'unsafe-inline' https://cdn.example.com; style-src 'self' 'unsafe-inline'; img-src * data:; connect-src 'self' https://api.example.com";

// 從嚴格預設值出發的起手式範本，呼應本站自己的 CSP 設計哲學。
const TEMPLATE_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';";

const DIRECTIVE_ORDER = [
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
  "media-src",
  "object-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
  "manifest-src",
  "worker-src",
  "child-src",
];

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

// 依偵測到的問題類型，把對應的高風險設定拿掉、補上常見遺漏指令，產生一份可直接複製的修正版本。
// report-uri/report-to 需要真實的回報端點，不會自動補上（留在 findings 說明裡讓使用者自行決定端點）。
function buildFixedDirectives(directives, keys) {
  const fixed = {};
  for (const [name, sources] of Object.entries(directives)) fixed[name] = [...sources];

  const scriptKey = fixed["script-src"] ? "script-src" : fixed["default-src"] ? "default-src" : null;
  if (scriptKey && (keys.has("unsafeInline") || keys.has("unsafeEval") || keys.has("wildcard"))) {
    fixed[scriptKey] = fixed[scriptKey].filter((s) => !["'unsafe-inline'", "'unsafe-eval'", "*", "http:", "https:"].includes(s));
    if (fixed[scriptKey].length === 0) fixed[scriptKey] = ["'self'"];
  }

  const styleKey = fixed["style-src"] ? "style-src" : fixed["default-src"] ? "default-src" : null;
  if (styleKey && keys.has("styleUnsafeInline")) {
    fixed[styleKey] = fixed[styleKey].filter((s) => s !== "'unsafe-inline'");
    if (fixed[styleKey].length === 0) fixed[styleKey] = ["'self'"];
  }

  if (keys.has("defaultWildcard") && fixed["default-src"]) {
    fixed["default-src"] = fixed["default-src"].filter((s) => !["*", "http:", "https:"].includes(s));
    if (fixed["default-src"].length === 0) fixed["default-src"] = ["'self'"];
  }

  if (keys.has("noDefaultSrc")) fixed["default-src"] = ["'self'"];
  if (keys.has("noObjectSrc")) fixed["object-src"] = ["'none'"];
  if (keys.has("noBaseUri")) fixed["base-uri"] = ["'self'"];
  if (keys.has("noFrameAncestors")) fixed["frame-ancestors"] = ["'self'"];

  return fixed;
}

function serializeDirectives(directives) {
  const lines = [];
  const seen = new Set();
  for (const name of DIRECTIVE_ORDER) {
    if (directives[name]) {
      lines.push(`${name} ${directives[name].join(" ")}`);
      seen.add(name);
    }
  }
  for (const [name, sources] of Object.entries(directives)) {
    if (!seen.has(name)) lines.push(`${name} ${sources.join(" ")}`);
  }
  return lines.join("; ") + ";";
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
  const findingKeys = new Set();
  const addFinding = (key, extra) => {
    findings.push(renderFinding(strings.f[key], extra));
    findingKeys.add(key);
  };

  const scriptSrc = directives["script-src"] || directives["default-src"];
  const scriptDirectiveName = directives["script-src"] ? "script-src" : "default-src";
  if (scriptSrc) {
    if (scriptSrc.includes("'unsafe-inline'")) addFinding("unsafeInline", { directive: scriptDirectiveName });
    if (scriptSrc.includes("'unsafe-eval'")) addFinding("unsafeEval", { directive: scriptDirectiveName });
    const wild = scriptSrc.find((s) => s === "*" || s === "http:" || s === "https:");
    if (wild) addFinding("wildcard", { directive: scriptDirectiveName, source: wild });
  }

  const styleSrc = directives["style-src"] || directives["default-src"];
  if (styleSrc && styleSrc.includes("'unsafe-inline'")) addFinding("styleUnsafeInline");

  // 只有 script-src 已明確設定時才需要獨立檢查 default-src 的萬用字元，
  // 否則上面的 wildcard 檢查（透過 fallback）已經涵蓋這個情況，避免重複回報。
  if (directives["script-src"] && directives["default-src"]) {
    const wild = directives["default-src"].find((s) => s === "*" || s === "http:" || s === "https:");
    if (wild) addFinding("defaultWildcard", { source: wild });
  }

  if (!directives["object-src"] && !directives["default-src"]) addFinding("noObjectSrc");
  if (!directives["base-uri"]) addFinding("noBaseUri");
  if (!directives["frame-ancestors"]) addFinding("noFrameAncestors");
  if (!directives["default-src"]) addFinding("noDefaultSrc");
  if (!directives["report-uri"] && !directives["report-to"]) addFinding("noReport");

  findingsEl.replaceChildren();
  if (findings.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tool-empty";
    empty.textContent = strings.noFindings;
    findingsEl.append(empty);
    fixedEl.hidden = true;
  } else {
    findingsEl.append(...findings);
    const fixedDirectives = buildFixedDirectives(directives, findingKeys);
    fixedTextEl.textContent = serializeDirectives(fixedDirectives);
    fixedEl.hidden = false;
  }
  resultEl.hidden = false;
}

function setupCopyButton(btn, getText) {
  if (!navigator.clipboard) {
    btn.remove();
    return;
  }
  btn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(getText());
    btn.textContent = btn.dataset.copied;
    setTimeout(() => {
      btn.textContent = btn.dataset.label;
    }, 1600);
  });
}

templateTextEl.textContent = TEMPLATE_CSP;
setupCopyButton(templateCopyBtn, () => TEMPLATE_CSP);
setupCopyButton(fixedCopyBtn, () => fixedTextEl.textContent);

analyzeBtn.addEventListener("click", analyze);
sampleBtn.addEventListener("click", () => {
  input.value = SAMPLE_CSP;
  analyze();
});
clearBtn.addEventListener("click", () => {
  input.value = "";
  errorEl.hidden = true;
  resultEl.hidden = true;
  input.focus();
});
