// 威脅建模速查產生器：畫一張最簡單的 DFD（外部實體／流程／資料儲存／信任邊界／資料流），
// 分析時依 STRIDE-per-element-type 對照表（Microsoft 威脅建模方法論的簡化版）逐元素產生起手式問題；
// 資料流是否跨越信任邊界，用節點與邊界線的座標關係自動判斷，不用另外問使用者。
const strings = JSON.parse(document.getElementById("dfd-strings").textContent);
const SVG_NS = "http://www.w3.org/2000/svg";

const svg = document.getElementById("dfd-canvas");
const nodesG = document.getElementById("dfd-nodes");
const flowsG = document.getElementById("dfd-flows");
const boundariesG = document.getElementById("dfd-boundaries");
const statusEl = document.getElementById("dfd-status");
const resultEl = document.getElementById("dfd-result");
const groupsEl = document.getElementById("dfd-groups");
const copyBtn = document.getElementById("dfd-copy-btn");

const nodes = new Map(); // id -> { id, type, x, y, label }
const boundaries = new Map(); // id -> { id, x, label }
const flows = new Map(); // id -> { id, from, to, label }
let seq = 0;
const nextId = (prefix) => `${prefix}-${++seq}`;

let mode = null; // null | { adding: 'entity'|'process'|'store'|'boundary' } | { connecting: true, from: string|null }
let selected = null; // { kind: 'node'|'boundary'|'flow', id }
let dragging = null; // { kind, id, pointerId }

function setStatus(text) {
  statusEl.textContent = text;
}

function resetMode() {
  mode = null;
  setStatus(strings.defaultHint);
  svg.classList.remove("placing", "connecting");
}

function toSvgPoint(evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function nodeRadius(type) {
  return type === "process" ? 44 : type === "store" ? 62 : 58;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

let copyText = "";

function render() {
  nodesG.replaceChildren();
  flowsG.replaceChildren();
  boundariesG.replaceChildren();

  for (const b of boundaries.values()) renderBoundary(b);
  for (const f of flows.values()) renderFlow(f);
  for (const n of nodes.values()) renderNode(n);
}

function el(tag, attrs, parent) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}

function renderBoundary(b) {
  const g = el("g", { class: "dfd-boundary" + (isSelected("boundary", b.id) ? " selected" : ""), "data-boundary-id": b.id }, boundariesG);
  el("line", { x1: b.x, y1: 10, x2: b.x, y2: 410, class: "dfd-boundary-line" }, g);
  const labelWidth = Math.max(40, b.label.length * 7 + 12);
  el("rect", { x: b.x + 6, y: 14, width: labelWidth, height: 18, class: "dfd-label-bg" }, g);
  const t = el("text", { x: b.x + 6 + labelWidth / 2, y: 23, class: "dfd-boundary-label", "text-anchor": "middle", "dominant-baseline": "middle" }, g);
  t.textContent = b.label;
  g.addEventListener("pointerdown", (e) => onHandlePointerDown(e, "boundary", b.id));
  g.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    rename("boundary", b.id);
  });
}

function edgePoint(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const r = nodeRadius(from.type);
  return { x: from.x + (dx / dist) * r, y: from.y + (dy / dist) * r };
}

function boundariesCrossedBy(flow) {
  const a = nodes.get(flow.from);
  const b = nodes.get(flow.to);
  if (!a || !b) return [];
  return [...boundaries.values()].filter((bd) => (a.x - bd.x) * (b.x - bd.x) < 0);
}

function renderFlow(f) {
  const a = nodes.get(f.from);
  const b = nodes.get(f.to);
  if (!a || !b) return;
  const p1 = edgePoint(a, b);
  const p2 = edgePoint(b, a);
  const g = el("g", { class: "dfd-flow" + (isSelected("flow", f.id) ? " selected" : ""), "data-flow-id": f.id }, flowsG);
  el("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: "dfd-flow-line", "marker-end": "url(#dfd-arrow)" }, g);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const labelWidth = Math.max(30, f.label.length * 6.4 + 10);
  el("rect", { x: mx - labelWidth / 2, y: my - 10, width: labelWidth, height: 16, class: "dfd-label-bg" }, g);
  const t = el("text", { x: mx, y: my - 1, class: "dfd-flow-label", "text-anchor": "middle", "dominant-baseline": "middle" }, g);
  t.textContent = f.label;
  g.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (mode) return;
    selected = { kind: "flow", id: f.id };
    render();
  });
}

function renderNode(n) {
  const g = el("g", { class: `dfd-node dfd-${n.type}` + (isSelected("node", n.id) ? " selected" : ""), "data-node-id": n.id }, nodesG);
  if (n.type === "entity") {
    el("rect", { x: n.x - 55, y: n.y - 25, width: 110, height: 50, rx: 2, class: "dfd-shape" }, g);
  } else if (n.type === "process") {
    el("circle", { cx: n.x, cy: n.y, r: 42, class: "dfd-shape" }, g);
  } else {
    el("line", { x1: n.x - 60, y1: n.y - 25, x2: n.x + 60, y2: n.y - 25, class: "dfd-shape" }, g);
    el("line", { x1: n.x - 60, y1: n.y + 25, x2: n.x + 60, y2: n.y + 25, class: "dfd-shape" }, g);
  }
  const t = el("text", { x: n.x, y: n.y, class: "dfd-node-label", "text-anchor": "middle", "dominant-baseline": "middle" }, g);
  t.textContent = n.label;
  g.addEventListener("pointerdown", (e) => onHandlePointerDown(e, "node", n.id));
  g.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    rename("node", n.id);
  });
}

function isSelected(kind, id) {
  return selected && selected.kind === kind && selected.id === id;
}

function rename(kind, id) {
  const store = kind === "node" ? nodes : boundaries;
  const item = store.get(id);
  if (!item) return;
  const promptKey = kind === "node" ? item.type : "boundary";
  const next = prompt(strings.prompts[promptKey], item.label);
  if (next && next.trim()) {
    item.label = next.trim();
    render();
  }
}

function onHandlePointerDown(evt, kind, id) {
  evt.stopPropagation();
  if (mode && mode.connecting) {
    if (kind !== "node") return;
    if (!mode.from) {
      mode.from = id;
      setStatus(strings.connectHint);
      selected = { kind: "node", id };
      render();
    } else if (mode.from !== id) {
      const label = prompt(strings.prompts.flow, "");
      if (label && label.trim()) {
        const fid = nextId("flow");
        flows.set(fid, { id: fid, from: mode.from, to: id, label: label.trim() });
      }
      selected = null;
      resetMode();
      render();
    }
    return;
  }
  if (mode && mode.adding) return; // 放置模式下忽略既有元素的點擊，等畫布空白處點擊
  selected = { kind, id };
  dragging = { kind, id, pointerId: evt.pointerId };
  evt.currentTarget.setPointerCapture(evt.pointerId);
  render();
}

svg.addEventListener("pointermove", (evt) => {
  if (!dragging) return;
  const p = toSvgPoint(evt);
  if (dragging.kind === "node") {
    const n = nodes.get(dragging.id);
    if (!n) return;
    n.x = clamp(p.x, 40, 760);
    n.y = clamp(p.y, 30, 390);
  } else if (dragging.kind === "boundary") {
    const b = boundaries.get(dragging.id);
    if (!b) return;
    b.x = clamp(p.x, 20, 780);
  }
  render();
});

svg.addEventListener("pointerup", () => {
  dragging = null;
});

svg.addEventListener("pointerdown", (evt) => {
  if (evt.target !== svg) return; // 只處理畫布空白處，元素自己的 handler 已經 stopPropagation
  if (mode && mode.adding) {
    const p = toSvgPoint(evt);
    const type = mode.adding;
    if (type === "boundary") {
      const label = prompt(strings.prompts.boundary, strings.typeLabels.boundary) || strings.typeLabels.boundary;
      const id = nextId("boundary");
      boundaries.set(id, { id, x: clamp(p.x, 20, 780), label: label.trim() || strings.typeLabels.boundary });
    } else {
      const label = prompt(strings.prompts[type], strings.typeLabels[type]) || strings.typeLabels[type];
      const id = nextId(type);
      nodes.set(id, { id, type, x: clamp(p.x, 40, 760), y: clamp(p.y, 30, 390), label: label.trim() || strings.typeLabels[type] });
    }
    resetMode();
    render();
    return;
  }
  selected = null;
  render();
});

document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.addEventListener("click", () => {
    mode = { adding: btn.dataset.add };
    setStatus(strings.placingHint);
    svg.classList.add("placing");
    svg.classList.remove("connecting");
  });
});

document.getElementById("dfd-connect-btn").addEventListener("click", () => {
  if (mode && mode.connecting) {
    resetMode();
    return;
  }
  mode = { connecting: true, from: null };
  setStatus(strings.connectHint);
  svg.classList.add("connecting");
  svg.classList.remove("placing");
});

document.addEventListener("keydown", (evt) => {
  if (evt.key === "Escape" && mode) {
    selected = null;
    resetMode();
    render();
  }
});

document.getElementById("dfd-delete-btn").addEventListener("click", () => {
  if (!selected) return;
  if (selected.kind === "node") {
    nodes.delete(selected.id);
    for (const [fid, f] of flows) if (f.from === selected.id || f.to === selected.id) flows.delete(fid);
  } else if (selected.kind === "boundary") {
    boundaries.delete(selected.id);
  } else if (selected.kind === "flow") {
    flows.delete(selected.id);
  }
  selected = null;
  render();
});

document.getElementById("dfd-clear-btn").addEventListener("click", () => {
  if (nodes.size === 0 && boundaries.size === 0 && flows.size === 0) return;
  if (!confirm(strings.confirmClear)) return;
  nodes.clear();
  boundaries.clear();
  flows.clear();
  selected = null;
  resultEl.hidden = true;
  render();
});

function renderResultGroup(heading, items) {
  const group = document.createElement("div");
  group.className = "stride-group";
  const h4 = document.createElement("h4");
  h4.textContent = heading;
  const ul = document.createElement("ul");
  items.forEach(({ cat, text }) => {
    const li = document.createElement("li");
    li.textContent = `${cat} — ${text}`;
    ul.append(li);
  });
  group.append(h4, ul);
  groupsEl.append(group);
}

document.getElementById("dfd-analyze-btn").addEventListener("click", () => {
  if (nodes.size === 0 || flows.size === 0) {
    setStatus(strings.emptyHint);
    return;
  }
  groupsEl.replaceChildren();
  const lines = [];

  for (const n of nodes.values()) {
    const heading = `${strings.typeLabels[n.type]}「${n.label}」`;
    const items = strings.applicable[n.type].map((cat) => ({
      cat,
      text: strings.elementText[n.type][cat].replace("{name}", n.label),
    }));
    renderResultGroup(heading, items);
    lines.push(`## ${heading}`, ...items.map((i) => `- [ ] ${i.cat}: ${i.text}`), "");
  }

  for (const f of flows.values()) {
    const a = nodes.get(f.from);
    const b = nodes.get(f.to);
    if (!a || !b) continue;
    const heading = `${strings.typeLabels.flow}「${f.label}」（${a.label} → ${b.label}）`;
    const items = strings.applicable.flow.map((cat) => ({
      cat,
      text: strings.elementText.flow[cat].replace("{name}", f.label),
    }));
    boundariesCrossedBy(f).forEach((bd) => items.push({ cat: "!", text: strings.boundaryCross.replace("{boundary}", bd.label) }));
    renderResultGroup(heading, items);
    lines.push(`## ${heading}`, ...items.map((i) => `- [ ] ${i.cat}: ${i.text}`), "");
  }

  copyText = lines.join("\n");
  resultEl.hidden = false;
  if (navigator.clipboard) copyBtn.hidden = false;
});

if (copyBtn && navigator.clipboard) {
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(copyText);
    copyBtn.textContent = copyBtn.dataset.copied;
    setTimeout(() => {
      copyBtn.textContent = copyBtn.dataset.label;
    }, 1600);
  });
}

resetMode();
render();
