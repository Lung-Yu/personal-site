// 威脅建模速查產生器：規則式對照表，純前端運算。
const strings = JSON.parse(document.getElementById("stride-strings").textContent);
const CATS = ["S", "T", "R", "I", "D", "E"];
const QUESTION_IDS = ["q-auth", "q-internet", "q-pii", "q-thirdparty", "q-payment", "q-ai", "q-multitenant"];

const generateBtn = document.getElementById("stride-generate-btn");
const copyBtn = document.getElementById("stride-copy-btn");
const resultEl = document.getElementById("stride-result");
const groupsEl = document.getElementById("stride-groups");

function buildChecklist() {
  const byCat = Object.fromEntries(CATS.map((c) => [c, [...strings.base[c]]]));
  QUESTION_IDS.forEach((id) => {
    if (!document.getElementById(id).checked) return;
    (strings.conditional[id] || []).forEach(({ cat, text }) => byCat[cat].push(text));
  });
  return byCat;
}

function render(byCat) {
  groupsEl.replaceChildren();
  const lines = [];
  CATS.forEach((cat) => {
    const group = document.createElement("div");
    group.className = "stride-group";
    const h4 = document.createElement("h4");
    h4.textContent = strings.labels[cat];
    const ul = document.createElement("ul");
    byCat[cat].forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      ul.append(li);
    });
    group.append(h4, ul);
    groupsEl.append(group);
    lines.push(`## ${strings.labels[cat]}`, ...byCat[cat].map((t) => `- [ ] ${t}`), "");
  });
  return lines.join("\n");
}

let checklistText = "";

generateBtn.addEventListener("click", () => {
  checklistText = render(buildChecklist());
  resultEl.hidden = false;
  if (navigator.clipboard) copyBtn.hidden = false;
});

if (copyBtn && navigator.clipboard) {
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(checklistText);
    copyBtn.textContent = copyBtn.dataset.copied;
    setTimeout(() => {
      copyBtn.textContent = copyBtn.dataset.label;
    }, 1600);
  });
}
