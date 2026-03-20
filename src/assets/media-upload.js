const SAS_WEBHOOK_URL    = N8N_BASE_URL + WEBHOOK_PATH + "gillbert/upload-media/get-sas";
const COMMIT_WEBHOOK_URL = N8N_BASE_URL + WEBHOOK_PATH + "gillbert/upload-media/commit";

const REDIRECT_DELAY = 20; // seconds

const el = {
  noCatchState:     document.getElementById('noCatchState'),
  uploadState:      document.getElementById('uploadState'),
  successState:     document.getElementById('successState'),
  catchCard:        document.getElementById('catchCard'),
  files:            document.getElementById('files'),
  uploadBtn:        document.getElementById('uploadBtn'),
  status:           document.getElementById('status'),
  log:              document.getElementById('log'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  loadingMsg:       document.getElementById('loadingMsg'),
  backToCatch:      document.getElementById('backToCatch'),
  successBackBtn:   document.getElementById('successBackBtn'),
  countdown:        document.getElementById('countdown'),
};

function getCatchIdFromUrl() {
  return new URLSearchParams(window.location.search).get('catchId');
}

function setStatus(msg) {
  el.status.textContent = msg;
}

function log(msg) {
  el.log.textContent += msg + "\n";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

// --- Catch Context Card -------------------------------------------------------

async function loadCatchDetails(catchId) {
  try {
    const url = `${CATCHES_GET_URL}?catchId=${encodeURIComponent(catchId)}`;
    const res = await fetch(url, { headers: { "X-API-Key": API_KEY } });
    if (!res.ok) throw new Error(`GET failed: ${res.status}`);
    const data = await res.json();
    const catchData = Array.isArray(data) ? data[0] : data;
    renderCatchCard(catchId, catchData);
    document.title = `Upload to ${catchId} · Gillbert`;
  } catch (err) {
    console.error(err);
    el.catchCard.innerHTML = `<div class="catch-card-id">${escapeHtml(catchId)}</div><p class="catch-card-error">Could not load catch details.</p>`;
  }
}

function renderCatchCard(catchId, data) {
  if (!data) {
    el.catchCard.innerHTML = `<div class="catch-card-id">${escapeHtml(catchId)}</div>`;
    return;
  }

  const rows = [
    data.anglerName      && ['Angler',       data.anglerName],
    data.fishSpeciesName && ['Species',       data.fishSpeciesName],
    data.bodyOfWaterName && ['Body of Water', data.bodyOfWaterName],
    data.caughtWhen      && ['Caught When',   formatDate(data.caughtWhen)],
  ].filter(Boolean);

  el.catchCard.innerHTML = `
    <div class="catch-card-id">${escapeHtml(catchId)}</div>
    ${rows.map(([label, value]) => `
      <div class="catch-card-row">
        <span class="catch-card-label">${label}</span>
        <span class="catch-card-value">${escapeHtml(String(value))}</span>
      </div>`).join('')}`;
}

// --- Upload ------------------------------------------------------------------

async function getSasUrls(catchId, files) {
  const res = await fetch(SAS_WEBHOOK_URL, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      catchId,
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
    }),
  });
  if (!res.ok) throw new Error(`SAS request failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function uploadOne(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!res.ok) throw new Error(`Azure PUT failed: ${res.status} ${await res.text()}`);
}

async function postUploadMetadata(catchId, uploads) {
  const res = await fetch(COMMIT_WEBHOOK_URL, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ catchId, uploads }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Commit webhook failed: ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
}

// --- Success & Redirect -------------------------------------------------------

function startSuccessCountdown(catchId) {
  const detailsUrl = `./catch-details.html?catchId=${encodeURIComponent(catchId)}`;
  el.successBackBtn.href = detailsUrl;

  let remaining = REDIRECT_DELAY;
  el.countdown.textContent = remaining;

  const timer = setInterval(() => {
    remaining--;
    el.countdown.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(timer);
      window.location.href = detailsUrl;
    }
  }, 1000);
}

// --- Upload Button ------------------------------------------------------------

el.uploadBtn.addEventListener('click', async () => {
  el.log.textContent = "";
  const catchId = getCatchIdFromUrl();
  const files = Array.from(el.files.files || []);

  if (!files.length) return setStatus("Pick at least one photo or video.");

  try {
    el.uploadBtn.disabled = true;
    el.loadingIndicator.classList.add('visible');
    setStatus("Requesting upload slots...");
    log(`Catch: ${catchId}`);
    log(`Files: ${files.length}`);

    const { uploads } = await getSasUrls(catchId, files);

    setStatus("Reeling files into the cloud...");
    for (let i = 0; i < uploads.length; i++) {
      const name = uploads[i].originalName || files[i].name;
      log(`Uploading ${i + 1}/${uploads.length}: ${name}...`);
      await uploadOne(uploads[i].uploadUrl, files[i]);
      log(`✅ ${name} is in the boat!`);
    }

    log(`\nDropping your catch in Gillbert's digital live well...`);
    setStatus("Stocking the live well...");
    await postUploadMetadata(catchId, uploads);
    log(`✅ Locked in — your catch is fully documented!`);

    el.loadingIndicator.classList.remove('visible');
    setStatus("");

    el.uploadState.classList.add('hidden');
    el.successState.classList.remove('hidden');
    startSuccessCountdown(catchId);

  } catch (err) {
    console.error(err);
    setStatus("Upload failed ❌");
    log(String(err));
    el.uploadBtn.disabled = false;
    el.loadingIndicator.classList.remove('visible');
  }
});

// --- Init --------------------------------------------------------------------

window.addEventListener("DOMContentLoaded", () => {
  const catchId = getCatchIdFromUrl();

  if (!catchId) {
    el.uploadState.classList.add('hidden');
    el.noCatchState.classList.remove('hidden');
    return;
  }

  const detailsUrl = `./catch-details.html?catchId=${encodeURIComponent(catchId)}`;
  el.backToCatch.href = detailsUrl;

  loadCatchDetails(catchId);
  setStatus("Ready to upload.");
});
