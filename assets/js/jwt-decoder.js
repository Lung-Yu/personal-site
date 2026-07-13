// JWT 解碼與風險檢查：純前端解析，不驗證簽章，不外送任何資料。
const strings = JSON.parse(document.getElementById("jwt-strings").textContent);

const input = document.getElementById("jwt-input");
const decodeBtn = document.getElementById("jwt-decode-btn");
const clearBtn = document.getElementById("jwt-clear-btn");
const errorEl = document.getElementById("jwt-error");
const resultEl = document.getElementById("jwt-result");
const headerEl = document.getElementById("jwt-header");
const payloadEl = document.getElementById("jwt-payload");
const findingsEl = document.getElementById("jwt-findings");

const SENSITIVE_KEYS = /pass(word)?|secret|token|ssn|credit.?card|pwd|private.?key|api.?key/i;

function b64urlDecode(segment) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
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

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
  resultEl.hidden = true;
}

function decode() {
  errorEl.hidden = true;
  const raw = input.value.trim();
  const parts = raw.split(".");
  // 簽章段（第 3 段）可以是空字串——alg:none 的未簽章 token 就是這樣，屬於本工具要標註的風險，不是格式錯誤。
  if (parts.length < 2 || parts.length > 3 || parts[0].length === 0 || parts[1].length === 0) {
    showError(strings.errFormat);
    return;
  }

  let header, payload;
  try {
    header = JSON.parse(b64urlDecode(parts[0]));
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch {
    showError(strings.errJson);
    return;
  }

  headerEl.textContent = JSON.stringify(header, null, 2);
  payloadEl.textContent = JSON.stringify(payload, null, 2);

  const findings = [];
  if (header.alg === "none") findings.push(renderFinding(strings.f.algNone));
  if (payload.exp === undefined) {
    findings.push(renderFinding(strings.f.noExp));
  } else {
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) findings.push(renderFinding(strings.f.expired));
    if (typeof payload.iat === "number" && typeof payload.exp === "number" && payload.exp - payload.iat > 30 * 86400) {
      findings.push(renderFinding(strings.f.longLived));
    }
  }
  const sensitiveKeys = Object.keys(payload).filter((k) => SENSITIVE_KEYS.test(k));
  if (sensitiveKeys.length > 0) findings.push(renderFinding(strings.f.sensitive, { fields: sensitiveKeys.join(", ") }));
  if (typeof header.alg === "string" && /^HS\d+$/.test(header.alg)) findings.push(renderFinding(strings.f.hmac, { alg: header.alg }));

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

decodeBtn.addEventListener("click", decode);
clearBtn.addEventListener("click", () => {
  input.value = "";
  errorEl.hidden = true;
  resultEl.hidden = true;
  input.focus();
});
