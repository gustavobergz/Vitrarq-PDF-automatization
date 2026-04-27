const STORAGE_KEY = "pdf-budget-automation-v5";

function todayInputDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

const defaultData = {
  clientName: "",
  clientAddress: "",
  clientPhone: "",
  quoteDate: todayInputDate(),
  paymentTerms: "a combinar",
  deliveryTerm: "a combinar",
  validity: "10 dias",
  notes: "",
  products: [],
  details: [],
};

let state = loadState();

const formFields = [
  "clientName",
  "clientAddress",
  "clientPhone",
  "quoteDate",
  "paymentTerms",
  "deliveryTerm",
  "validity",
  "notes",
];

const el = {
  form: document.querySelector("#quoteForm"),
  productsEditor: document.querySelector("#productsEditor"),
  detailsEditor: document.querySelector("#detailsEditor"),
  addProduct: document.querySelector("#addProduct"),
  addDetail: document.querySelector("#addDetail"),
  printQuote: document.querySelector("#printQuote"),
  resetForm: document.querySelector("#resetForm"),
  previewClient: document.querySelector("#previewClient"),
  previewAddress: document.querySelector("#previewAddress"),
  previewClientPhone: document.querySelector("#previewClientPhone"),
  previewProducts: document.querySelector("#previewProducts"),
  previewDetails: document.querySelector("#previewDetails"),
  productsBox: document.querySelector("#productsBox"),
  notesSection: document.querySelector("#notesSection"),
  totalLine: document.querySelector("#totalLine"),
  previewGrandTotal: document.querySelector("#previewGrandTotal"),
  previewPayment: document.querySelector("#previewPayment"),
  previewDelivery: document.querySelector("#previewDelivery"),
  previewValidity: document.querySelector("#previewValidity"),
  previewCity: document.querySelector("#previewCity"),
  previewDate: document.querySelector("#previewDate"),
  previewSeller: document.querySelector("#previewSeller"),
  previewPhone: document.querySelector("#previewPhone"),
  conditionsTitle: document.querySelector("#conditionsTitle"),
  paymentLine: document.querySelector("#paymentLine"),
  deliveryLine: document.querySelector("#deliveryLine"),
  validityLine: document.querySelector("#validityLine"),
  dateLine: document.querySelector("#dateLine"),
};

function setupCasualDevToolsBlock() {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const blocked =
      event.key === "F12" ||
      (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
      (event.ctrlKey && key === "u");

    if (blocked) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const loaded = saved ? { ...defaultData, ...JSON.parse(saved) } : structuredClone(defaultData);
    loaded.quoteDate = todayInputDate();
    return loaded;
  } catch {
    return structuredClone(defaultData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function moneyToNumber(value) {
  if (!value) return 0;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatPdfMoney(value) {
  return formatMoney(value).replace("R$", "").trim();
}

function formatLongDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(target, value, fallback = "") {
  target.textContent = value || fallback;
}

function estimateLines(text, charsPerLine) {
  const clean = String(text || "").trim();
  if (!clean) return 1;
  return clean.split(/\s+/).reduce(
    (lines, word) => lines + Math.max(1, Math.ceil(word.length / charsPerLine)),
    0
  ) > 1
    ? Math.ceil(clean.length / charsPerLine)
    : 1;
}

function moveElement(target, top) {
  target.style.top = `${top}pt`;
}

function hydrateForm() {
  formFields.forEach((name) => {
    const field = document.querySelector(`#${name}`);
    field.value = state[name] ?? "";
  });
}

function createInput(value, label, onInput, type = "text") {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;

  const input = document.createElement("input");
  input.type = type;
  input.value = value ?? "";
  input.addEventListener("input", (event) => {
    onInput(event.target.value);
    renderPreview();
    saveState();
  });

  wrapper.append(input);
  return wrapper;
}

function renderEditors() {
  el.productsEditor.innerHTML = "";
  state.products.forEach((product, index) => {
    const row = document.createElement("div");
    row.className = "editor-row";
    row.append(
      createInput(product.qty, "QTD", (value) => (state.products[index].qty = value)),
      createInput(product.description, "Descricao", (value) => (state.products[index].description = value)),
      createInput(product.price, "Preco", (value) => (state.products[index].price = value)),
      removeButton(() => {
        state.products.splice(index, 1);
        render();
      })
    );
    el.productsEditor.append(row);
  });

  el.detailsEditor.innerHTML = "";
  state.details.forEach((detail, index) => {
    const row = document.createElement("div");
    row.className = "editor-row details-row";
    row.append(
      createInput(detail.place, "Local", (value) => (state.details[index].place = value)),
      createInput(detail.detail, "Detalhe", (value) => (state.details[index].detail = value)),
      createInput(detail.price, "Valor", (value) => (state.details[index].price = value)),
      removeButton(() => {
        state.details.splice(index, 1);
        render();
      })
    );
    el.detailsEditor.append(row);
  });
}

function removeButton(onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "remove-button";
  button.textContent = "X";
  button.title = "Remover linha";
  button.setAttribute("aria-label", "Remover linha");
  button.addEventListener("click", onClick);
  return button;
}

function renderPreview() {
  setText(el.previewClient, state.clientName);
  setText(el.previewAddress, state.clientAddress, " ");
  setText(el.previewClientPhone, state.clientPhone, " ");
  setText(el.previewPayment, state.paymentTerms);
  setText(el.previewDelivery, state.deliveryTerm);
  setText(el.previewValidity, state.validity);
  setText(el.previewCity, "Londrina");
  setText(el.previewDate, formatLongDate(state.quoteDate));
  setText(el.previewSeller, "Fabio Berg Machado");
  setText(el.previewPhone, "99936-1109");

  const products = state.products.filter((item) => item.qty || item.description || item.price);
  let cursorTop = 255.08;
  el.previewProducts.innerHTML = products
    .map((item) => {
      const top = cursorTop;
      const rowHeight = Math.max(26.65, estimateLines(item.description, 58) * 15.5);
      cursorTop += rowHeight;
      const price = item.price ? `R$ ${formatPdfMoney(moneyToNumber(item.price))}` : "";
      return `
        <div class="pdf-product-row" style="top:${top}pt">
          <span class="qty">${escapeHtml(item.qty)}</span>
          <span class="desc">${escapeHtml(item.description)}</span>
          <span class="price">${escapeHtml(price)}</span>
        </div>
      `;
    })
    .join("");

  const details = state.details.filter((item) => item.place || item.detail || item.price);
  const detailsStart = Math.max(cursorTop, 255.08 + 26.65);
  cursorTop = detailsStart;
  el.previewDetails.innerHTML = details
    .map((item) => {
      const top = cursorTop;
      const value = item.price ? `= ${formatPdfMoney(moneyToNumber(item.price))}` : "";
      const rowHeight = Math.max(
        26.6,
        Math.max(estimateLines(item.place, 10), estimateLines(item.detail, 42)) * 15.5
      );
      cursorTop += rowHeight;
      return `
        <div class="pdf-detail-row" style="top:${top}pt">
          <span class="place">${escapeHtml(item.place)}</span>
          <span class="detail">${escapeHtml(item.detail)}</span>
          <span class="value">${escapeHtml(value)}</span>
        </div>
      `;
    })
    .join("");

  const notes = state.notes.trim();
  const notesTop = cursorTop + 10;
  el.notesSection.innerHTML = notes
    ? `<div class="pdf-note-row" style="top:${notesTop}pt">OBS: ${escapeHtml(notes)}</div>`
    : "";
  if (notes) cursorTop = notesTop + Math.max(22, estimateLines(notes, 86) * 15.5);

  const productsTotal = products.reduce((sum, item) => sum + moneyToNumber(item.price), 0);
  el.previewGrandTotal.textContent = formatMoney(productsTotal);
  el.totalLine.classList.toggle("is-hidden", productsTotal === 0);

  const totalTop = productsTotal > 0 ? cursorTop + 14 : cursorTop;
  const boxBottom = Math.max(451, totalTop + (productsTotal > 0 ? 23 : 14));
  const conditionsTop = Math.max(469.9, boxBottom + 24);
  el.productsBox.style.height = `${Math.max(207, boxBottom - 244)}pt`;
  moveElement(el.totalLine, totalTop);
  moveElement(el.conditionsTitle, conditionsTop);
  moveElement(el.paymentLine, conditionsTop + 14.75);
  moveElement(el.deliveryLine, conditionsTop + 29.75);
  moveElement(el.validityLine, conditionsTop + 44.52);
  moveElement(el.dateLine, conditionsTop + 59.52);
  moveElement(el.previewSeller, conditionsTop + 88.52);
  moveElement(el.previewPhone, conditionsTop + 102.27);
}

function render() {
  hydrateStateFromStaticFields();
  renderEditors();
  renderPreview();
  saveState();
}

function hydrateStateFromStaticFields() {
  formFields.forEach((name) => {
    const field = document.querySelector(`#${name}`);
    state[name] = field.value;
  });
}

function resetForm() {
  state = structuredClone(defaultData);
  state.quoteDate = todayInputDate();
  hydrateForm();
  render();
}

formFields.forEach((name) => {
  document.querySelector(`#${name}`).addEventListener("input", (event) => {
    state[name] = event.target.value;
    renderPreview();
    saveState();
  });
});

el.addProduct.addEventListener("click", () => {
  state.products.push({ qty: "", description: "", price: "" });
  render();
});

el.addDetail.addEventListener("click", () => {
  state.details.push({ place: "", detail: "", price: "" });
  render();
});

el.printQuote.addEventListener("click", () => {
  document.title = "\u200B";
  window.print();
});
el.resetForm.addEventListener("click", resetForm);

setupCasualDevToolsBlock();
hydrateForm();
render();
