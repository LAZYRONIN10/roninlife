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
let filter = { t: "all", g: "all", authorOnly: false };
let view = "home";
let list = store.get("ronin_favs", {});

const CHIPS = [
  ["all", "All"],
  ["author", "⭐ Author's Picks"],
  ["book", "📚 Books"],
  ["story", "✒️ Short Stories"],
  ["movie", "🎬 Films"],
  ["tv", "📺 Series"],
  ["Sci-Fi", "Sci-Fi"],
  ["Cyberpunk", "Cyberpunk"],
  ["Philosophy", "Philosophy"],
  ["Drama", "Drama"],
  ["Thriller", "Thriller"],
  ["Cosmic", "Cosmic"]
];

/* Fetch Library from Backend */
async function fetchLibrary() {
  try {
    const res = await fetch('/api/library');
    if (res.ok) {
      vaultLibrary = await res.json();
      db = {};
      vaultLibrary.forEach(it => {
        db[it.type + ":" + it.id] = it;
      });
      return vaultLibrary;
    }
  } catch (err) {
    console.warn("Could not reach backend /api/library", err);
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
    const icon = it.type === "book" ? "📚" : it.type === "story" ? "✒️" : "🎬";
    pic = `<div class="ph"><div style="font-size:2rem;margin-bottom:6px">${icon}</div>${esc(it.title)}<span class="ph-sub">${esc(it.creator || "")}</span></div>`;
  }

  const isPick = it.isAuthorPick;
  const pickHtml = isPick ? `<span class="pick-pill">★ AUTHOR'S PICK</span>` : "";
  const rateHtml = `<span class="rate">★ ${it.rating ? Number(it.rating).toFixed(1) : "–"}</span>`;
  const heartHtml = list[k] ? `<span class="heart">♥</span>` : "";
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
  return `<div class="chips">${CHIPS.map(([v, l]) => `<button class="chip ${(v === filter.t || v === filter.g || (v === "author" && filter.authorOnly)) ? "on" : ""}" data-v="${v}">${l}</button>`).join("")}</div>`;
}

function authorBanner() {
  return `<div class="author-intro">
    <div class="author-info">
      <h2>Ronin's Vault <span class="badge-author">CURATOR & AUTHOR</span></h2>
      <p>Welcome to my personal creative archive. Here you'll find my original short stories, essential literature, and cinematic masterworks. Have a recommendation? Send it via the suggest button!</p>
    </div>
    <div class="author-cta">
      <button class="btn gold" onclick="setChipFilter('author')">⭐ Author's Favorites</button>
      <button class="btn suggest" onclick="openSuggestModal()">💡 Suggest a Title</button>
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

  let html = `<div class="hero"></div>`;
  html += authorBanner();
  html += filters();

  html += `<div id="rows">
    <section class="row">
      <h2>⭐ Author's All-Time Favorites <span><button data-s="-1">‹</button><button data-s="1">›</button></span></h2>
      <div class="track">${authorPicks.map(i => card(i)).join("")}</div>
    </section>

    <section class="row">
      <h2>📚 Books & Original Stories <span><button data-s="-1">‹</button><button data-s="1">›</button></span></h2>
      <div class="track">${booksAndStories.map(i => card(i)).join("")}</div>
    </section>

    <section class="row">
      <h2>🎬 Cinema & Series Collection <span><button data-s="-1">‹</button><button data-s="1">›</button></span></h2>
      <div class="track">${filmsAndTv.map(i => card(i)).join("")}</div>
    </section>
  </div>`;

  $("#main").innerHTML = html;
  drawHero();

  clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    if (heroItems.length) {
      heroI = (heroI + 1) % heroItems.length;
      drawHero();
    }
  }, 8000);

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
    <span class="tag">${it.isAuthorPick ? "⭐ AUTHOR'S PICK · " : ""}${typeLabel} · ★ ${Number(it.rating || 9.5).toFixed(1)}</span>
    <h1>${esc(it.title)}</h1>
    <p>${esc(it.ov)}</p>
    <div class="acts">
      <button class="btn" data-open="${k}">${it.fullText ? "📖 Read Story" : it.url ? "▶ Open & Experience" : "🔍 View Details"}</button>
      <button class="btn ghost" data-fav="${k}">${list[k] ? "♥ In My List" : "+ My List"}</button>
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
}

function setChipFilter(v) {
  if (v === "all") {
    filter = { t: "all", g: "all", authorOnly: false };
  } else if (v === "author") {
    filter = { t: "all", g: "all", authorOnly: true };
  } else if (["book", "story", "movie", "tv"].includes(v)) {
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
  $("#main").innerHTML = `<h2 style="font:700 1.6rem var(--display);padding:30px clamp(16px,4vw,48px) 0">${title}</h2>` +
    (items.length ? `<div class="grid">${items.map(i => card(i)).join("")}</div>` : `<p class="msg">${empty}</p>`);
}

/* Live Search */
let st;
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
  showGrid(items, "♥ My Saved List", "Your list is currently empty. Click the heart or '+ My List' button on any book, story, or film to save it here.");
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
      videoEmbed = `<button class="btn" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5" onclick="embedYouTube('${yt}')">▶ Play Video / Trailer</button>`;
    }
  }

  let readStoryBlock = "";
  if (it.fullText) {
    readStoryBlock = `<div class="story-reader">
      <h3>📖 Read Full Story</h3>
      <div class="story-text">${esc(it.fullText).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</div>
    </div>`;
  }

  let extButton = "";
  if (it.url) {
    const label = it.type === "book" ? "📖 Open Book Link / Preview ↗" :
      it.type === "story" ? "✒️ Read Original Story Source ↗" : "▶ Watch Stream / Trailer ↗";
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
        ${isPick ? `<span class="badge-author" style="font-size:.7rem;padding:3px 10px;border-radius:99px;background:linear-gradient(135deg,var(--gold),var(--ember));color:#07060c;font-weight:700">⭐ AUTHOR'S FAVORITE</span>` : ""}
      </div>
      <h2>${esc(it.title)}</h2>
      ${it.creator ? `<p class="creator">${esc(it.creator)}</p>` : ""}
      <p class="meta">${[it.date, "★ " + Number(it.rating || 0).toFixed(1), genresDisplay].filter(Boolean).join("  ·  ")}</p>
      <p class="ov">${esc(it.ov || "No description available.")}</p>
      
      ${readStoryBlock}

      <div class="sheet-actions">
        ${extButton}
        <button class="btn" data-fav="${k}" onclick="toggleFav('${k}',this)">${list[k] ? "♥ In My List" : "+ Add to My List"}</button>
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

  if (btn) btn.textContent = list[k] ? "♥ In My List" : "+ Add to My List";

  document.querySelectorAll(`.card[data-k="${k}"]`).forEach(c => {
    c.querySelector(".heart")?.remove();
    if (list[k]) c.insertAdjacentHTML("beforeend", '<span class="heart">♥</span>');
  });

  showToast(list[k] ? "Saved to My List" : "Removed from My List");
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

  if (s) {
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
      showToast("📬 Thank you! Your recommendation was submitted to the author.");
    } else {
      alert("Submission failed. Please try again.");
    }
  } catch {
    alert("Cannot connect to server. Please try again later.");
  }
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

  const text = `Roninlife Recommendation:\n${type}: ${title} (${creator || "Unknown"})\nSuggested by: ${by}\nNotes: ${notes}`;

  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 Recommendation copied to clipboard!");
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
