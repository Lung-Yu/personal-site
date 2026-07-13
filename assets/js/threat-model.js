// 威脅建模速查產生器：畫一張最簡單的 DFD（外部實體／流程／資料儲存／信任邊界／資料流），
// 分析時依 STRIDE-per-element-type 對照表（Microsoft 威脅建模方法論的簡化版）逐元素產生起手式問題；
// 資料流是否跨越信任邊界，用節點與邊界線的座標關係自動判斷，不用另外問使用者。
//
// 命名一律用畫布內就地編輯（foreignObject 疊一個 <input>），不彈對話框——新增元素時直接
// 帶入編號預設名稱並立刻進入編輯，雙擊既有元素也是同一套機制。只有「清空畫布」這種
// 破壞性操作才用（非阻斷式的）confirm 對話框。
const strings = JSON.parse(document.getElementById("dfd-strings").textContent);
const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

const svg = document.getElementById("dfd-canvas");
const nodesG = document.getElementById("dfd-nodes");
const flowsG = document.getElementById("dfd-flows");
const boundariesG = document.getElementById("dfd-boundaries");
const statusEl = document.getElementById("dfd-status");
const resultEl = document.getElementById("dfd-result");
const groupsEl = document.getElementById("dfd-groups");
const copyBtn = document.getElementById("dfd-copy-btn");

const dialogEl = document.getElementById("dfd-dialog");
const dialogTitle = document.getElementById("dfd-dialog-title");
const dialogCancel = document.getElementById("dfd-dialog-cancel");

dialogEl.addEventListener("click", (evt) => {
  if (evt.target === dialogEl) dialogEl.close("cancel"); // 點背景（::backdrop 命中 dialog 本身）視為取消
});
dialogCancel.addEventListener("click", () => dialogEl.close("cancel"));

// 只用於破壞性操作的確認（是/否），不做文字輸入
function openConfirm(title) {
  return new Promise((resolve) => {
    dialogTitle.textContent = title;
    dialogEl.returnValue = "";
    const onClose = () => {
      dialogEl.removeEventListener("close", onClose);
      resolve(dialogEl.returnValue === "ok");
    };
    dialogEl.addEventListener("close", onClose);
    dialogEl.showModal();
    dialogEl.querySelector("button[value='ok']").focus();
  });
}

const nodes = new Map(); // id -> { id, type, x, y, label }
const boundaries = new Map(); // id -> { id, x, label }
const flows = new Map(); // id -> { id, from, to, label }
let seq = 0;
const nextId = (prefix) => `${prefix}-${++seq}`;

let mode = null; // null | { adding: 'entity'|'process'|'store'|'boundary' } | { connecting: true }
let selected = null; // { kind: 'node'|'boundary'|'flow', id }
let editing = null; // { kind: 'node'|'boundary'|'flow', id } — 目前正在就地編輯標籤的元素
let dragging = null; // { kind, id }
let connectDrag = null; // { from: nodeId, x, y } — 連接資料流時，拖曳中的暫時線

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

function nextDefaultLabel(kind, type) {
  if (kind === "node") {
    const count = [...nodes.values()].filter((n) => n.type === type).length + 1;
    return `${strings.typeLabels[type]} ${count}`;
  }
  if (kind === "boundary") return `${strings.typeLabels.boundary} ${boundaries.size + 1}`;
  return `${strings.typeLabels.flow} ${flows.size + 1}`;
}

let copyText = "";

function el(tag, attrs, parent) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}

function isSelected(kind, id) {
  return selected && selected.kind === kind && selected.id === id;
}

function isEditing(kind, id) {
  return editing && editing.kind === kind && editing.id === id;
}

function startEdit(kind, id) {
  editing = { kind, id };
  selected = { kind, id };
  render();
}

function commitEdit(rawValue) {
  if (!editing) return;
  const store = editing.kind === "node" ? nodes : editing.kind === "boundary" ? boundaries : flows;
  const item = store.get(editing.id);
  editing = null;
  if (item) {
    const value = rawValue.trim();
    if (value) item.label = value;
    render();
  }
}

function cancelEdit() {
  editing = null;
  render();
}

// 在 SVG 座標 (cx,cy) 疊一個置中的可編輯輸入框，用於就地改標籤
function renderEditInput(cx, cy, width, height, value, parent) {
  const fo = el("foreignObject", { x: cx - width / 2, y: cy - height / 2, width, height }, parent);
  const input = document.createElementNS(XHTML_NS, "input");
  input.type = "text";
  input.className = "dfd-inline-input";
  input.value = value;
  input.autocomplete = "off";
  fo.append(input);
  input.addEventListener("pointerdown", (e) => e.stopPropagation());
  input.addEventListener("dblclick", (e) => e.stopPropagation());
  input.addEventListener("blur", () => commitEdit(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  });
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
  return fo;
}

function render() {
  nodesG.replaceChildren();
  flowsG.replaceChildren();
  boundariesG.replaceChildren();

  for (const b of boundaries.values()) renderBoundary(b);
  for (const f of flows.values()) renderFlow(f);
  if (connectDrag) renderTempLine(connectDrag);
  for (const n of nodes.values()) renderNode(n);
}

function renderBoundary(b) {
  const g = el("g", { class: "dfd-boundary" + (isSelected("boundary", b.id) ? " selected" : ""), "data-boundary-id": b.id }, boundariesG);
  el("line", { x1: b.x, y1: 10, x2: b.x, y2: 410, class: "dfd-boundary-line" }, g);
  if (isEditing("boundary", b.id)) {
    renderEditInput(b.x + 66, 23, 120, 20, b.label, g);
  } else {
    const labelWidth = Math.max(40, b.label.length * 7 + 12);
    el("rect", { x: b.x + 6, y: 14, width: labelWidth, height: 18, class: "dfd-label-bg" }, g);
    const t = el("text", { x: b.x + 6 + labelWidth / 2, y: 23, class: "dfd-boundary-label", "text-anchor": "middle", "dominant-baseline": "middle" }, g);
    t.textContent = b.label;
  }
  g.addEventListener("pointerdown", (e) => onHandlePointerDown(e, "boundary", b.id));
  g.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    startEdit("boundary", b.id);
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
  if (isEditing("flow", f.id)) {
    renderEditInput(mx, my, 110, 20, f.label, g);
  } else {
    const labelWidth = Math.max(30, f.label.length * 6.4 + 10);
    el("rect", { x: mx - labelWidth / 2, y: my - 10, width: labelWidth, height: 16, class: "dfd-label-bg" }, g);
    const t = el("text", { x: mx, y: my - 1, class: "dfd-flow-label", "text-anchor": "middle", "dominant-baseline": "middle" }, g);
    t.textContent = f.label;
  }
  g.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (mode) return;
    selected = { kind: "flow", id: f.id };
    render();
  });
  g.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    startEdit("flow", f.id);
  });
}

function renderTempLine(cd) {
  const from = nodes.get(cd.from);
  if (!from) return;
  el("line", { x1: from.x, y1: from.y, x2: cd.x, y2: cd.y, class: "dfd-temp-line", "marker-end": "url(#dfd-arrow)" }, flowsG);
}

function renderNode(n) {
  const g = el("g", { class: `dfd-node dfd-${n.type}` + (isSelected("node", n.id) ? " selected" : "") + (connectDrag && connectDrag.from === n.id ? " connect-source" : ""), "data-node-id": n.id }, nodesG);
  if (n.type === "entity") {
    el("rect", { x: n.x - 55, y: n.y - 25, width: 110, height: 50, rx: 2, class: "dfd-shape" }, g);
  } else if (n.type === "process") {
    el("circle", { cx: n.x, cy: n.y, r: 42, class: "dfd-shape" }, g);
  } else {
    // 開放式方框（資料儲存）只有上下兩條線，中間視覺上是空的——
    // 但 elementFromPoint 需要一個實際「有塗色」的區域才能命中，
    // 所以另外疊一塊完全透明但仍可命中的矩形，讓拖曳連線放開在方框中間也偵測得到。
    el("rect", { x: n.x - 60, y: n.y - 25, width: 120, height: 50, class: "dfd-hit-area" }, g);
    el("line", { x1: n.x - 60, y1: n.y - 25, x2: n.x + 60, y2: n.y - 25, class: "dfd-shape" }, g);
    el("line", { x1: n.x - 60, y1: n.y + 25, x2: n.x + 60, y2: n.y + 25, class: "dfd-shape" }, g);
  }
  if (isEditing("node", n.id)) {
    renderEditInput(n.x, n.y, 100, 22, n.label, g);
  } else {
    const t = el("text", { x: n.x, y: n.y, class: "dfd-node-label", "text-anchor": "middle", "dominant-baseline": "middle" }, g);
    t.textContent = n.label;
  }
  g.addEventListener("pointerdown", (e) => onHandlePointerDown(e, "node", n.id));
  g.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    startEdit("node", n.id);
  });
}

function onHandlePointerDown(evt, kind, id) {
  evt.stopPropagation();
  if (editing) return; // 正在編輯時，忽略其他元素的點擊，讓 blur 先把編輯內容存掉
  if (mode && mode.adding) return; // 放置模式下忽略既有元素，等畫布空白處點擊
  if (mode && mode.connecting) {
    if (kind !== "node") return;
    const n = nodes.get(id);
    connectDrag = { from: id, x: n.x, y: n.y };
    svg.setPointerCapture(evt.pointerId);
    render();
    return;
  }
  selected = { kind, id };
  dragging = { kind, id };
  svg.setPointerCapture(evt.pointerId);
  render();
}

svg.addEventListener("pointermove", (evt) => {
  if (!dragging && !connectDrag) return;
  const p = toSvgPoint(evt);
  if (dragging) {
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
  } else if (connectDrag) {
    connectDrag.x = p.x;
    connectDrag.y = p.y;
  }
  render();
});

svg.addEventListener("pointerup", (evt) => {
  if (dragging) {
    dragging = null;
    return;
  }
  if (connectDrag) {
    const fromId = connectDrag.from;
    connectDrag = null;
    const targetEl = document.elementFromPoint(evt.clientX, evt.clientY)?.closest("[data-node-id]");
    const toId = targetEl?.dataset.nodeId;
    if (toId && toId !== fromId) {
      const fid = nextId("flow");
      flows.set(fid, { id: fid, from: fromId, to: toId, label: nextDefaultLabel("flow") });
      resetMode();
      startEdit("flow", fid);
    } else {
      render();
    }
  }
});

svg.addEventListener("pointerdown", (evt) => {
  if (evt.target !== svg) return; // 只處理畫布空白處，元素自己的 handler 已經 stopPropagation
  if (mode && mode.adding) {
    const p = toSvgPoint(evt);
    const type = mode.adding;
    resetMode();
    if (type === "boundary") {
      const id = nextId("boundary");
      boundaries.set(id, { id, x: clamp(p.x, 20, 780), label: nextDefaultLabel("boundary") });
      startEdit("boundary", id);
    } else {
      const id = nextId(type);
      nodes.set(id, { id, type, x: clamp(p.x, 40, 760), y: clamp(p.y, 30, 390), label: nextDefaultLabel("node", type) });
      startEdit("node", id);
    }
    return;
  }
  if (editing) return; // 讓 input 的 blur 自己處理收尾
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
  mode = { connecting: true };
  setStatus(strings.connectHint);
  svg.classList.add("connecting");
  svg.classList.remove("placing");
});

document.addEventListener("keydown", (evt) => {
  if (evt.key !== "Escape") return;
  if (connectDrag) {
    connectDrag = null;
    render();
  }
  if (mode) {
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
  editing = null;
  render();
});

document.getElementById("dfd-clear-btn").addEventListener("click", async () => {
  if (nodes.size === 0 && boundaries.size === 0 && flows.size === 0) return;
  const ok = await openConfirm(strings.confirmClear);
  if (!ok) return;
  nodes.clear();
  boundaries.clear();
  flows.clear();
  selected = null;
  editing = null;
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
