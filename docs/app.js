(function () {
  "use strict";

  const DATA = (window.SESSION_DATA && window.SESSION_DATA.sessions) || [];
  const SOURCES = (window.SESSION_DATA && window.SESSION_DATA.generated_from) || [];

  const STROKE_LABELS = {
    FS: "Freestyle", BK: "Backstroke", BR: "Breaststroke",
    FLY: "Butterfly", IM: "Individual Medley",
  };

  // ---- filter state ----
  const state = {
    search: "",
    focus: new Set(),
    phase: new Set(),
    term: new Set(),
    stroke: new Set(),
    equipment: new Set(),
    tod: new Set(),
    distMin: null, distMax: null,
    durMin: null, durMax: null,
    sort: "date-asc",
  };

  const $ = (id) => document.getElementById(id);

  // ---- build option lists from data ----
  function uniqueCounts(getter) {
    const counts = new Map();
    DATA.forEach((s) => {
      const vals = getter(s);
      (Array.isArray(vals) ? vals : [vals]).forEach((v) => {
        if (v === null || v === undefined || v === "") return;
        counts.set(v, (counts.get(v) || 0) + 1);
      });
    });
    return counts;
  }

  const FOCUS_ORDER = ["Sprint", "Distance", "Long-distance free", "IM"];

  function renderChipGroup(containerId, label, key, counts, orderHint) {
    const el = $(containerId);
    let entries = Array.from(counts.entries());
    if (orderHint) {
      entries.sort((a, b) => {
        const ia = orderHint.indexOf(a[0]);
        const ib = orderHint.indexOf(b[0]);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return b[1] - a[1];
      });
    } else {
      entries.sort((a, b) => b[1] - a[1]);
    }
    el.innerHTML = `<label>${label}</label><div class="chips"></div>`;
    const chips = el.querySelector(".chips");
    entries.forEach(([val, count]) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      const display = key === "stroke" ? (STROKE_LABELS[val] || val) : val;
      chip.innerHTML = `${display}<span class="count">${count}</span>`;
      chip.addEventListener("click", () => {
        const set = state[key];
        if (set.has(val)) { set.delete(val); chip.classList.remove("active"); }
        else { set.add(val); chip.classList.add("active"); }
        render();
      });
      chips.appendChild(chip);
    });
  }

  function buildFilters() {
    renderChipGroup("filter-focus", "Session focus", "focus",
      uniqueCounts((s) => s.categories), FOCUS_ORDER);
    renderChipGroup("filter-phase", "Phase", "phase", uniqueCounts((s) => s.phase));
    renderChipGroup("filter-term", "Term", "term", uniqueCounts((s) => s.term));
    renderChipGroup("filter-stroke", "Stroke emphasis", "stroke", uniqueCounts((s) => s.strokes));
    renderChipGroup("filter-equipment", "Equipment", "equipment", uniqueCounts((s) => s.equipment));
    renderChipGroup("filter-tod", "Time of day", "tod",
      uniqueCounts((s) => s.time_of_day || "Evening/Full"));
  }

  // ---- searching text over a session ----
  function sessionText(s) {
    if (s._text) return s._text;
    const parts = [s.phase, s.day_label, s.term, s.date_display,
      ...(s.categories || []), ...(s.stroke_names || []), ...(s.equipment || [])];
    (s.blocks || []).forEach((b) => {
      parts.push(b.name);
      (b.items || []).forEach((it) => { if (it.info) parts.push(it.info); });
    });
    s._text = parts.join(" ").toLowerCase();
    return s._text;
  }

  // ---- filtering ----
  function matches(s) {
    if (state.search) {
      const terms = state.search.toLowerCase().split(/\s+/).filter(Boolean);
      const txt = sessionText(s);
      if (!terms.every((t) => txt.includes(t))) return false;
    }
    if (state.focus.size && !(s.categories || []).some((c) => state.focus.has(c))) return false;
    if (state.phase.size && !state.phase.has(s.phase)) return false;
    if (state.term.size && !state.term.has(s.term)) return false;
    if (state.stroke.size && !(s.strokes || []).some((c) => state.stroke.has(c))) return false;
    if (state.equipment.size && !(s.equipment || []).some((c) => state.equipment.has(c))) return false;
    if (state.tod.size && !state.tod.has(s.time_of_day || "Evening/Full")) return false;

    const dist = s.total_distance || 0;
    if (state.distMin != null && dist < state.distMin) return false;
    if (state.distMax != null && dist > state.distMax) return false;

    const dur = s.duration_min || 0;
    if (state.durMin != null && dur < state.durMin) return false;
    if (state.durMax != null && dur > state.durMax) return false;

    return true;
  }

  function sortSessions(list) {
    const by = {
      "date-asc": (a, b) => a.date_iso.localeCompare(b.date_iso) || tod(a) - tod(b),
      "date-desc": (a, b) => b.date_iso.localeCompare(a.date_iso) || tod(b) - tod(a),
      "dist-desc": (a, b) => (b.total_distance || 0) - (a.total_distance || 0),
      "dist-asc": (a, b) => (a.total_distance || 0) - (b.total_distance || 0),
      "dur-desc": (a, b) => (b.duration_min || 0) - (a.duration_min || 0),
      "dur-asc": (a, b) => (a.duration_min || 0) - (b.duration_min || 0),
    };
    const tod = (s) => (s.time_of_day === "PM" ? 1 : 0);
    return list.slice().sort(by[state.sort] || by["date-asc"]);
  }

  // ---- rendering ----
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function blockDistance(b) {
    return (b.items || []).reduce((sum, it) => sum + (it.total_distance || 0), 0);
  }

  function renderSetRow(it) {
    if (it.type === "free") {
      const lines = (it.info || "").split("\n");
      const first = lines.shift();
      return `<tr class="row-free"><td colspan="4"><span class="free-label">${esc(first)}</span>${
        lines.length ? "\n" + esc(lines.join("\n")) : ""}</td></tr>`;
    }
    if (it.type === "note") {
      return `<tr class="row-note"><td colspan="4">${esc(it.info || "")}${
        it.interval ? ` · ${esc(it.interval)}` : ""}</td></tr>`;
    }
    const reps = `${it.reps} × ${it.distance}`;
    return `<tr>
      <td class="set-reps">${esc(reps)}</td>
      <td class="set-info">${esc(it.info || "")}</td>
      <td class="set-wr">${it.wr ? esc(it.wr) : ""}</td>
      <td class="set-int">${it.interval ? "on " + esc(it.interval) : ""}</td>
    </tr>`;
  }

  function renderCard(s) {
    const badges = [];
    if (s.week != null) badges.push(`<span class="badge week">Week ${s.week}</span>`);
    badges.push(`<span class="badge term">${esc(s.term)}</span>`);
    if (s.time_of_day) badges.push(`<span class="badge tod">${esc(s.time_of_day)}</span>`);

    const focusTags = (s.categories || []).map((c) => `<span class="tag focus">${esc(c)}</span>`).join("");
    const strokeTags = (s.strokes || []).map((c) => `<span class="tag stroke">${esc(STROKE_LABELS[c] || c)}</span>`).join("");
    const equipTags = (s.equipment || []).map((c) => `<span class="tag equip">${esc(c)}</span>`).join("");

    const setCount = (s.blocks || []).reduce(
      (n, b) => n + (b.items || []).filter((i) => i.type === "set").length, 0);

    const blocksHtml = (s.blocks || []).map((b) => {
      const rows = (b.items || []).map(renderSetRow).join("");
      const bd = blockDistance(b);
      return `<div class="block">
        <div class="block-head">
          <div class="block-name">${esc(b.name)}</div>
          ${bd ? `<div class="block-dist">${bd} m</div>` : ""}
        </div>
        <table class="sets"><tbody>${rows}</tbody></table>
      </div>`;
    }).join("");

    const quote = s.quote ? `<div class="quote">“${esc(s.quote)}”</div>` : "";
    const sources = (s.source_files || []).join(", ");

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <div class="card-top">
          <div>
            <div class="card-date">${esc(s.date_display)}</div>
            <div class="card-day">${esc(s.day_label)} · ${esc(s.time || "")}</div>
          </div>
          <div class="badges">${badges.join("")}</div>
        </div>
        <span class="phase-pill">${esc(s.phase)}</span>
        <div class="stats-row">
          <div class="stat-box"><div class="v">${(s.total_distance || 0).toLocaleString()}<span style="font-size:12px;font-weight:600"> m</span></div><div class="k">Distance</div></div>
          <div class="stat-box"><div class="v">${s.duration_min || "–"}<span style="font-size:12px;font-weight:600"> min</span></div><div class="k">Duration</div></div>
          <div class="stat-box"><div class="v">${setCount}</div><div class="k">Sets</div></div>
        </div>
        <div class="tag-row">${focusTags}${strokeTags}${equipTags}</div>
      </div>
      <div class="card-toggle"><span class="toggle-text">View full session</span> <span class="arrow">▾</span></div>
      <div class="card-body">
        ${blocksHtml}
        ${quote}
        <div class="source-note">Source: ${esc(sources)}</div>
      </div>`;

    const head = card.querySelector(".card-head");
    const toggle = card.querySelector(".card-toggle");
    const toggleText = card.querySelector(".toggle-text");
    const doToggle = () => {
      card.classList.toggle("open");
      toggleText.textContent = card.classList.contains("open") ? "Hide session" : "View full session";
    };
    head.addEventListener("click", doToggle);
    toggle.addEventListener("click", doToggle);
    return card;
  }

  function render() {
    const filtered = sortSessions(DATA.filter(matches));
    const cards = $("cards");
    cards.innerHTML = "";
    filtered.forEach((s) => cards.appendChild(renderCard(s)));

    $("empty").hidden = filtered.length !== 0;
    $("results-count").innerHTML =
      `${filtered.length} session${filtered.length === 1 ? "" : "s"} <span class="muted">of ${DATA.length}</span>`;
  }

  function totalVolume() {
    return DATA.reduce((n, s) => n + (s.total_distance || 0), 0);
  }

  function initHeader() {
    $("header-stats").innerHTML = `
      <div class="stat"><span class="num">${DATA.length}</span><span class="lbl">Sessions</span></div>
      <div class="stat"><span class="num">${(totalVolume() / 1000).toFixed(0)}k</span><span class="lbl">Metres</span></div>`;
    $("footer-note").textContent =
      `Extracted from ${SOURCES.length} coach PDF export${SOURCES.length === 1 ? "" : "s"} · duplicate sessions merged automatically. Data for Durham University swimming squad, 2025–26.`;
  }

  function bindControls() {
    let t;
    $("search").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 120);
    });
    const numBind = (id, key) => $(id).addEventListener("input", (e) => {
      const v = e.target.value === "" ? null : Number(e.target.value);
      state[key] = Number.isNaN(v) ? null : v;
      render();
    });
    numBind("dist-min", "distMin"); numBind("dist-max", "distMax");
    numBind("dur-min", "durMin"); numBind("dur-max", "durMax");

    $("sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });

    $("expand-all").addEventListener("click", () => {
      const cards = document.querySelectorAll(".card");
      const anyClosed = Array.from(cards).some((c) => !c.classList.contains("open"));
      cards.forEach((c) => {
        c.classList.toggle("open", anyClosed);
        const tt = c.querySelector(".toggle-text");
        if (tt) tt.textContent = anyClosed ? "Hide session" : "View full session";
      });
      $("expand-all").textContent = anyClosed ? "Collapse all" : "Expand all";
    });

    $("clear-filters").addEventListener("click", () => {
      ["focus", "phase", "term", "stroke", "equipment", "tod"].forEach((k) => state[k].clear());
      state.search = ""; state.distMin = state.distMax = state.durMin = state.durMax = null;
      $("search").value = "";
      ["dist-min", "dist-max", "dur-min", "dur-max"].forEach((id) => ($(id).value = ""));
      document.querySelectorAll(".chip.active").forEach((c) => c.classList.remove("active"));
      render();
    });

    const toggleBtn = $("mobile-filter-toggle");
    toggleBtn.addEventListener("click", () => $("filters").classList.toggle("open"));
  }

  // ---- boot ----
  if (!DATA.length) {
    $("cards").innerHTML = '<div class="empty">No session data loaded. Run <code>scripts/extract.py</code> to generate <code>sessions.js</code>.</div>';
    return;
  }
  buildFilters();
  bindControls();
  initHeader();
  render();
})();
