const N8N_BASE_URL = "https://api.builtbykw.net";
const WEBHOOK_PATH = "/webhook/";
const API_KEY = 'sj30z42c9e0nIzchc5u';

const CATCHES_GET_URL = N8N_BASE_URL + WEBHOOK_PATH + "gillbert/get-catches";

// Primary fields shown in this exact order
const FIELD_ORDER = [
  'anglerName',
  'bodyOfWaterName',
  'fishSpeciesName',
  'length',
  'waterDepth',
  'notes',
  'caughtWhen',
];

// Audit fields shown in a separate muted section
const AUDIT_FIELDS = ['recordSource', 'createdAt', 'updatedAt'];

// Fields whose values are date/times and should be formatted for readability
const DATETIME_FIELDS = new Set(['caughtWhen', 'createdAt', 'updatedAt']);

// Known field label/icon mapping — unknown fields are auto-formatted from camelCase
const FIELD_LABELS = {
  anglerName:      { label: "Angler",          icon: "👤" },
  fishSpeciesName: { label: "Fish Species",    icon: "🐟" },
  bodyOfWaterName: { label: "Body of Water",   icon: "💧" },
  length:          { label: "Length",          icon: "📏" },
  waterDepth:      { label: "Water Depth",     icon: "🌊" },
  caughtWhen:      { label: "Caught When",     icon: "📅" },
  weight:          { label: "Weight",          icon: "⚖️" },
  location:        { label: "Location",        icon: "📍" },
  weather:         { label: "Weather",         icon: "🌤️" },
  gear:            { label: "Gear Used",       icon: "🎿" },
  bait:            { label: "Bait / Lure",     icon: "🪱" },
  waterTemp:       { label: "Water Temp",      icon: "🌡️" },
  notes:           { label: "Notes",           icon: "📝" },
  createdAt:       { label: "Created",         icon: "🕓" },
  updatedAt:       { label: "Last Updated",    icon: "🔄" },
  recordSource:    { label: "Record Source",   icon: "🗂️" },
};

// Fields excluded from all loops (handled explicitly)
const EXCLUDE_FIELDS = new Set(['catchId', 'fullSummary', 'headline', ...FIELD_ORDER, ...AUDIT_FIELDS]);

const el = {
  status:           document.getElementById('status'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  detailsContainer: document.getElementById('detailsContainer'),
  catchIdDisplay:   document.getElementById('catchIdDisplay'),
  uploadMediaBtn:   document.getElementById('uploadMediaBtn'),
};

function setStatus(msg, isError = false) {
  el.status.textContent = msg;
  el.status.style.color = isError ? '#ffdddd' : 'white';
}

function showLoading() {
  el.loadingIndicator.classList.add('visible');
}

function hideLoading() {
  el.loadingIndicator.classList.remove('visible');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function formatDateTime(value) {
  if (!value) return escapeHtml(String(value));
  const d = new Date(value);
  if (isNaN(d.getTime())) return escapeHtml(String(value));
  return escapeHtml(
    d.toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  );
}

function formatValue(key, value) {
  if (DATETIME_FIELDS.has(key)) return formatDateTime(value);
  if (key === 'length') return `${escapeHtml(String(value))}"`;
  return escapeHtml(String(value));
}

function buildRow(key, value, extraClass = '') {
  const meta = FIELD_LABELS[key] || { label: camelToLabel(key), icon: "📌" };
  return `
    <div class="detail-row${extraClass ? ' ' + extraClass : ''}">
      <span class="detail-label">${meta.icon} ${escapeHtml(meta.label)}</span>
      <span class="detail-value">${formatValue(key, value)}</span>
    </div>`;
}

function camelToLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function getCatchIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('catchId');
}

async function loadCatchDetails(catchId) {
  try {
    showLoading();
    setStatus("Loading catch details...");

    const url = `${CATCHES_GET_URL}?catchId=${encodeURIComponent(catchId)}`;
    const res = await fetch(url, {
      headers: { "X-API-Key": API_KEY },
    });

    if (!res.ok) throw new Error(`GET failed: ${res.status}`);

    const data = await res.json();

    // Accept: single object, array with one item, or { catch: {...} } / { catches: [...] } envelope
    let catchData;
    if (Array.isArray(data)) {
      catchData = data[0];
    } else if (data && data.catch) {
      catchData = data.catch;
    } else if (data && data.catches) {
      catchData = data.catches[0];
    } else {
      catchData = data;
    }

    if (!catchData) {
      setStatus("Catch not found.", true);
      hideLoading();
      return;
    }

    setStatus("");
    renderDetails(catchData);
    hideLoading();
  } catch (err) {
    console.error(err);
    setStatus("Failed to load catch details ❌", true);
    hideLoading();
  }
}

function renderDetails(catchData) {
  const catchId = catchData.catchId || "Unknown";

  el.catchIdDisplay.textContent = catchId;
  el.uploadMediaBtn.href = `./media-upload.html?catchId=${encodeURIComponent(catchId)}`;

  const hasValue = (key) => catchData[key] !== null && catchData[key] !== undefined && catchData[key] !== '';

  // 0. Headline block — top of card
  const headlineHtml = catchData.headline ? `
    <div class="detail-summary">
      <div class="detail-summary-label">🎣 Headline</div>
      <p>${escapeHtml(catchData.headline)}</p>
    </div>` : '';

  // 1. Primary ordered fields
  const primaryRows = FIELD_ORDER
    .filter(hasValue)
    .map(key => buildRow(key, catchData[key]))
    .join('');

  // 2. Any extra fields the API returned that aren't in our known lists
  const extraRows = Object.keys(catchData)
    .filter(key => !EXCLUDE_FIELDS.has(key) && !AUDIT_FIELDS.includes(key) && hasValue(key))
    .map(key => buildRow(key, catchData[key]))
    .join('');

  // 3. Audit section
  const auditRows = AUDIT_FIELDS
    .filter(hasValue)
    .map(key => buildRow(key, catchData[key], 'detail-row--audit'))
    .join('');

  const auditHtml = auditRows ? `
    <div class="detail-audit-section">
      <div class="detail-audit-label">Record Info</div>
      ${auditRows}
    </div>` : '';

  el.detailsContainer.innerHTML = `
    <div class="detail-card">
      <div class="detail-card-header">
        <h2>${escapeHtml(catchId)}</h2>
      </div>
      <div class="detail-card-body">
        ${headlineHtml}
        ${primaryRows}
        ${extraRows}
      </div>
      ${auditHtml}
    </div>`;
}

window.addEventListener("DOMContentLoaded", () => {
  const catchId = getCatchIdFromUrl();

  if (!catchId) {
    setStatus("No catch ID provided.", true);
    el.detailsContainer.innerHTML = `
      <div class="detail-card">
        <div class="detail-card-body">
          <p style="text-align:center;color:#999;">Please return to the listing and select a catch.</p>
        </div>
      </div>`;
    return;
  }

  loadCatchDetails(catchId);
});
