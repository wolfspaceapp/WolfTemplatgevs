/* ============================================================
   NekoWolf — App de anime alimentada por el FEED de Blogger
   Base de datos = feed JSON de Blogger. Sin backend propio.
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  // Aplicar branding del config
  document.documentElement.style.setProperty("--accent", CFG.ACCENT || "#f47521");
  var brand = document.getElementById("brandLogo");
  if (brand) brand.textContent = CFG.BRAND_LETTER || "N";
  document.title = (CFG.APP_NAME || "Anime");

  /* ---------- Estado ---------- */
  var STATE = {
    posts: [],        // todos los animes normalizados
    byLabel: {},      // label -> [posts]
    loaded: false,
    heroIndex: 0,
    heroTimer: null
  };

  /* ======================================================
     1. CARGA DEL FEED DE BLOGGER
     ====================================================== */
  function feedUrl(label) {
    var base = (CFG.BLOG_URL || "").replace(/\/+$/, "");
    var path = "/feeds/posts/default";
    if (label) path += "/-/" + encodeURIComponent(label);
    return base + path + "?alt=json&max-results=" + (CFG.MAX_RESULTS || 150);
  }

  // Blogger permite JSONP: callback para evitar CORS en apps empaquetadas.
  function fetchFeed(label) {
    return new Promise(function (resolve, reject) {
      var cbName = "__blogcb_" + Math.random().toString(36).slice(2);
      var url = feedUrl(label) + "&callback=" + cbName;
      var s = document.createElement("script");
      var done = false;
      window[cbName] = function (data) {
        done = true;
        resolve(data);
        cleanup();
      };
      function cleanup() {
        try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      s.onerror = function () { if (!done) { reject(new Error("No se pudo cargar el feed")); cleanup(); } };
      s.src = url;
      document.head.appendChild(s);
      setTimeout(function () { if (!done) { reject(new Error("Timeout del feed")); cleanup(); } }, 15000);
    });
  }

  /* ======================================================
     2. NORMALIZACIÓN  (post Blogger -> objeto anime)
     ====================================================== */
  function stripHtml(html) {
    var d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.textContent || d.innerText || "").trim();
  }

  function firstImage(html) {
    if (!html) return null;
    var m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : null;
  }

  // Mejora resolución de imágenes de Blogger (sX -> s1600)
  function hiRes(url) {
    if (!url) return url;
    return url.replace(/\/s\d+(-c)?\//, "/s1600/").replace(/=s\d+(-c)?$/, "=s1600");
  }

  // Extrae episodios: busca pares "título | enlace de video" en el contenido.
  // Convención flexible: cualquier <a> cuyo href parezca video/iframe, o
  // enlaces listados. También soporta marcadores [EP]Titulo|URL[/EP].
  function extractEpisodes(html, fallbackTitle) {
    var eps = [];
    if (!html) return eps;

    // a) Marcadores explícitos [EP]Titulo|url|duracion|desc|thumb[/EP]
    var re = /\[EP\]([\s\S]*?)\[\/EP\]/gi, mm;
    while ((mm = re.exec(html)) !== null) {
      var parts = mm[1].split("|");
      eps.push({
        title: (parts[0] || "").trim() || "Episodio " + (eps.length + 1),
        url: (parts[1] || "").trim(),
        dur: (parts[2] || "").trim(),
        desc: (parts[3] || "").trim(),
        thumb: hiRes((parts[4] || "").trim())
      });
    }
    if (eps.length) return eps;

    // b) Todos los <a> del contenido como episodios
    var d = document.createElement("div");
    d.innerHTML = html;
    var links = d.querySelectorAll("a[href]");
    links.forEach(function (a, i) {
      var href = a.getAttribute("href") || "";
      if (!href || href.indexOf("#") === 0) return;
      eps.push({
        title: (a.textContent || "").trim() || "Episodio " + (i + 1),
        url: href,
        dur: "",
        desc: "",
        thumb: null
      });
    });
    return eps;
  }

  function hasMarker(labels, keys) {
    labels = labels.map(function (l) { return l.toLowerCase(); });
    return (keys || []).some(function (k) {
      return labels.some(function (l) { return l.indexOf(k.toLowerCase()) !== -1; });
    });
  }

  function normalize(entry) {
    var title = entry.title ? entry.title.$t : "Sin título";
    var contentHtml = (entry.content && entry.content.$t) || (entry.summary && entry.summary.$t) || "";
    var labels = (entry.category || []).map(function (c) { return c.term; });

    // Portada: media$thumbnail o primera imagen del contenido
    var poster = null;
    if (entry.media$thumbnail && entry.media$thumbnail.url) poster = hiRes(entry.media$thumbnail.url);
    if (!poster) poster = hiRes(firstImage(contentHtml));
    if (!poster) poster = CFG.FALLBACK_POSTER;

    // Enlace al post
    var postUrl = "";
    (entry.link || []).forEach(function (l) { if (l.rel === "alternate") postUrl = l.href; });

    var M = CFG.TAG_MARKERS || {};
    var isMovie = hasMarker(labels, M.MOVIE);
    var hasDub = hasMarker(labels, M.DUB);
    var hasSub = hasMarker(labels, M.SUB);
    var rating = (labels.filter(function (l) { return (M.RATING || []).indexOf(l.toLowerCase()) !== -1 || /^\d+\+$/.test(l); })[0]) || "";

    var eps = extractEpisodes(contentHtml, title);

    return {
      id: entry.id ? entry.id.$t : postUrl,
      title: title,
      poster: poster,
      synopsis: stripHtml(contentHtml).slice(0, 500),
      labels: labels,
      genres: labels.filter(function (l) { return (CFG.GENRES || []).indexOf(l) !== -1; }),
      type: isMovie ? "PELÍCULA" : "SERIE",
      dub: hasDub, sub: hasSub,
      rating: rating,
      published: entry.published ? entry.published.$t : "",
      postUrl: postUrl,
      episodes: eps
    };
  }

  function indexByLabel() {
    STATE.byLabel = {};
    STATE.posts.forEach(function (p) {
      p.labels.forEach(function (lb) {
        (STATE.byLabel[lb] = STATE.byLabel[lb] || []).push(p);
      });
    });
  }

  function postsForLabel(label) {
    // Coincidencia tolerante (sin acentos / mayúsculas)
    var key = norm(label);
    return STATE.posts.filter(function (p) {
      return p.labels.some(function (l) { return norm(l) === key; });
    });
  }
  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }

  /* ======================================================
     3. RENDER — helpers
     ====================================================== */
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function posterStyle(url) { return 'style="background-image:url(\'' + (url || CFG.FALLBACK_POSTER) + '\')"'; }

  function cardHTML(p) {
    var sub = [];
    if (p.dub) sub.push("Dob");
    if (p.sub) sub.push("Sub");
    var badge = p.labels.indexOf("Nuevo") !== -1
      ? '<span class="badge new">Nuevo</span>'
      : '<span class="badge">' + (p.type === "PELÍCULA" ? "Película" : "Serie") + '</span>';
    return '<div class="card" data-id="' + encodeURIComponent(p.id) + '">' +
      '<div class="poster" ' + posterStyle(p.poster) + '>' + badge + '</div>' +
      '<div class="ctitle">' + esc(p.title) + '</div>' +
      '<div class="csub">' + (sub.join(" | ") || "&nbsp;") + '</div>' +
      '</div>';
  }

  function esc(s) { return (s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function rowHTML(title, posts, variant) {
    if (!posts.length) return "";
    var inner = posts.map(cardHTML).join("");
    var cls = "row" + (variant ? " " + variant : "");
    return '<div class="' + cls + '"><div class="row-title">' + esc(title) + '</div><div class="row-scroll">' + inner + '</div></div>';
  }

  function top10HTML(title, posts) {
    if (!posts.length) return "";
    var inner = posts.slice(0, 10).map(function (p, i) {
      return '<div class="top10-card" data-id="' + encodeURIComponent(p.id) + '">' +
        '<div class="top10-num">' + (i + 1) + '</div>' +
        '<div class="poster" ' + posterStyle(p.poster) + '></div></div>';
    }).join("");
    return '<div class="row top10"><div class="row-title">' + esc(title) + '</div><div class="row-scroll">' + inner + '</div></div>';
  }

  /* ======================================================
     4. VISTAS
     ====================================================== */
  function renderHome() {
    var v = document.getElementById("view-home");
    if (!STATE.posts.length) { v.innerHTML = emptyData(); return; }

    var html = "";

    // HERO rotatorio: usa label "Destacado" o primeros posts
    var heroItems = postsForLabel("Destacado");
    if (!heroItems.length) heroItems = STATE.posts.slice(0, 5);
    html += heroHTML(heroItems[STATE.heroIndex % heroItems.length], heroItems.length);

    // Filas configuradas
    (CFG.HOME_ROWS || []).forEach(function (r) {
      var posts = postsForLabel(r.label);
      if (r.label === "Nuevo") {
        html += newEpisodesRow(r.title, posts.length ? posts : STATE.posts.slice(0, 8));
      } else {
        html += rowHTML(r.title, posts);
      }
    });

    // Top 10
    html += top10HTML("TOP 10 · SERIES HOY", STATE.posts.filter(function (p) { return p.type === "SERIE"; }));
    html += top10HTML("TOP 10 · PELÍCULAS HOY", STATE.posts.filter(function (p) { return p.type === "PELÍCULA"; }));

    v.innerHTML = html;
    bindCards(v);
    startHero(heroItems);
  }

  function heroHTML(p, total) {
    if (!p) return "";
    var meta = [];
    if (p.rating) meta.push('<span class="pill">' + esc(p.rating) + '</span>');
    meta.push('<span>' + (p.dub ? "Dob" : p.sub ? "Sub" : "Sub") + '</span>');
    if (p.genres.length) meta.push('<span class="dot">·</span><span>' + esc(p.genres.slice(0, 4).join(", ")) + '</span>');
    var dots = "";
    for (var i = 0; i < total; i++) dots += '<span class="' + (i === (STATE.heroIndex % total) ? "on" : "") + '"></span>';
    return '<div class="hero" data-id="' + encodeURIComponent(p.id) + '">' +
      '<div class="hero-bg" ' + posterStyle(p.poster) + '></div>' +
      '<div class="hero-content">' +
      '<div class="hero-logo-title">' + esc(p.title) + '</div>' +
      '<div class="hero-meta">' + meta.join(" ") + '</div>' +
      '<div class="hero-desc">' + esc(p.synopsis) + '</div>' +
      '<div class="hero-actions">' +
      '<button class="btn-play" data-play="' + encodeURIComponent(p.id) + '"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Comenzar a ver E1</button>' +
      '<button class="btn-round"><svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg></button>' +
      '</div><div class="hero-dots">' + dots + '</div></div></div>';
  }

  function newEpisodesRow(title, posts) {
    if (!posts.length) return "";
    var inner = posts.map(function (p) {
      return '<div class="card-wide" data-id="' + encodeURIComponent(p.id) + '">' +
        '<div class="thumb" ' + posterStyle(p.poster) + '><div class="play-ic"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>' +
        '<div class="ctitle" style="margin-top:8px">' + esc(p.title) + '</div>' +
        '<div class="csub">' + (p.episodes.length ? "Episodio " + p.episodes.length : (p.sub ? "Subtitulado" : "Doblaje Latino")) + '</div>' +
        '</div>';
    }).join("");
    return '<div class="row"><div class="row-title">' + esc(title) + '</div><div class="row-scroll">' + inner + '</div></div>';
  }

  function startHero(items) {
    if (STATE.heroTimer) clearInterval(STATE.heroTimer);
    if (!items || items.length < 2) return;
    STATE.heroTimer = setInterval(function () {
      if (currentView !== "home" || document.getElementById("detailScreen").classList.contains("hidden") === false) return;
      STATE.heroIndex = (STATE.heroIndex + 1) % items.length;
      var old = document.querySelector("#view-home .hero");
      if (!old) return;
      var fresh = el(heroHTML(items[STATE.heroIndex], items.length));
      old.replaceWith(fresh);
      bindCards(document.getElementById("view-home"));
    }, 6000);
  }

  /* ---- Explorar ---- */
  function renderExplore() {
    var v = document.getElementById("view-explore");
    var tabs = '<div class="tabs" id="exTabs">' +
      '<div class="tab active" data-ex="all">Todo el anime</div>' +
      '<div class="tab" data-ex="sim">Simulcasts</div>' +
      '<div class="tab" data-ex="gen">Géneros</div></div>';
    v.innerHTML = tabs + '<div id="exBody"></div>';
    v.querySelector("#exTabs").addEventListener("click", function (e) {
      var t = e.target.closest(".tab"); if (!t) return;
      v.querySelectorAll("#exTabs .tab").forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      exBody(t.getAttribute("data-ex"));
    });
    exBody("all");
    function exBody(mode) {
      var body = v.querySelector("#exBody");
      if (mode === "gen") {
        body.innerHTML = '<div class="chips">' + (CFG.GENRES || []).map(function (g) {
          return '<div class="chip" data-genre="' + esc(g) + '">' + esc(g) + '</div>';
        }).join("") + '</div><div id="genGrid"></div>';
        body.querySelectorAll(".chip").forEach(function (c) {
          c.addEventListener("click", function () { showGrid(body.querySelector("#genGrid"), postsForLabel(c.getAttribute("data-genre"))); });
        });
      } else if (mode === "sim") {
        showGrid(body, postsForLabel(CFG.SIMULCAST_LABEL));
      } else {
        showGrid(body, STATE.posts);
      }
    }
  }

  function showGrid(container, posts) {
    if (!posts.length) { container.innerHTML = '<div class="empty"><div class="empty-ic">🐱</div><div class="big">Nada por aquí todavía</div></div>'; return; }
    container.innerHTML = '<h2 class="row-title" style="margin:16px 0 0">Popular</h2><div class="grid">' + posts.map(cardHTML).join("") + '</div>';
    bindCards(container);
  }

  /* ---- Simulcasts ---- */
  function renderSimulcasts() {
    var v = document.getElementById("view-simulcasts");
    var posts = postsForLabel(CFG.SIMULCAST_LABEL);
    if (!posts.length) posts = STATE.posts.slice(0, 20);
    v.innerHTML = '<h2 class="row-title" style="font-size:26px;margin:18px 0 4px">Temporada de simulcasts</h2>' +
      '<div class="season-head" style="padding:0 16px"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>Temporada actual</div>' +
      '<div class="grid">' + posts.map(cardHTML).join("") + '</div>';
    bindCards(v);
  }

  /* ---- Mis listas ---- */
  function renderMyLists() {
    var v = document.getElementById("view-mylists");
    var favs = getFavs().map(function (id) { return STATE.posts.find(function (p) { return p.id === id; }); }).filter(Boolean);
    var tabs = '<div class="tabs" id="mlTabs"><div class="tab active" data-ml="fav">Favoritos</div><div class="tab" data-ml="hist">Historial</div></div><div id="mlBody"></div>';
    v.innerHTML = tabs;
    var body = v.querySelector("#mlBody");
    function show(which) {
      if (which === "fav") {
        if (!favs.length) {
          body.innerHTML = '<div class="empty"><div class="empty-ic">😿</div><div class="big">Tus Favoritos necesitan algo de amor.</div><div>Vamos a llenarla con anime del bueno.</div><button class="btn-play" id="goExplore">Ver todo</button></div>';
          var g = body.querySelector("#goExplore"); if (g) g.addEventListener("click", function () { switchView("explore"); });
        } else {
          body.innerHTML = '<div class="grid">' + favs.map(cardHTML).join("") + '</div>'; bindCards(body);
        }
      } else {
        body.innerHTML = '<div class="empty"><div class="empty-ic">🕐</div><div class="big">Tu historial está vacío</div></div>';
      }
    }
    show("fav");
    v.querySelector("#mlTabs").addEventListener("click", function (e) {
      var t = e.target.closest(".tab"); if (!t) return;
      v.querySelectorAll("#mlTabs .tab").forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active"); show(t.getAttribute("data-ml"));
    });
  }

  /* ---- Cuenta ---- */
  function renderAccount() {
    var v = document.getElementById("view-account");
    v.innerHTML = '<div class="account"><h2>Cuenta</h2>' +
      '<div class="acc-row"><svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5z"/></svg>Mi perfil</div>' +
      '<div class="acc-row"><svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>Mis favoritos</div>' +
      '<div class="acc-row"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 118.5 12 3.5 3.5 0 0112 15.5z"/></svg>Configuración</div>' +
      '<div class="acc-row"><svg viewBox="0 0 24 24"><path d="M11 9h2V7h-2m1 13A8 8 0 114 12a8 8 0 018 8z"/></svg>Acerca de ' + esc(CFG.APP_NAME || "la app") + '</div>' +
      '<p style="color:var(--muted);font-size:12px;margin-top:30px">Contenido alimentado por Blogger.</p></div>';
  }

  /* ======================================================
     5. DETALLE
     ====================================================== */
  function openDetail(id) {
    var p = STATE.posts.find(function (x) { return x.id === decodeURIComponent(id); });
    if (!p) return;
    var ds = document.getElementById("detailScreen");
    var meta = [];
    if (p.rating) meta.push('<span class="pill">' + esc(p.rating) + '</span>');
    meta.push('<span>' + (p.dub ? "Dob" : "Sub") + '</span>');
    meta.push('<span class="pill" style="border-color:var(--accent);color:var(--accent)">' + p.type + '</span>');

    var episodes = p.episodes.length
      ? p.episodes.map(function (ep, i) { return epHTML(p, ep, i); }).join("")
      : '<div class="empty"><div class="empty-ic">🎬</div><div class="big">Aún no hay episodios</div><div>Agrega enlaces en el post de Blogger.</div></div>';

    ds.innerHTML =
      '<div class="detail-top"><button class="icon-btn" id="detClose" style="background:rgba(0,0,0,.5)"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' +
      '<button class="icon-btn" style="background:rgba(0,0,0,.5)"><svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg></button></div>' +
      '<div class="detail-hero"><div class="bg" ' + posterStyle(p.poster) + '></div><div class="detail-title">' + esc(p.title) + '</div></div>' +
      '<div class="detail-body">' +
      '<div class="detail-meta">' + meta.join(" ") + '</div>' +
      (p.genres.length ? '<div class="detail-genres">' + esc(p.genres.join(", ")) + '</div>' : "") +
      '<div class="sub-badge"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM6 14H4v-2h2v2zm0-4H4V8h2v2zm10 4H8v-2h8v2zm4 0h-2v-2h2v2zm0-4H8V8h12v2z"/></svg>' +
      (p.sub ? "Subtitulado: Español" : "Doblaje Latino") + '</div>' +
      '<div class="detail-actions">' +
      '<button class="act" id="favBtn"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg><span>Mi lista</span></button>' +
      '<button class="act"><svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg><span>Compartir</span></button>' +
      '</div>' +
      '<p class="synopsis" id="synEl">' + esc(p.synopsis.slice(0, 160)) + (p.synopsis.length > 160 ? "…" : "") + '</p>' +
      (p.synopsis.length > 160 ? '<a class="more-link" id="moreBtn">Más detalles</a>' : "") +
      '<div class="detail-tabs" id="detTabs"><div class="tab active" data-dt="eps">Episodios</div><div class="tab" data-dt="rel">Más como esto</div></div>' +
      '<div id="detTabBody"><div class="season-head"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>Temporada 1</div>' + episodes + '</div>' +
      '</div>' +
      '<div class="watch-bar">' +
      '<button class="btn-play" id="watchE1"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Ver E1</button>' +
      '<button class="btn-round" id="favBtn2"><svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg></button>' +
      '</div>';

    ds.classList.remove("hidden");
    ds.scrollTop = 0;

    ds.querySelector("#detClose").addEventListener("click", closeDetail);
    var moreB = ds.querySelector("#moreBtn");
    if (moreB) moreB.addEventListener("click", function () {
      ds.querySelector("#synEl").textContent = p.synopsis;
      moreB.style.display = "none";
    });
    var watch = ds.querySelector("#watchE1");
    if (watch) watch.addEventListener("click", function () {
      if (p.episodes[0] && p.episodes[0].url) playVideo(p.episodes[0].url);
      else alert("Este título no tiene episodios con enlace todavía.");
    });
    [ds.querySelector("#favBtn"), ds.querySelector("#favBtn2")].forEach(function (b) {
      if (b) b.addEventListener("click", function () { toggleFav(p.id); });
    });

    // tabs del detalle
    ds.querySelector("#detTabs").addEventListener("click", function (e) {
      var t = e.target.closest(".tab"); if (!t) return;
      ds.querySelectorAll("#detTabs .tab").forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      var body = ds.querySelector("#detTabBody");
      if (t.getAttribute("data-dt") === "rel") {
        var related = related4(p);
        body.innerHTML = '<div class="grid" style="padding-top:16px">' + related.map(cardHTML).join("") + '</div>';
        bindCards(body);
      } else {
        body.innerHTML = '<div class="season-head"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>Temporada 1</div>' + episodes;
        bindEpisodes(ds, p);
      }
    });
    bindEpisodes(ds, p);
  }

  function epHTML(p, ep, i) {
    return '<div class="ep" data-url="' + esc(ep.url) + '">' +
      '<div class="ep-thumb" ' + posterStyle(ep.thumb || p.poster) + '><div class="play-ic"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>' +
      (ep.dur ? '<span class="dur">' + esc(ep.dur) + '</span>' : '') + '</div>' +
      '<div class="ep-info"><div class="ep-title">' + (i + 1) + '. ' + esc(ep.title) + '</div>' +
      (ep.desc ? '<div class="ep-desc">' + esc(ep.desc) + '</div>' : '') + '</div></div>';
  }

  function bindEpisodes(ds, p) {
    ds.querySelectorAll(".ep").forEach(function (row) {
      row.addEventListener("click", function () {
        var url = row.getAttribute("data-url");
        if (url) playVideo(url);
      });
    });
  }

  function related4(p) {
    var g = p.genres[0];
    var rel = STATE.posts.filter(function (x) { return x.id !== p.id && (!g || x.genres.indexOf(g) !== -1); });
    if (rel.length < 4) rel = STATE.posts.filter(function (x) { return x.id !== p.id; });
    return rel.slice(0, 10);
  }

  function closeDetail() { document.getElementById("detailScreen").classList.add("hidden"); }

  /* ======================================================
     6. REPRODUCTOR
     ====================================================== */
  function playVideo(url) {
    var ps = document.getElementById("playerScreen");
    var frame = document.getElementById("playerFrame");
    var embed = toEmbed(url);
    if (embed.type === "iframe") {
      frame.innerHTML = '<iframe src="' + esc(embed.url) + '" allowfullscreen allow="autoplay; encrypted-media; fullscreen"></iframe>';
    } else if (embed.type === "video") {
      frame.innerHTML = '<video src="' + esc(embed.url) + '" controls autoplay playsinline></video>';
    } else {
      // Desconocido: abrir en el reproductor como iframe directo
      frame.innerHTML = '<iframe src="' + esc(url) + '" allowfullscreen></iframe>';
    }
    ps.classList.remove("hidden");
  }

  // Convierte URLs comunes a embebibles
  function toEmbed(url) {
    try {
      // YouTube
      var yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
      if (yt) return { type: "iframe", url: "https://www.youtube.com/embed/" + yt[1] + "?autoplay=1&playsinline=1" };
      // Google Drive
      var gd = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      if (gd) return { type: "iframe", url: "https://drive.google.com/file/d/" + gd[1] + "/preview" };
      // Archivo de video directo
      if (/\.(mp4|m4v|webm|ogg|m3u8)(\?|$)/i.test(url)) return { type: "video", url: url };
      // Vimeo
      var vm = url.match(/vimeo\.com\/(\d+)/);
      if (vm) return { type: "iframe", url: "https://player.vimeo.com/video/" + vm[1] + "?autoplay=1" };
    } catch (e) {}
    return { type: "iframe", url: url };
  }

  function closePlayer() {
    var frame = document.getElementById("playerFrame");
    frame.innerHTML = ""; // detiene reproducción
    document.getElementById("playerScreen").classList.add("hidden");
  }

  /* ======================================================
     7. FAVORITOS (localStorage)
     ====================================================== */
  function getFavs() { try { return JSON.parse(localStorage.getItem("nw_favs") || "[]"); } catch (e) { return []; } }
  function toggleFav(id) {
    var f = getFavs(); var i = f.indexOf(id);
    if (i === -1) { f.push(id); toast("Añadido a Mi lista"); } else { f.splice(i, 1); toast("Quitado de Mi lista"); }
    localStorage.setItem("nw_favs", JSON.stringify(f));
  }
  function toast(msg) {
    var t = el('<div style="position:fixed;left:50%;bottom:120px;transform:translateX(-50%);background:#222;color:#fff;padding:10px 18px;border-radius:30px;z-index:200;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,.5)">' + esc(msg) + '</div>');
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .4s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 400); }, 1400);
  }

  /* ======================================================
     8. BÚSQUEDA
     ====================================================== */
  function bindSearch() {
    var ov = document.getElementById("searchOverlay");
    var input = document.getElementById("searchInput");
    var res = document.getElementById("searchResults");
    document.getElementById("btnSearch").addEventListener("click", function () { ov.classList.remove("hidden"); input.focus(); });
    document.getElementById("searchBack").addEventListener("click", function () { ov.classList.add("hidden"); input.value = ""; res.innerHTML = ""; });
    input.addEventListener("input", function () {
      var q = norm(input.value);
      if (!q) { res.innerHTML = ""; return; }
      var found = STATE.posts.filter(function (p) {
        return norm(p.title).indexOf(q) !== -1 || p.labels.some(function (l) { return norm(l).indexOf(q) !== -1; });
      }).slice(0, 40);
      res.innerHTML = found.length ? found.map(function (p) {
        return '<div class="sr-item" data-id="' + encodeURIComponent(p.id) + '"><div class="poster" ' + posterStyle(p.poster) + '></div>' +
          '<div class="info"><div class="t">' + esc(p.title) + '</div><div class="s">' + esc(p.type + (p.genres.length ? " · " + p.genres.slice(0, 2).join(", ") : "")) + '</div></div></div>';
      }).join("") : '<div class="empty"><div class="empty-ic">🔍</div><div class="big">Sin resultados</div></div>';
      res.querySelectorAll(".sr-item").forEach(function (it) {
        it.addEventListener("click", function () { ov.classList.add("hidden"); openDetail(it.getAttribute("data-id")); });
      });
    });
  }

  /* ======================================================
     9. NAVEGACIÓN
     ====================================================== */
  var currentView = "home";
  var TITLES = { home: "", mylists: "Mis listas", explore: "Explorar", simulcasts: "Simulcasts", account: "Cuenta" };
  var RENDERED = {};

  function switchView(view) {
    currentView = view;
    ["home", "mylists", "explore", "simulcasts", "account"].forEach(function (v) {
      document.getElementById("view-" + v).classList.toggle("hidden", v !== view);
    });
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === view);
    });
    document.getElementById("pageTitle").textContent = TITLES[view] || "";
    document.getElementById("brandLogo").classList.toggle("hidden", view !== "home");
    document.getElementById("app").scrollTop = 0;

    // render perezoso (siempre refresca mylists por favoritos)
    if (view === "mylists") renderMyLists();
    else if (!RENDERED[view]) {
      if (view === "home") renderHome();
      else if (view === "explore") renderExplore();
      else if (view === "simulcasts") renderSimulcasts();
      else if (view === "account") renderAccount();
      RENDERED[view] = true;
    }
  }

  function bindCards(scope) {
    scope.querySelectorAll(".card, .card-wide, .top10-card, .hero").forEach(function (c) {
      c.addEventListener("click", function (e) {
        if (e.target.closest("[data-play]")) { openDetailAndPlay(e.target.closest("[data-play]").getAttribute("data-play")); return; }
        var id = c.getAttribute("data-id"); if (id) openDetail(id);
      });
    });
    scope.querySelectorAll("[data-play]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); openDetailAndPlay(b.getAttribute("data-play")); });
    });
  }

  function openDetailAndPlay(id) {
    var p = STATE.posts.find(function (x) { return x.id === decodeURIComponent(id); });
    openDetail(id);
    if (p && p.episodes[0] && p.episodes[0].url) setTimeout(function () { playVideo(p.episodes[0].url); }, 100);
  }

  /* ======================================================
     10. INIT
     ====================================================== */
  function emptyData() {
    return '<div class="err-box">' +
      '<b>Configura tu blog.</b><br><br>' +
      'Abre <code>config.js</code> y cambia <code>BLOG_URL</code> por el dominio de tu blog de Blogger ' +
      '(ej. <code>https://tublog.blogspot.com</code>).<br><br>' +
      'Cada <b>entrada</b> del blog = un anime. Usa <b>etiquetas</b> (Destacado, Nuevo, Accion, Comedia…) ' +
      'para organizar las filas, y agrega los <b>episodios</b> dentro del post con el formato:' +
      '<br><br><code>[EP]Título|URL-video|23m|Descripción|miniatura[/EP]</code>' +
      '</div>';
  }

  function showLoader(on) { document.getElementById("globalLoader").classList.toggle("hidden", !on); }

  function init() {
    // nav bottom
    document.getElementById("bottomNav").addEventListener("click", function (e) {
      var b = e.target.closest(".nav-item"); if (!b) return;
      switchView(b.getAttribute("data-view"));
    });
    document.getElementById("playerClose").addEventListener("click", closePlayer);
    bindSearch();

    // Soporte botón "atrás" del teléfono (AppsGeyser/WebView)
    window.addEventListener("popstate", function () {
      if (!document.getElementById("playerScreen").classList.contains("hidden")) { closePlayer(); history.pushState(null, "", location.href); }
      else if (!document.getElementById("detailScreen").classList.contains("hidden")) { closeDetail(); history.pushState(null, "", location.href); }
      else if (!document.getElementById("searchOverlay").classList.contains("hidden")) { document.getElementById("searchOverlay").classList.add("hidden"); history.pushState(null, "", location.href); }
    });
    history.pushState(null, "", location.href);

    if (!CFG.BLOG_URL || /ejemplo-anime\.blogspot/.test(CFG.BLOG_URL)) {
      renderHome(); // muestra instrucciones
      return;
    }

    showLoader(true);
    fetchFeed().then(function (data) {
      var entries = (data && data.feed && data.feed.entry) || [];
      STATE.posts = entries.map(normalize);
      indexByLabel();
      STATE.loaded = true;
      showLoader(false);
      renderHome();
      RENDERED.home = true;
    }).catch(function (err) {
      showLoader(false);
      document.getElementById("view-home").innerHTML =
        '<div class="err-box"><b>No se pudo cargar el feed.</b><br><br>' + esc(err.message) +
        '<br><br>Revisa que <code>BLOG_URL</code> en <code>config.js</code> sea correcto y que el blog sea público.</div>';
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
