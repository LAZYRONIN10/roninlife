/* ==========================================================================
   RONINLIFE DEDICATED ADMIN DASHBOARD SCRIPT
   Communicates with protected endpoints via Bearer token.
   ========================================================================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } }
};

let authToken = store.get("author_admin_token", null);
let currentLibrary = [];
let currentSuggestions = [];
let uploadedImageData = "";

async function initAdmin() {
  if (!authToken) {
    showLoginView();
    return;
  }

  try {
    const res = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.isAdmin) {
      showDashboardView();
      loadDashboardData();
    } else {
      authToken = null;
      store.set("author_admin_token", null);
      showLoginView();
    }
  } catch {
    showLoginView();
  }
}

function showLoginView() {
  $("#loginSection").style.display = "flex";
  $("#dashboardSection").style.display = "none";
  $("#logoutBtn").style.display = "none";
}

function showDashboardView() {
  $("#loginSection").style.display = "none";
  $("#dashboardSection").style.display = "block";
  $("#logoutBtn").style.display = "inline-flex";
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();
  const password = $("#adminPasswordInput").value.trim();
  const btn = $("#loginBtn");
  btn.disabled = true;
  btn.textContent = "Verifying...";

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      authToken = data.token;
      store.set("author_admin_token", authToken);
      showDashboardView();
      loadDashboardData();
      showToast("Authenticated as Author");
    } else {
      alert(data.error || "Incorrect password.");
    }
  } catch {
    alert("Cannot connect to server. Ensure server is running.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Enter Dashboard";
  }
}

async function handleLogout() {
  if (authToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    } catch {}
  }
  authToken = null;
  store.set("author_admin_token", null);
  showLoginView();
  showToast("Logged out of Admin Portal");
}

// Switch Tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.panel-section').forEach(p => p.classList.toggle('active', p.id === tabId));
}

// Load Data
async function loadDashboardData() {
  await Promise.all([loadLibrary(), loadSuggestions()]);
  updateStats();
}

async function loadLibrary() {
  try {
    const res = await fetch('/api/library');
    if (res.ok) {
      currentLibrary = await res.json();
      renderItemsTable();
      return;
    }
  } catch (err) {
    console.warn("Could not reach /api/library, checking static data file", err);
  }

  try {
    const staticRes = await fetch('data/library.json');
    if (staticRes.ok) {
      currentLibrary = await staticRes.json();
      renderItemsTable();
    }
  } catch (err) {
    console.error("Failed to load library", err);
  }
}

async function loadSuggestions() {
  try {
    const res = await fetch('/api/suggestions', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      currentSuggestions = await res.json();
      renderSuggestions();
    }
  } catch (err) {
    console.error("Failed to load suggestions", err);
  }
}

function updateStats() {
  $("#statTotal").textContent = currentLibrary.length;
  $("#statBooks").textContent = currentLibrary.filter(x => x.type === 'book').length;
  $("#statStories").textContent = currentLibrary.filter(x => x.type === 'story').length;
  $("#statCinema").textContent = currentLibrary.filter(x => x.type === 'movie' || x.type === 'tv').length;
  $("#statSuggestions").textContent = currentSuggestions.length;
  $("#badgeInbox").textContent = currentSuggestions.length;
}

function renderItemsTable() {
  const tbody = $("#itemsTableBody");
  if (!currentLibrary.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--mute)">No items in vault yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentLibrary.map(item => {
    const thumb = item.poster ? `<img class="item-thumb" src="${esc(item.poster)}" alt="">` : `<span class="item-thumb-ph">${esc((item.type || 'IT').slice(0, 2).toUpperCase())}</span>`;
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center">
            ${thumb}
            <div>
              <strong>${esc(item.title)}</strong><br>
              <span style="font-size:.75rem;color:var(--mute)">${esc(item.creator)}</span>
            </div>
          </div>
        </td>
        <td><span style="text-transform:uppercase;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,0.06)">${esc(item.type)}</span></td>
        <td>${esc(item.date)}</td>
        <td>${Number(item.rating || 0).toFixed(1)}</td>
        <td>${item.isAuthorPick ? '<span style="color:var(--gold);font-weight:600">Curator Pick</span>' : '<span style="color:var(--mute)">Standard</span>'}</td>
        <td>
          <button class="btn ghost" style="padding:4px 12px;font-size:.75rem;color:#fca5a5;border-color:rgba(255,90,54,0.3)" onclick="deleteItem('${item.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderSuggestions() {
  const container = $("#suggestionsContainer");
  if (!currentSuggestions.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--mute)">No recommendations in inbox.</div>`;
    return;
  }

  container.innerHTML = currentSuggestions.map(s => `
    <div class="sug-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <h3>${esc(s.type)}: ${esc(s.title)}</h3>
        <span style="font-size:.75rem;color:var(--mute)">${new Date(s.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="meta">Creator: <strong>${esc(s.creator)}</strong> · Recommended by: <strong>${esc(s.by)}</strong></div>
      <p>${esc(s.notes)}</p>
      ${s.link ? `<p><a href="${esc(s.link)}" target="_blank" rel="noopener" style="color:var(--cyan);font-size:.85rem">View Reference Link ↗</a></p>` : ''}
      <div style="display:flex;gap:10px">
        <button class="btn primary" style="padding:6px 14px;font-size:.78rem" onclick="adoptSuggestionById('${s.id}')">Publish to Vault</button>
        <button class="btn ghost" style="padding:6px 14px;font-size:.78rem;color:#fca5a5" onclick="dismissSuggestion('${s.id}')">Dismiss</button>
      </div>
    </div>
  `).join("");
}

// Publish Item
async function handlePublishSubmit(e) {
  e.preventDefault();

  const type = $("#uType").value;
  const title = $("#uTitle").value.trim();
  const creator = $("#uCreator").value.trim();
  const date = $("#uDate").value.trim() || new Date().getFullYear().toString();
  const rating = parseFloat($("#uRating").value) || 9.5;
  const genresRaw = $("#uGenres").value.trim();
  const ov = $("#uOv").value.trim();
  const url = $("#uUrl").value.trim();
  const fullText = $("#uText").value.trim();
  const isAuthorPick = $("#uAuthorPick").checked;

  const genres = genresRaw ? genresRaw.split(",").map(s => s.trim()).filter(Boolean) : ["Featured"];
  const poster = uploadedImageData || $("#uPosterUrl").value.trim() || "";

  const btn = $("#publishSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Publishing...";

  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        type, title, creator, date, rating, isAuthorPick,
        poster, back: poster, g: genres, ov, url, fullText
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      $("#publishForm").reset();
      uploadedImageData = "";
      $("#imgPreview").style.display = "none";
      await loadLibrary();
      updateStats();
      switchTab('tabItems');
      showToast(`Published "${title}" to Vault.`);
    } else {
      alert(data.error || "Failed to publish item.");
    }
  } catch {
    alert("Network error connecting to backend.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Publish to Vault";
  }
}

// Delete Item
async function deleteItem(id) {
  if (!confirm("Are you sure you want to permanently delete this item from the vault?")) return;

  try {
    const res = await fetch(`/api/items/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      await loadLibrary();
      updateStats();
      showToast("Item deleted from Vault.");
    } else {
      alert("Failed to delete. Session may have expired.");
    }
  } catch {
    alert("Network error.");
  }
}

// Dismiss Suggestion
async function dismissSuggestion(id) {
  try {
    const res = await fetch(`/api/suggestions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      await loadSuggestions();
      updateStats();
      showToast("Suggestion dismissed.");
    }
  } catch {}
}

function adoptSuggestionById(id) {
  const s = currentSuggestions.find(x => x.id === id);
  if (!s) return;
  adoptSuggestion(s.type, s.title, s.creator, s.link, s.notes);
}

function adoptSuggestion(type, title, creator, link, notes) {
  switchTab('tabPublish');
  const tMap = { "Book": "book", "Short Story": "story", "Film": "movie", "Series": "tv" };
  $("#uType").value = tMap[type] || "book";
  $("#uTitle").value = title;
  $("#uCreator").value = creator;
  $("#uUrl").value = link;
  $("#uOv").value = notes;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// File Preview
function previewFile(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Please choose an image under 5MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = ev => {
    uploadedImageData = ev.target.result;
    $("#imgPreview").src = uploadedImageData;
    $("#imgPreview").style.display = "block";
    $("#uploadPrompt").textContent = `Selected: ${file.name}`;
  };
  reader.readAsDataURL(file);
}

function previewUrl(url) {
  if (!url) return;
  uploadedImageData = url;
  $("#imgPreview").src = url;
  $("#imgPreview").style.display = "block";
  $("#uploadPrompt").textContent = "Image loaded from URL";
}

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

// Init
initAdmin();
