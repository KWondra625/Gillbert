const hostname = window.location.hostname;
// Use test webhooks when on preview/dev URLs, production webhooks on main site
const ENV = (hostname === "gillbert.builtbykw.net") ? "prod" : "dev";
const N8N_BASE_URL = "https://api.builtbykw.net";
const WEBHOOK_PATH = ENV === "prod" ? "/webhook/" : "/webhook-test/";
const API_KEY = 'sj30z42c9e0nIzchc5u';

const CATCHES_GET_URL = N8N_BASE_URL + WEBHOOK_PATH + "catches";
const ITEMS_PER_PAGE = 25;

const el = {
  catchesContainer: document.getElementById('catchesContainer'),
  status: document.getElementById('status'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  pageInfo: document.getElementById('pageInfo'),
  paginationContainer: document.getElementById('paginationContainer'),
};

let allCatches = [];
let currentPage = 1;

function setStatus(msg) {
  el.status.textContent = msg;
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

async function loadCatches() {
  try {
    showLoading();
    setStatus("Loading catches...");

    const res = await fetch(CATCHES_GET_URL, {
      headers: { "X-API-Key": API_KEY },
    });

    if (!res.ok) throw new Error(`GET failed: ${res.status}`);

    const data = await res.json();

    // Accept either [{...}] OR { catches: [...] }
    allCatches = Array.isArray(data) ? data : (data.catches || []);

    if (!allCatches.length) {
      el.catchesContainer.innerHTML = `<div class="empty-state"><p>No catches found.</p></div>`;
      el.paginationContainer.style.display = 'none';
      setStatus("No catches available.");
      hideLoading();
      return;
    }

    setStatus("");
    currentPage = 1;
    renderPage();
    hideLoading();
  } catch (err) {
    console.error(err);
    setStatus("Failed to load catches ❌");
    el.catchesContainer.innerHTML = `<div class="empty-state"><p>Error loading catches.</p></div>`;
    el.paginationContainer.style.display = 'none';
    hideLoading();
  }
}

function renderPage() {
  const totalPages = Math.ceil(allCatches.length / ITEMS_PER_PAGE);

  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageCatches = allCatches.slice(startIndex, endIndex);

  // Render cards
  el.catchesContainer.innerHTML = pageCatches
    .map(c => renderCatchCard(c))
    .join("");

  // Update pagination
  el.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  el.prevBtn.disabled = currentPage === 1;
  el.nextBtn.disabled = currentPage === totalPages;

  // Show pagination only if there's more than one page
  el.paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';

  // Scroll to top for better UX
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCatchCard(catchData) {
  const {
    catchId = "Unknown",
    anglerName = "Unknown",
    fishSpeciesName = "Unknown",
    length = "N/A",
    fullSummary = "No summary available",
  } = catchData;

  return `
    <div class="catch-card">
      <div class="catch-card-header">
        <h2 class="catch-id">${escapeHtml(catchId)}</h2>
      </div>
      <div class="catch-card-body">
        <div class="catch-field">
          <span class="field-label">🎣 Species:</span>
          <span class="field-value">${escapeHtml(fishSpeciesName)}</span>
        </div>
        <div class="catch-field">
          <span class="field-label">👤 Caught By:</span>
          <span class="field-value">${escapeHtml(anglerName)}</span>
        </div>
        <div class="catch-field">
          <span class="field-label">📏 Length:</span>
          <span class="field-value">${escapeHtml(length)}</span>
        </div>
        <div class="catch-summary">
          <p>${escapeHtml(fullSummary)}</p>
        </div>
      </div>
      <div class="catch-card-footer">
        <a href="./media-upload.html?catchId=${encodeURIComponent(catchId)}" class="card-button">
          ⬆️ Upload Media
        </a>
      </div>
    </div>
  `;
}

el.prevBtn.addEventListener("click", () => {
  currentPage--;
  renderPage();
});

el.nextBtn.addEventListener("click", () => {
  currentPage++;
  renderPage();
});

window.addEventListener("DOMContentLoaded", () => {
  loadCatches();
});
