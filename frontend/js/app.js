/* ==========================================================================
   RONINLIFE PUBLIC CLIENT SCRIPT (Zero Admin Code or Passwords)
   Interacts purely with public REST APIs.
   ========================================================================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } }
};

let vaultLibrary = [];
let db = {};
let heroItems = [];
let heroI = 0;
let heroTimer;
let showcaseItems = [];
let showcaseIndex = 0;
let showcaseTimer = null;
let showcasePaused = false;
let filter = { t: "all", g: "all", authorOnly: false };
let view = "home";
let list = store.get("ronin_favs", {});
let st;

const CHIPS = [
  ["all", "All"],
  ["author", "Curator's Selection"],
  ["book", "Books"],
  ["story", "Short Stories"],
  ["movie", "Cinema"],
  ["tv", "Series"],
  ["Sci-Fi", "Sci-Fi"],
  ["Cyberpunk", "Cyberpunk"],
  ["Philosophy", "Philosophy"],
  ["Drama", "Drama"],
  ["Thriller", "Thriller"],
  ["Cosmic", "Cosmic"]
];

function populateDb(items) {
  db = {};
  items.forEach(it => {
    db[it.type + ":" + it.id] = it;
  });
  if (items && items.length) {
    store.set('ronin_vault_cache', items);
  }
}

/* Fetch Library from Backend with Static/Offline Fallbacks */
async function fetchLibrary() {
  // 1. Try live backend REST API
  try {
    const res = await fetch('/api/library');
    if (res.ok) {
      vaultLibrary = await res.json();
      populateDb(vaultLibrary);
      return vaultLibrary;
    }
  } catch {}

  // 2. Try static JSON asset (for GitHub Pages & static hosting)
  try {
    const staticRes = await fetch('data/library.json');
    if (staticRes.ok) {
      vaultLibrary = await staticRes.json();
      populateDb(vaultLibrary);
      return vaultLibrary;
    }
  } catch {}

  // 3. Try cached vault from localStorage
  const cached = store.get('ronin_vault_cache', null);
  if (Array.isArray(cached) && cached.length) {
    vaultLibrary = cached;
    populateDb(vaultLibrary);
    return vaultLibrary;
  }

  return [];
}

/* Card Renderer */
function card(it) {
  const k = it.type + ":" + it.id;
  let pic = "";
  if (it.poster) {
    pic = `<img loading="lazy" src="${esc(it.poster)}" alt="${esc(it.title)}">`;
  } else {
    pic = `<div class="ph">
      <span class="ph-type">${esc(it.type).toUpperCase()}</span>
      <div class="ph-title">${esc(it.title)}</div>
      <span class="ph-sub">${esc(it.creator || "")}</span>
    </div>`;
  }

  const isPick = it.isAuthorPick;
  const pickHtml = isPick ? `<span class="pick-pill">FEATURED</span>` : "";
  const rateHtml = `<span class="rate">${it.rating ? Number(it.rating).toFixed(1) : "–"}</span>`;
  const heartHtml = list[k] ? `<span class="heart">SAVED</span>` : "";
  const typeHtml = `<span class="type-pill ${it.type}">${it.type}</span>`;
  const genresStr = Array.isArray(it.g) ? it.g.join(",") : "";

  return `<article class="card ${isPick ? "has-pick" : ""}" data-k="${k}" data-t="${it.type}" data-g="${genresStr}" data-pick="${isPick ? "1" : "0"}">
    ${pic}
    ${pickHtml}
    ${rateHtml}
    ${heartHtml}
    ${typeHtml}
    <div class="info">
      <h3>${esc(it.title)}</h3>
      <p>${esc(it.creator ? it.creator + " · " : "")}${esc(it.date)}${it.ov ? " — " + esc(it.ov) : ""}</p>
    </div>
  </article>`;
}

function filters() {
  const knownTypes = new Set(CHIPS.map(([v]) => v));
  const dynamicTypes = [...new Set(vaultLibrary.map(it => String(it.type || "").toLowerCase()).filter(Boolean))]
    .filter(type => !knownTypes.has(type));
  const allChips = CHIPS.map(([v, l]) => [v, l]);
  dynamicTypes.forEach(type => allChips.push([type, categoryLabel(type)]));
  return `<div class="chips">${allChips.map(([v, l]) => `<button class="chip ${(v === filter.t || v === filter.g || (v === "author" && filter.authorOnly)) ? "on" : ""}" data-v="${v}">${l}</button>`).join("")}</div>`;
}

function authorBanner() {
  return `<div class="author-intro">
    <div class="author-info">
      <h2>Curator's Archive <span class="badge-author">CURATOR SELECTION</span></h2>
      <p>A curated personal archive of literature, original prose, and cinema. Curated by Ronin.</p>
    </div>
    <div class="author-cta">
      <button class="btn gold" onclick="setChipFilter('author')">Curator's Selection</button>
      <button class="btn suggest" onclick="openSuggestModal()">Suggest a Title</button>
    </div>
  </div>`;
}

/* Main Loading Routine */
async function load() {
  view = "home";
  $("#q").value = "";

  await fetchLibrary();

  const all = vaultLibrary;
  const authorPicks = all.filter(x => x.isAuthorPick);
  const booksAndStories = all.filter(x => x.type === "book" || x.type === "story");
  const filmsAndTv = all.filter(x => x.type === "movie" || x.type === "tv");

  heroItems = authorPicks.length ? authorPicks.slice(0, 5) : all.slice(0, 5);
  heroI = 0;

  let html = `<div class="hero top10-showcase"></div>`;
  html += authorBanner();
  html += filters();

  html += `<div id="rows">
    <section class="row">
      <h2>Curator's Selection <span><button data-s="-1">‹</button><button data-s="1">›</button></span></h2>
      <div class="track">${authorPicks.map(i => card(i)).join("")}</div>
    </section>

    <section class="row">
      <h2>Literature & Original Writing <span><button data-s="-1">‹</button><button data-s="1">›</button></span></h2>
      <div class="track">${booksAndStories.map(i => card(i)).join("")}</div>
    </section>

    <section class="row">
      <h2>Cinema & Television <span><button data-s="-1">‹</button><button data-s="1">›</button></span></h2>
      <div class="track">${filmsAndTv.map(i => card(i)).join("")}</div>
    </section>
  </div>`;

  $("#main").innerHTML = html;
  clearInterval(heroTimer);
  drawTopTen(true);

  $("#upd").textContent = `VAULT READY (${all.length} TITLES)`;
}

function drawHero() {
  const h = document.querySelector(".hero");
  if (!h || !heroItems.length) return;
  const it = heroItems[heroI];
  const k = it.type + ":" + it.id;
  const bgImg = it.back || it.poster || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1400&q=80";
  const typeLabel = it.type === "book" ? "Book" : it.type === "story" ? "Original Story" : it.type === "tv" ? "TV Series" : "Film";

  h.innerHTML = `<div class="bg" style="background-image:url(${esc(bgImg)})"></div>
  <div class="txt">
    <span class="tag">${it.isAuthorPick ? "FEATURED · " : ""}${typeLabel.toUpperCase()} · ${Number(it.rating || 9.5).toFixed(1)}</span>
    <h1>${esc(it.title)}</h1>
    <p>${esc(it.ov)}</p>
    <div class="acts">
      <button class="btn" data-open="${k}">${it.fullText ? "Read Story" : it.url ? "Experience" : "View Details"}</button>
      <button class="btn ghost" data-fav="${k}">${list[k] ? "Saved" : "Save to List"}</button>
    </div>
  </div>
  <div class="dots">${heroItems.map((_, i) => `<b class="${i === heroI ? "on" : ""}" data-h="${i}"></b>`).join("")}</div>`;

  $("#amb").style.backgroundImage = `url(${esc(bgImg)})`;
}

function applyFilter() {
  document.querySelectorAll(".card").forEach(c => {
    const itemType = c.dataset.t;
    const genres = c.dataset.g ? c.dataset.g.toLowerCase() : "";
    const isPick = c.dataset.pick === "1";

    let okT = filter.t === "all" || itemType === filter.t;
    let okG = filter.g === "all" || genres.includes(filter.g.toLowerCase());
    let okAuthor = !filter.authorOnly || isPick;

    c.classList.toggle("hidden", !(okT && okG && okAuthor));
  });

  document.querySelectorAll("section.row").forEach(s => {
    s.classList.toggle("hidden", !s.querySelector(".card:not(.hidden)"));
  });

  document.querySelectorAll(".chip").forEach(c => {
    const v = c.dataset.v;
    const isAuthor = v === "author" && filter.authorOnly;
    const isType = v === filter.t;
    const isGenre = v === filter.g;
    c.classList.toggle("on", isAuthor || (filter.t !== "all" && isType) || (filter.g !== "all" && isGenre) || (v === "all" && filter.t === "all" && filter.g === "all" && !filter.authorOnly));
  });

  showcaseIndex = 0;
  drawTopTen(true);
}

function setChipFilter(v) {
  if (v === "all") {
    filter = { t: "all", g: "all", authorOnly: false };
  } else if (v === "author") {
    filter = { t: "all", g: "all", authorOnly: true };
  } else if (["book", "story", "movie", "tv"].includes(v)) {
    filter = { t: v, g: "all", authorOnly: false };
  } else if (vaultLibrary.some(it => String(it.type || "").toLowerCase() === v)) {
    filter = { t: v, g: "all", authorOnly: false };
  } else {
    filter = { t: "all", g: v, authorOnly: false };
  }
  applyFilter();
}

function home() {
  clearTimeout(st);
  filter = { t: "all", g: "all", authorOnly: false };
  load();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showGrid(items, title, empty) {
  clearInterval(heroTimer);
  view = "grid";
  $("#main").innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:30px clamp(16px,4vw,48px) 0">
      <h2 style="font:700 1.6rem var(--display);margin:0">${title}</h2>
      <button class="btn ghost" onclick="home()">← Back to Vault</button>
    </div>` +
    (items.length ? `<div class="grid">${items.map(i => card(i)).join("")}</div>` : `<p class="msg">${empty}</p>`);
}

/* Live Search */
$("#q").addEventListener("input", e => {
  clearTimeout(st);
  const v = e.target.value.trim().toLowerCase();
  if (!v) return home();

  st = setTimeout(() => {
    const matches = vaultLibrary.filter(it => {
      const t = (it.title || "").toLowerCase();
      const c = (it.creator || "").toLowerCase();
      const o = (it.ov || "").toLowerCase();
      const g = Array.isArray(it.g) ? it.g.join(" ").toLowerCase() : "";
      return t.includes(v) || c.includes(v) || o.includes(v) || g.includes(v);
    });
    showGrid(matches, `Search results for “${esc(v)}”`, "No titles found matching your search. Try another keyword.");
  }, 250);
});

$("#listBtn").onclick = () => {
  const items = Object.values(list);
  showGrid(items, "Saved Collection", "Your saved collection is currently empty. Click 'Save to List' on any title to save it here.");
};

/* Details Modal */
async function openModal(k) {
  const it = db[k];
  if (!it) return;

  $("#modal").classList.add("open");
  document.body.style.overflow = "hidden";

  const bgImg = it.back || it.poster || "";
  const isPick = it.isAuthorPick;

  let videoEmbed = "";
  if (it.url) {
    const yt = getYouTubeId(it.url);
    if (yt) {
      videoEmbed = `<button class="btn" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5" onclick="embedYouTube('${yt}')">Play Trailer</button>`;
    }
  }

  let readStoryBlock = "";
  if (it.fullText) {
    readStoryBlock = `<div class="story-reader">
      <h3>Full Text</h3>
      <div class="story-text">${esc(it.fullText).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</div>
    </div>`;
  }

  let extButton = "";
  if (it.url) {
    const label = it.type === "book" ? "Open Reference ↗" :
      it.type === "story" ? "Read Source ↗" : "Watch Trailer ↗";
    extButton = `<a href="${esc(it.url)}" target="_blank" rel="noopener" class="btn primary">${label}</a>`;
  }

  const genresDisplay = Array.isArray(it.g) ? it.g.join(" · ") : "";

  $("#sheet").innerHTML = `
    <div class="top" id="topMedia" style="background-image:url(${esc(bgImg)})">
      <button class="btn ghost x" onclick="closeModal()">✕</button>
      ${videoEmbed}
    </div>
    <div class="body">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span class="type-pill ${it.type}" style="position:static">${it.type}</span>
        ${isPick ? `<span class="badge-author" style="font-size:.68rem;padding:3px 10px;border-radius:99px;background:rgba(235,180,56,0.15);color:var(--gold);border:1px solid rgba(235,180,56,0.3);font-weight:600;letter-spacing:.06em">FEATURED</span>` : ""}
      </div>
      <h2>${esc(it.title)}</h2>
      ${it.creator ? `<p class="creator">${esc(it.creator)}</p>` : ""}
      <p class="meta">${[it.date, Number(it.rating || 0).toFixed(1) + " Rating", genresDisplay].filter(Boolean).join("  ·  ")}</p>
      <p class="ov">${esc(it.ov || "No description available.")}</p>
      
      ${readStoryBlock}

      <div class="sheet-actions">
        ${extButton}
        <button class="btn" data-fav="${k}" onclick="toggleFav('${k}',this)">${list[k] ? "Saved in List" : "Save to List"}</button>
      </div>
    </div>`;
}

function embedYouTube(id) {
  $("#topMedia").innerHTML = `<iframe allow="autoplay; encrypted-media; fullscreen" allowfullscreen src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0"></iframe><button class="btn ghost x" onclick="closeModal()">✕</button>`;
}

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return m ? m[1] : null;
}

function closeModal() {
  $("#modal").classList.remove("open");
  $("#sheet").innerHTML = "";
  document.body.style.overflow = "";
}

$("#modal").addEventListener("click", e => {
  if (e.target.id === "modal") closeModal();
});

function toggleFav(k, btn) {
  if (list[k]) {
    delete list[k];
  } else {
    list[k] = db[k];
  }
  store.set("ronin_favs", list);

  if (btn) btn.textContent = list[k] ? "Saved in List" : "Save to List";

  document.querySelectorAll(`.card[data-k="${k}"]`).forEach(c => {
    c.querySelector(".heart")?.remove();
    if (list[k]) c.insertAdjacentHTML("beforeend", '<span class="heart">SAVED</span>');
  });

  showToast(list[k] ? "Saved to your list" : "Removed from your list");
}

/* 3D Tilt */
const main = $("#main");
main.addEventListener("mousemove", e => {
  const c = e.target.closest(".card");
  if (!c) return;
  const r = c.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width;
  const py = (e.clientY - r.top) / r.height;
  c.style.setProperty("--rx", ((py - .5) * -16).toFixed(1) + "deg");
  c.style.setProperty("--ry", ((px - .5) * 16).toFixed(1) + "deg");
  c.style.setProperty("--gx", px * 100 + "%");
  c.style.setProperty("--gy", py * 100 + "%");
});

main.addEventListener("mouseover", e => {
  const c = e.target.closest(".card");
  if (c && db[c.dataset.k]?.back) {
    $("#amb").style.backgroundImage = `url(${db[c.dataset.k].back})`;
    $("#amb").style.opacity = .45;
  }
});

main.addEventListener("mouseout", e => {
  const c = e.target.closest(".card");
  if (c) {
    c.style.setProperty("--rx", "0deg");
    c.style.setProperty("--ry", "0deg");
    $("#amb").style.opacity = .25;
  }
});

main.addEventListener("click", e => {
  const t = e.target;
  const card = t.closest(".card");
  const s = t.closest("[data-s]");
  const ch = t.closest(".chip");
  const o = t.closest("[data-open]");
  const f = t.closest("[data-fav]");
  const h = t.closest("[data-h]");
  const showcaseCard = t.closest("[data-showcase-index]");

  if (showcaseCard) {
    selectTopTen(Number(showcaseCard.dataset.showcaseIndex));
  } else if (s) {
    const tr = s.closest("section").querySelector(".track");
    tr.scrollBy({ left: +s.dataset.s * tr.clientWidth * .8, behavior: "smooth" });
  } else if (ch) {
    setChipFilter(ch.dataset.v);
  } else if (o) {
    openModal(o.dataset.open);
  } else if (f) {
    toggleFav(f.dataset.fav, f);
  } else if (h) {
    heroI = +h.dataset.h;
    drawHero();
  } else if (card) {
    openModal(card.dataset.k);
  }
});

/* Visitor "Suggest a Title" Modal */
function openSuggestModal() {
  $("#suggestModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSuggestModal() {
  $("#suggestModal").classList.remove("open");
  document.body.style.overflow = "";
}

$("#suggestModal").addEventListener("click", e => {
  if (e.target.id === "suggestModal") closeSuggestModal();
});

async function handleSuggestSubmit(e) {
  e.preventDefault();
  const type = $("#sType").value;
  const title = $("#sTitle").value.trim();
  const creator = $("#sCreator").value.trim();
  const by = $("#sYourName").value.trim() || "Anonymous Reader";
  const link = $("#sLink").value.trim();
  const notes = $("#sNotes").value.trim();

  try {
    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, creator, by, link, notes })
    });

    if (res.ok) {
      closeSuggestModal();
      $("#suggestForm").reset();
      showToast("Thank you. Your recommendation was submitted to the author.");
      return;
    }
  } catch {}

  // Static site / offline fallback
  const offlineList = store.get("ronin_offline_suggestions", []);
  offlineList.push({ type, title, creator, by, link, notes, submittedAt: new Date().toISOString() });
  store.set("ronin_offline_suggestions", offlineList);
  closeSuggestModal();
  $("#suggestForm").reset();
  showToast("Recommendation saved locally.");
}

function copySuggestionText() {
  const type = $("#sType").value;
  const title = $("#sTitle").value.trim();
  const creator = $("#sCreator").value.trim();
  const by = $("#sYourName").value.trim() || "A Reader";
  const notes = $("#sNotes").value.trim();

  if (!title) {
    alert("Please enter a title.");
    return;
  }

  const text = `Recommendation:\n${type}: ${title} (${creator || "Unknown"})\nSuggested by: ${by}\nNotes: ${notes}`;

  navigator.clipboard.writeText(text).then(() => {
    showToast("Recommendation details copied to clipboard.");
  }).catch(() => {
    alert("Failed to copy.");
  });
}

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

// Shortcuts
addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement !== $("#q")) {
    e.preventDefault();
    $("#q").focus();
  }
  if (e.key === "Escape") {
    closeModal();
    closeSuggestModal();
  }
});

addEventListener("mousemove", e => {
  document.body.style.setProperty("--cx", e.clientX + "px");
  document.body.style.setProperty("--cy", e.clientY + "px");
});

// Launch
load();

function rankedTopTen(items) {
  return [...items].sort((a, b) => {
    if (Boolean(b.isAuthorPick) !== Boolean(a.isAuthorPick)) return b.isAuthorPick ? 1 : -1;
    const ar = Number(a.rating) || 0;
    const br = Number(b.rating) || 0;
    return br - ar;
  }).slice(0, 10);
}

function getShowcaseItems() {
  return rankedTopTen(vaultLibrary.filter(it => {
    if (filter.authorOnly && !it.isAuthorPick) return false;
    if (filter.t !== "all" && it.type !== filter.t) return false;
    const genres = Array.isArray(it.g) ? it.g.join(" ").toLowerCase() : "";
    if (filter.g !== "all" && !genres.includes(filter.g.toLowerCase())) return false;
    return true;
  }));
}

function firstField(it, names) {
  for (const name of names) {
    if (it[name] !== undefined && it[name] !== null && String(it[name]).trim()) return String(it[name]).trim();
  }
  return "";
}

function categoryLabel(type) {
  const labels = {
    book: "Book", story: "Short Story", movie: "Film", tv: "TV Series"
  };
  if (labels[type]) return labels[type];
  return type ? String(type).replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Content";
}

function showcaseMetadata(it) {
  const type = String(it.type || "").toLowerCase();
  const date = firstField(it, ["date", "year", "releaseYear", "publicationYear"]);
  const status = firstField(it, ["status", "releaseStatus"]);
  const meta = [];

  if (["movie", "film", "cinema"].includes(type)) {
    const year = firstField(it, ["year", "releaseYear", "publishedYear"]) || date.match(/\b(18|19|20|21)\d{2}\b/)?.[0] || "";
    const runtime = firstField(it, ["runtime", "duration"]) || (/(\d+\s*(h|hr|hour|min|minute))/i.test(date) ? date : "");
    if (year) meta.push(year);
    if (runtime) meta.push(runtime);
  } else if (["tv", "series", "television"].includes(type)) {
    const year = firstField(it, ["year", "releaseYear"]) || date.match(/\b(18|19|20|21)\d{2}\b/)?.[0] || "";
    const seasons = firstField(it, ["seasons", "seasonCount", "season"]);
    if (year) meta.push(year);
    if (seasons) meta.push(/season/i.test(seasons) ? seasons : `${seasons} Seasons`);
  } else if (["book", "novel"].includes(type)) {
    const year = firstField(it, ["year", "publicationYear", "publishYear"]) || date.match(/\b(18|19|20|21)\d{2}\b/)?.[0] || "";
    const pages = firstField(it, ["pages", "pageCount"]);
    if (year) meta.push(year);
    if (pages) meta.push(/pages?/i.test(pages) ? pages : `${pages} Pages`);
  } else if (["story", "article", "essay"].includes(type)) {
    const readTime = firstField(it, ["duration", "runtime", "readTime"]) || (/(min|minute|read)/i.test(date) ? date : "");
    if (readTime) meta.push(readTime);
  } else if (["game", "gaming", "video_game"].includes(type)) {
    const year = firstField(it, ["year", "releaseYear"]) || date.match(/\b(18|19|20|21)\d{2}\b/)?.[0] || "";
    const platform = firstField(it, ["platform", "platforms"]);
    if (year) meta.push(year);
    if (platform) meta.push(platform);
  } else {
    const year = firstField(it, ["year", "releaseYear", "publicationYear"]) || date.match(/\b(18|19|20|21)\d{2}\b/)?.[0] || "";
    if (year) meta.push(year);
  }

  if (status) meta.push(status);
  const genres = Array.isArray(it.g) ? it.g : [];
  if (genres.length) meta.push(genres.slice(0, 2).join(" · "));
  return [...new Set(meta)].filter(Boolean);
}

function posterCard(item, index) {
  const rank = index + 1;
  const image = item.poster || item.back || "";
  return `<button class="top10-card" data-showcase-index="${index}" aria-label="Rank ${rank}: ${esc(item.title)}">
    ${image ? `<img src="${esc(image)}" alt="${esc(item.title)}" loading="lazy">` : `<span class="top10-card-fallback">${esc(categoryLabel(item.type))}</span>`}
    <span class="top10-card-shade"></span>
    <span class="top10-rank">${rank}</span>
  </button>`;
}

function startShowcaseTimer(reset = false) {
  if (reset) clearTimeout(showcaseTimer);
  if (showcaseTimer && !reset) return;

  clearTimeout(showcaseTimer);
  showcaseTimer = setTimeout(() => {
    showcaseTimer = null;
    if (!showcasePaused && showcaseItems.length) {
      showcaseIndex = (showcaseIndex + 1) % showcaseItems.length;
      drawTopTen(false);
    }
    startShowcaseTimer(true);
  }, 5000);
}

function selectTopTen(index) {
  if (!showcaseItems.length) return;
  showcaseIndex = ((Number(index) % showcaseItems.length) + showcaseItems.length) % showcaseItems.length;
  drawTopTen(false);
  startShowcaseTimer(true);
}

function drawTopTen(resetTimer = false) {
  const h = document.querySelector(".top10-showcase");
  if (!h) return;

  showcaseItems = getShowcaseItems();
  if (!showcaseItems.length) {
    clearTimeout(showcaseTimer);
    showcaseTimer = null;
    h.innerHTML = `<div class="top10-empty"><span>TOP 10</span><h1>No titles in this selection</h1><p>Try another category or curator filter.</p></div>`;
    return;
  }

  if (showcaseIndex >= showcaseItems.length) showcaseIndex = 0;
  const it = showcaseItems[showcaseIndex];
  const k = it.type + ":" + it.id;
  const bgImg = it.back || it.poster || "";
  const metadata = showcaseMetadata(it);
  const creator = it.creator ? esc(it.creator) : "";
  const category = categoryLabel(it.type);
  const leftItems = showcaseItems.slice(0, showcaseIndex);
  const rightItems = showcaseItems.slice(showcaseIndex + 1);
  const positionClass = showcaseIndex === 0 ? "feature-left" : showcaseIndex === showcaseItems.length - 1 ? "feature-right" : "feature-middle";

  h.innerHTML = `<div class="top10-layout ${positionClass}">
    ${leftItems.length ? `<div class="top10-rail top10-rail-left" aria-label="Ranks before the featured item">${leftItems.map((item, i) => posterCard(item, i)).join("")}</div>` : ""}

    <article class="top10-feature">
      ${bgImg ? `<div class="top10-feature-bg" style="background-image:url(${esc(bgImg)})"></div>` : `<div class="top10-feature-bg top10-feature-placeholder"></div>`}
      <div class="top10-feature-shade"></div>
      <div class="top10-feature-content">
        <span class="top10-status"><i></i> Top 10 · ${esc(category)}</span>
        <div class="top10-meta">${esc(category)}${metadata.length ? ` <b>·</b> ${metadata.map(esc).join(" <b>·</b> ")}` : ""}</div>
        <h1>${esc(it.title)}</h1>
        ${creator ? `<p class="top10-creator">${creator}</p>` : ""}
        <p class="top10-description">${esc(it.ov || "No description available.")}</p>
        <div class="top10-actions">
          <button class="top10-btn top10-primary" data-open="${k}"><span class="play-icon"></span> Explore</button>
          <button class="top10-btn top10-secondary" data-open="${k}"><span class="info-icon">i</span> Details</button>
          <button class="top10-btn top10-save" data-fav="${k}" aria-label="Add to saved list">${list[k] ? "✓" : "+"}</button>
        </div>
      </div>
    </article>

    ${rightItems.length ? `<div class="top10-rail top10-rail-right" aria-label="Ranks after the featured item">${rightItems.map((item, i) => posterCard(item, showcaseIndex + i + 1)).join("")}</div>` : ""}
  </div>`;

  h.onmouseenter = () => { showcasePaused = true; };
  h.onmouseleave = () => { showcasePaused = false; startShowcaseTimer(true); };
  $("#amb").style.backgroundImage = bgImg ? `url(${esc(bgImg)})` : "";

  if (resetTimer) startShowcaseTimer(true);
}
