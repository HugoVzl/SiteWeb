/* ------------------------------------------------------------------ */
/*  Toit Commun — version HTML + Tailwind + JS pur (aucun build)      */
/* ------------------------------------------------------------------ */

const ACCENT = "#c2410c";

/* Palette des participants — ordre fixe, validée daltonisme (ΔE 40.2).
   Les teintes claires (ambre, rose) sont toujours accompagnées du nom. */
const PALETTE = [
  { hex: "#2563eb", bg: "bg-blue-600",    soft: "bg-blue-50",    text: "text-blue-700",    fg: "text-white" },
  { hex: "#059669", bg: "bg-emerald-600", soft: "bg-emerald-50", text: "text-emerald-700", fg: "text-white" },
  { hex: "#f59e0b", bg: "bg-amber-500",   soft: "bg-amber-50",   text: "text-amber-700",   fg: "text-stone-900" },
  { hex: "#15803d", bg: "bg-green-700",   soft: "bg-green-50",   text: "text-green-800",   fg: "text-white" },
  { hex: "#6d28d9", bg: "bg-violet-700",  soft: "bg-violet-50",  text: "text-violet-700",  fg: "text-white" },
  { hex: "#ef4444", bg: "bg-red-500",     soft: "bg-red-50",     text: "text-red-600",     fg: "text-white" },
  { hex: "#f472b6", bg: "bg-pink-400",    soft: "bg-pink-50",    text: "text-pink-600",    fg: "text-stone-900" },
  { hex: "#ea580c", bg: "bg-orange-600",  soft: "bg-orange-50",  text: "text-orange-700",  fg: "text-white" },
];

const MODES = {
  achat:    { label: "Achat",    min: 50000, max: 1000000, step: 5000, unit: "€",        defaults: [180000, 350000] },
  location: { label: "Location", min: 300,   max: 3500,    step: 50,   unit: "€ / mois", defaults: [700, 1300] },
};

const EXTRAS = [
  { id: "jardin",     label: "Jardin / extérieur", icon: "tree-pine" },
  { id: "parking",    label: "Parking / garage",   icon: "car" },
  { id: "balcon",     label: "Balcon / terrasse",  icon: "sun" },
  { id: "ascenseur",  label: "Ascenseur",          icon: "move-vertical" },
  { id: "transports", label: "Proche transports",  icon: "bus" },
  { id: "calme",      label: "Quartier calme",     icon: "moon" },
  { id: "lumineux",   label: "Très lumineux",      icon: "lightbulb" },
  { id: "recent",     label: "Neuf / rénové",      icon: "hammer" },
];

const STANCES = [
  { id: "must", label: "Indispensable", icon: "lock",  val: 2 },
  { id: "nice", label: "Souhaité",      icon: "heart", val: 1 },
  { id: "any",  label: "Peu importe",   icon: "minus", val: 0 },
];
const stanceVal = (s) => (STANCES.find((x) => x.id === s) || STANCES[2]).val;
const stanceLabel = (s) => STANCES.find((x) => x.id === s).label;

const TYPES = [
  { id: "maison",      label: "Maison",      icon: "home" },
  { id: "appartement", label: "Appartement", icon: "building-2" },
  { id: "indifferent", label: "Indifférent", icon: "shuffle" },
];

const WEIGHT_DIMS = { type: "Type de bien", budget: "Budget", location: "Localisation", space: "Surface & pièces" };

function makeParticipant(i, mode) {
  const cfg = MODES[mode];
  return {
    id: i, name: "", colorIdx: i % PALETTE.length, type: "indifferent",
    budgetMin: cfg.defaults[0], budgetMax: cfg.defaults[1],
    locations: [], rooms: 3, bedrooms: 2, surface: 70,
    extras: Object.fromEntries(EXTRAS.map((e) => [e.id, "any"])),
    weights: { type: 3, budget: 4, location: 4, space: 3 },
    done: false,
  };
}

const fmtNum = (n) => n.toLocaleString("fr-FR");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------ état ------------------------------ */

let state;
function initialState() {
  return {
    step: "setup", mode: "achat",
    participants: [makeParticipant(0, "achat"), makeParticipant(1, "achat")],
    active: 0, showExport: false,
  };
}
state = initialState();

/* --------------------------- synthèse ----------------------------- */

function computeSynthesis(ps, mode) {
  const cfg = MODES[mode];
  const mins = ps.map((p) => p.budgetMin);
  const maxs = ps.map((p) => p.budgetMax);
  const lo = Math.max(...mins), hi = Math.min(...maxs);
  const unionLo = Math.min(...mins), unionHi = Math.max(...maxs);
  const overlap = hi > lo;
  const budgetScore = !overlap ? 0 : unionHi === unionLo ? 100
    : Math.round(((hi - lo) / (unionHi - unionLo)) * 100);

  const nbMaison = ps.filter((p) => p.type === "maison").length;
  const nbAppart = ps.filter((p) => p.type === "appartement").length;
  const typeScore = nbMaison === 0 || nbAppart === 0 ? 100
    : Math.round(100 * (1 - (2 * Math.min(nbMaison, nbAppart)) / (nbMaison + nbAppart)));
  const typeLabel = nbMaison > 0 && nbAppart > 0
    ? `À trancher (${nbMaison} maison · ${nbAppart} appartement)`
    : nbMaison > 0 ? "Maison" : nbAppart > 0 ? "Appartement" : "Indifférent";

  const locMap = new Map();
  let listedCount = 0;
  ps.forEach((p) => {
    const set = new Set(p.locations.map((l) => l.trim().toLowerCase()).filter(Boolean));
    if (set.size > 0) listedCount += 1;
    set.forEach((key) => {
      const label = p.locations.find((l) => l.trim().toLowerCase() === key).trim();
      if (!locMap.has(key)) locMap.set(key, { label, holders: [] });
      locMap.get(key).holders.push(p.name || "—");
    });
  });
  const allLocs = [...locMap.values()];
  const commonLocs = allLocs.filter((l) => l.holders.length === listedCount && listedCount > 0);
  const locScore = listedCount === 0 ? 100 : allLocs.length === 0 ? 100
    : Math.round((commonLocs.length / allLocs.length) * 100);

  const spreadScore = (vals) => {
    const mx = Math.max(...vals), mn = Math.min(...vals);
    return mx === 0 ? 100 : Math.max(0, Math.round(100 * (1 - (mx - mn) / mx)));
  };
  const surfaceScore = spreadScore(ps.map((p) => p.surface));
  const roomsScore = Math.round(
    (spreadScore(ps.map((p) => p.rooms)) + spreadScore(ps.map((p) => p.bedrooms))) / 2);
  const needSurface = Math.max(...ps.map((p) => p.surface));
  const needRooms = Math.max(...ps.map((p) => p.rooms));
  const needBedrooms = Math.max(...ps.map((p) => p.bedrooms));

  const extras = EXTRAS.map((e) => {
    const vals = ps.map((p) => stanceVal(p.extras[e.id]));
    const spread = Math.max(...vals) - Math.min(...vals);
    const score = 100 - 50 * spread;
    const musts = ps.filter((p) => p.extras[e.id] === "must").map((p) => p.name || "—");
    const nices = ps.filter((p) => p.extras[e.id] === "nice").map((p) => p.name || "—");
    const anys  = ps.filter((p) => p.extras[e.id] === "any").map((p) => p.name || "—");
    return { ...e, vals, spread, score, musts, nices, anys };
  });
  const optionsScore = Math.round(extras.reduce((s, e) => s + e.score, 0) / extras.length);

  const avgW = (dim) => ps.reduce((s, p) => s + p.weights[dim], 0) / ps.length;
  const meanStance = ps.reduce((s, p) => s + EXTRAS.reduce((t, e) => t + stanceVal(p.extras[e.id]), 0), 0)
    / (ps.length * EXTRAS.length);
  const parts = [
    [typeScore, avgW("type")], [budgetScore, avgW("budget")], [locScore, avgW("location")],
    [(surfaceScore + roomsScore) / 2, avgW("space")], [optionsScore, 1 + meanStance],
  ];
  const totalW = parts.reduce((s, [, w]) => s + w, 0);
  const global = Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) / totalW);

  const verdict =
    global >= 80 ? "Accord solide" :
    global >= 60 ? "Bonne base commune" :
    global >= 40 ? "Des compromis à négocier" : "Grosses divergences";

  const consensus = [], tensions = [];
  if (overlap) {
    consensus.push({ icon: "key-round", title: "Une zone de budget commune existe",
      detail: `${fmtNum(lo)} – ${fmtNum(hi)} ${cfg.unit}` });
    if (budgetScore < 25) tensions.push({ icon: "alert-triangle", title: "Budget commun étroit",
      detail: `Seulement ${budgetScore} % des fourchettes se recouvrent.` });
  } else {
    tensions.push({ icon: "alert-triangle", title: "Budgets incompatibles",
      detail: `Il manque ${fmtNum(lo - hi)} ${cfg.unit} pour que les fourchettes se croisent.` });
  }
  if (nbMaison > 0 && nbAppart > 0) {
    const wantM = ps.filter((p) => p.type === "maison").map((p) => p.name || "—");
    const wantA = ps.filter((p) => p.type === "appartement").map((p) => p.name || "—");
    tensions.push({ icon: "home", title: "Type de bien à trancher",
      detail: `Maison pour ${wantM.join(", ")} · appartement pour ${wantA.join(", ")}.` });
  } else if (typeLabel !== "Indifférent") {
    consensus.push({ icon: nbMaison > 0 ? "home" : "building-2",
      title: `Tout le monde vise : ${typeLabel.toLowerCase()}`, detail: "Aucun désaccord sur le type de bien." });
  }
  if (commonLocs.length > 0)
    consensus.push({ icon: "map-pin", title: "Localisations partagées",
      detail: commonLocs.map((l) => l.label).join(", ") });
  if (listedCount > 1 && commonLocs.length === 0 && allLocs.length > 0)
    tensions.push({ icon: "map-pin", title: "Aucune localisation commune",
      detail: allLocs.map((l) => `${l.label} (${l.holders.join(", ")})`).join(" · ") });
  if (surfaceScore >= 85)
    consensus.push({ icon: "sparkles", title: "Attentes de surface alignées",
      detail: `Le groupe converge autour de ${needSurface} m² minimum.` });
  if (surfaceScore < 60)
    tensions.push({ icon: "alert-triangle", title: "Attentes de surface éloignées",
      detail: `De ${Math.min(...ps.map((p) => p.surface))} à ${needSurface} m² selon les personnes.` });
  extras.forEach((e) => {
    if (e.musts.length === ps.length)
      consensus.push({ icon: e.icon, title: `${e.label} : indispensable pour tous`,
        detail: "Critère verrouillé par tout le groupe." });
    else if (e.anys.length === 0 && e.musts.length + e.nices.length === ps.length && e.musts.length > 0)
      consensus.push({ icon: e.icon, title: `${e.label} : voulu par tous`,
        detail: "Entre indispensable et souhaité — personne n'y est indifférent." });
    else if (e.musts.length > 0 && e.anys.length > 0)
      tensions.push({ icon: e.icon, title: `${e.label} : positions opposées`,
        detail: `Indispensable pour ${e.musts.join(", ")} · peu importe pour ${e.anys.join(", ")}.` });
  });

  const groupMusts = extras.filter((e) => e.musts.length > 0);
  const groupNices = extras.filter((e) => e.musts.length === 0 && e.nices.length > 0);

  const radar = [
    { axis: "Type", v: typeScore }, { axis: "Budget", v: budgetScore }, { axis: "Lieu", v: locScore },
    { axis: "Surface", v: surfaceScore }, { axis: "Pièces", v: roomsScore }, { axis: "Options", v: optionsScore },
  ];

  return {
    cfg, lo, hi, unionLo, unionHi, overlap, budgetScore, typeScore, typeLabel,
    commonLocs, locScore, listedCount, surfaceScore, roomsScore,
    needSurface, needRooms, needBedrooms, extras, optionsScore,
    global, verdict, consensus, tensions, radar, groupMusts, groupNices,
    names: ps.map((p) => p.name || "—"),
  };
}

function buildExport(ps, mode, S) {
  const cfg = MODES[mode];
  const L = [];
  L.push(`TOIT COMMUN — Synthèse du ${new Date().toLocaleDateString("fr-FR")}`);
  L.push(`Projet : ${cfg.label} · ${ps.length} participants (${S.names.join(", ")})`);
  L.push(`Compatibilité du groupe : ${S.global} % — ${S.verdict}`);
  L.push("");
  L.push(`BUDGET COMMUN : ${S.overlap ? `${fmtNum(S.lo)} – ${fmtNum(S.hi)} ${cfg.unit}` : "aucune zone commune"}`);
  L.push(`TYPE DE BIEN : ${S.typeLabel}`);
  L.push(`LOCALISATIONS COMMUNES : ${S.commonLocs.length ? S.commonLocs.map((l) => l.label).join(", ") : "aucune"}`);
  L.push(`SURFACE : ≥ ${S.needSurface} m² · PIÈCES : ≥ ${S.needRooms} · CHAMBRES : ≥ ${S.needBedrooms}`);
  if (S.groupMusts.length) {
    L.push("", "INDISPENSABLES DU GROUPE :");
    S.groupMusts.forEach((e) => L.push(`- ${e.label} (exigé par ${e.musts.join(", ")})`));
  }
  if (S.groupNices.length) {
    L.push("", "SOUHAITS PARTAGÉS :");
    S.groupNices.forEach((e) => L.push(`- ${e.label} (souhaité par ${e.nices.join(", ")})`));
  }
  if (S.tensions.length) {
    L.push("", "POINTS DE VIGILANCE :");
    S.tensions.forEach((t) => L.push(`- ${t.title} — ${t.detail}`));
  }
  return L.join("\n");
}

/* --------------------------- fragments ----------------------------- */

function avatarHtml(p, size = "md", clickable = false, idx = null) {
  const c = PALETTE[p.colorIdx];
  const cls = size === "lg" ? "w-12 h-12 text-lg" : size === "sm" ? "w-6 h-6 text-[10px]" : "w-9 h-9 text-sm";
  const initial = esc((p.name || "?").trim().charAt(0).toUpperCase() || "?");
  const inter = clickable
    ? `data-action="cycle-color" data-idx="${idx}" title="Changer de couleur" style="cursor:pointer"` : "";
  const ring = clickable ? "hover:scale-110 active:scale-95 ring-2 ring-white shadow" : "";
  return `<span ${inter} id="${clickable ? `av-${idx}` : ""}"
    class="${cls} ${c.bg} ${c.fg} rounded-full grid place-items-center font-serif font-bold shrink-0 select-none transition-transform ${ring}">${initial}</span>`;
}

function starsHtml(dim, value) {
  return `<span class="flex items-center gap-0.5">` +
    [1, 2, 3, 4, 5].map((i) =>
      `<button type="button" data-action="weight" data-dim="${dim}" data-val="${i}"
        aria-label="${i} étoile${i > 1 ? "s" : ""}"
        class="p-0.5 transition-transform hover:scale-125 active:scale-95 ${i <= value ? "text-amber-500" : "text-stone-300"}">
        <i data-lucide="star" class="w-4 h-4 pointer-events-none" ${i <= value ? 'fill="currentColor"' : 'fill="none"'}></i>
      </button>`).join("") + `</span>`;
}

function sectionHtml(num, title, hint, starsBlock, inner) {
  return `<section class="border-t border-stone-200 pt-5 mt-6 first:border-t-0 first:pt-0 first:mt-0">
    <div class="flex items-start justify-between gap-3 mb-3 flex-wrap">
      <div>
        <h3 class="font-serif text-lg text-stone-900 leading-tight">
          <span class="text-orange-700 italic mr-2">${num}.</span>${title}
        </h3>
        ${hint ? `<p class="text-xs text-stone-500 mt-0.5">${hint}</p>` : ""}
      </div>
      ${starsBlock ? `<div class="flex items-center gap-2 text-xs text-stone-500">
        <span class="hidden sm:inline">Priorité</span>${starsBlock}</div>` : ""}
    </div>
    ${inner}
  </section>`;
}

function railHtml() {
  const steps = ["L'équipe", "Les critères", "La synthèse"];
  const idx = state.step === "setup" ? 0 : state.step === "entry" ? 1 : 2;
  return steps.map((s, i) => `<li class="flex items-center gap-1 sm:gap-2">
    ${i > 0 ? `<span class="w-6 sm:w-10 h-px ${i <= idx ? "bg-orange-700" : "bg-stone-300"}"></span>` : ""}
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors ${
      i === idx ? "bg-orange-700 text-white border-orange-700 font-medium"
      : i < idx ? "bg-orange-50 text-orange-700 border-orange-200"
      : "bg-white text-stone-400 border-stone-200"}">
      ${i < idx ? '<i data-lucide="check" class="w-3 h-3"></i>' : `<span class="font-serif italic">${i + 1}</span>`}
      <span class="hidden sm:inline">${s}</span>
    </span>
  </li>`).join("");
}

/* ---------------------------- écrans ------------------------------- */

function renderSetup() {
  const canStart = state.participants.every((p) => p.name.trim().length > 0);
  return `<div class="tc-in">
    <p class="font-serif italic text-orange-700 mb-1">Étape 1</p>
    <h1 class="font-serif text-3xl sm:text-4xl leading-tight mb-2">Qui cherche un toit<br class="sm:hidden" /> avec vous&nbsp;?</h1>
    <p class="text-sm text-stone-500 mb-8 max-w-md">
      Chacun posera ses critères de son côté, puis Toit Commun croisera tout
      pour révéler ce qui vous rassemble — et ce qu'il faudra négocier.
    </p>
    <div class="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">

      ${sectionHtml("1", "Le projet", "", "", `<div class="grid grid-cols-2 gap-2">
        ${Object.entries(MODES).map(([id, m]) => `
          <button type="button" data-action="mode" data-mode="${id}"
            class="px-4 py-3 rounded-2xl border text-sm font-medium transition-all active:scale-[.98] ${
              state.mode === id ? "bg-orange-700 text-white border-orange-700 shadow"
              : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"}">
            <span class="font-serif text-base block pointer-events-none">${m.label}</span>
            <span class="text-[11px] pointer-events-none ${state.mode === id ? "text-orange-100" : "text-stone-400"}">budget en ${m.unit}</span>
          </button>`).join("")}
      </div>`)}

      ${sectionHtml("2", "Le nombre de participants", "", "", `<div class="flex flex-wrap gap-1.5">
        ${[2, 3, 4, 5, 6, 7, 8].map((n) => `
          <button type="button" data-action="count" data-n="${n}"
            class="w-10 h-10 rounded-full border font-serif text-lg transition-all active:scale-90 ${
              state.participants.length === n ? "bg-stone-900 text-white border-stone-900 shadow"
              : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"}">${n}</button>`).join("")}
      </div>`)}

      ${sectionHtml("3", "Les prénoms", "Touchez la pastille pour changer de couleur.", "",
        `<div class="grid sm:grid-cols-2 gap-2.5">
          ${state.participants.map((pt, i) => `
            <div class="flex items-center gap-2.5 p-2 rounded-2xl border border-stone-200 bg-stone-50 focus-within:border-orange-700 focus-within:bg-white transition">
              ${avatarHtml(pt, "md", true, i)}
              <input data-name-idx="${i}" value="${esc(pt.name)}" placeholder="Participant ${i + 1}"
                class="flex-1 min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none" />
            </div>`).join("")}
        </div>`)}
    </div>

    <button type="button" data-action="start" id="start-btn" ${canStart ? "" : "disabled"}
      class="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-orange-700 text-white font-medium shadow-lg shadow-orange-700/20 hover:bg-orange-800 active:scale-[.98] transition disabled:opacity-40 disabled:pointer-events-none">
      Commencer la saisie <i data-lucide="arrow-right" class="w-4 h-4 pointer-events-none"></i>
    </button>
    <p id="start-hint" class="text-xs text-stone-400 mt-2 ${canStart ? "hidden" : ""}">Renseignez tous les prénoms pour continuer.</p>
  </div>`;
}

function renderEntry() {
  const p = state.participants[state.active];
  const pc = PALETTE[p.colorIdx];
  const cfg = MODES[state.mode];
  const allDone = state.participants.every((x) => x.done);
  const pctB = (v) => ((v - cfg.min) / (cfg.max - cfg.min)) * 100;

  return `<div class="tc-in">
    <p class="font-serif italic text-orange-700 mb-1">Étape 2</p>
    <h1 class="font-serif text-3xl sm:text-4xl leading-tight mb-5">
      Les critères de <span class="${pc.text}">${esc(p.name) || "…"}</span>
    </h1>

    <div class="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-4">
      ${state.participants.map((pt, i) => {
        const on = i === state.active;
        return `<button type="button" data-action="tab" data-idx="${i}"
          class="inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border whitespace-nowrap text-sm transition-all active:scale-95 shrink-0 ${
            on ? "bg-stone-900 text-white border-stone-900 shadow"
            : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"}">
          <span class="pointer-events-none">${avatarHtml(pt, "sm")}</span>
          <span class="pointer-events-none">${esc(pt.name)}</span>
          ${pt.done ? `<span class="pointer-events-none w-4 h-4 rounded-full grid place-items-center ${on ? "bg-emerald-400 text-stone-900" : "bg-emerald-600 text-white"}">
            <i data-lucide="check" class="w-3 h-3"></i></span>` : ""}
        </button>`;
      }).join("")}
    </div>

    <div class="tc-in bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">

      ${sectionHtml("1", "Type de bien", "", starsHtml("type", p.weights.type),
        `<div class="grid grid-cols-3 gap-2">
          ${TYPES.map((t) => {
            const on = p.type === t.id;
            return `<button type="button" data-action="type" data-type="${t.id}"
              class="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border text-xs font-medium transition-all active:scale-[.97] ${
                on ? "border-orange-700 bg-orange-50 text-orange-800 shadow-sm"
                : "border-stone-200 bg-white text-stone-500 hover:border-stone-400"}">
              <i data-lucide="${t.icon}" class="w-5 h-5 pointer-events-none ${on ? "text-orange-700" : "text-stone-400"}"></i>
              <span class="pointer-events-none">${t.label}</span>
            </button>`;
          }).join("")}
        </div>`)}

      ${sectionHtml("2", "Budget", `Fourchette en ${cfg.unit}.`, starsHtml("budget", p.weights.budget), `
        <div class="flex justify-between items-end mb-2">
          <span class="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200">
            <span id="blo" class="font-serif text-lg text-stone-900 tabular-nums">${fmtNum(p.budgetMin)}</span>
            <span class="text-[10px] text-stone-500">${cfg.unit}</span>
          </span>
          <span class="text-stone-400 text-xs">→</span>
          <span class="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200">
            <span id="bhi" class="font-serif text-lg text-stone-900 tabular-nums">${fmtNum(p.budgetMax)}</span>
            <span class="text-[10px] text-stone-500">${cfg.unit}</span>
          </span>
        </div>
        <div class="relative h-7">
          <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-stone-200"></div>
          <div id="bfill" class="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
            style="left:${pctB(p.budgetMin)}%;width:${Math.max(0, pctB(p.budgetMax) - pctB(p.budgetMin))}%;background:${pc.hex}"></div>
          <input id="rlo" type="range" class="tc-range absolute inset-0 w-full h-full" style="--thumb:${pc.hex}"
            min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${p.budgetMin}" aria-label="Budget minimum" />
          <input id="rhi" type="range" class="tc-range absolute inset-0 w-full h-full" style="--thumb:${pc.hex}"
            min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${p.budgetMax}" aria-label="Budget maximum" />
        </div>
        <div class="flex justify-between text-[10px] text-stone-400 mt-1 tabular-nums">
          <span>${fmtNum(cfg.min)}</span><span>${fmtNum(cfg.max)}</span>
        </div>`)}

      ${sectionHtml("3", "Localisations", "", starsHtml("location", p.weights.location), `
        <div class="flex gap-2">
          <input id="loc-input" placeholder="Ville, quartier… puis Entrée"
            class="flex-1 min-w-0 px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-700 focus:ring-2 focus:ring-orange-700/20 transition" />
          <button type="button" data-action="loc-add" aria-label="Ajouter la localisation"
            class="px-3 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 hover:border-stone-400 active:scale-95 transition">
            <i data-lucide="plus" class="w-4 h-4 pointer-events-none"></i>
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-2 min-h-[1.75rem]">
          ${p.locations.length === 0
            ? `<span class="text-xs text-stone-400 italic py-1">Aucune contrainte = ouvert à tout</span>`
            : p.locations.map((v) => `
              <span class="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium ${pc.soft} ${pc.text} border border-current/20">
                <i data-lucide="map-pin" class="w-3 h-3"></i>${esc(v)}
                <button type="button" data-action="loc-del" data-loc="${esc(v)}" aria-label="Retirer ${esc(v)}"
                  class="p-0.5 rounded-full hover:bg-white/70 transition">
                  <i data-lucide="x" class="w-3 h-3 pointer-events-none"></i>
                </button>
              </span>`).join("")}
        </div>`)}

      ${sectionHtml("4", "Surface & pièces", "", starsHtml("space", p.weights.space), `
        <div class="mb-4">
          <div class="flex justify-between items-baseline mb-1">
            <span class="text-xs text-stone-500">Surface minimum</span>
            <span class="font-serif text-xl tabular-nums"><span id="sval">${p.surface}</span> <span class="text-xs text-stone-500 font-sans">m²</span></span>
          </div>
          <div class="relative h-7">
            <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-stone-200"></div>
            <div id="sfill" class="absolute top-1/2 -translate-y-1/2 h-2 rounded-l-full"
              style="width:${((p.surface - 15) / (300 - 15)) * 100}%;background:${pc.hex}"></div>
            <input id="rs" type="range" class="tc-range absolute inset-0 w-full h-full" style="--thumb:${pc.hex}"
              min="15" max="300" step="5" value="${p.surface}" aria-label="Surface minimum" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${[["rooms", "Pièces min.", p.rooms, 1, 10], ["bedrooms", "Chambres min.", p.bedrooms, 0, 8]].map(([f, lbl, val, mn, mx]) => `
            <div class="rounded-2xl border border-stone-200 bg-stone-50 p-3 flex flex-col items-center gap-1.5">
              <span class="text-xs text-stone-500">${lbl}</span>
              <div class="flex items-center gap-3">
                <button type="button" data-action="step" data-field="${f}" data-d="-1" data-min="${mn}" data-max="${mx}"
                  class="w-8 h-8 rounded-full border border-stone-300 grid place-items-center text-stone-600 hover:bg-stone-100 hover:border-stone-400 active:scale-90 transition">
                  <i data-lucide="minus" class="w-4 h-4 pointer-events-none"></i>
                </button>
                <span class="font-serif text-xl text-stone-900 min-w-[3.5rem] text-center tabular-nums">${val}</span>
                <button type="button" data-action="step" data-field="${f}" data-d="1" data-min="${mn}" data-max="${mx}"
                  class="w-8 h-8 rounded-full border border-stone-300 grid place-items-center text-stone-600 hover:bg-stone-100 hover:border-stone-400 active:scale-90 transition">
                  <i data-lucide="plus" class="w-4 h-4 pointer-events-none"></i>
                </button>
              </div>
            </div>`).join("")}
        </div>`)}

      ${sectionHtml("5", "Ce qui compte vraiment",
        "Indispensable = deal-breaker. Souhaité = un plus. Peu importe = neutre.", "",
        EXTRAS.map((e) => `
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5 border-b border-stone-100 last:border-b-0">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="w-7 h-7 rounded-lg bg-stone-100 grid place-items-center text-stone-500 shrink-0">
                <i data-lucide="${e.icon}" class="w-4 h-4"></i>
              </span>
              <span class="text-sm text-stone-800 truncate">${e.label}</span>
            </div>
            <div class="grid grid-cols-3 gap-1 sm:w-auto w-full">
              ${STANCES.map((s) => {
                const on = p.extras[e.id] === s.id;
                const onCls = s.id === "must" ? "bg-orange-700 text-white border-orange-700"
                  : s.id === "nice" ? "bg-amber-200 text-orange-900 border-amber-300"
                  : "bg-stone-200 text-stone-600 border-stone-300";
                return `<button type="button" data-action="stance" data-extra="${e.id}" data-stance="${s.id}"
                  class="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all active:scale-95 ${
                    on ? onCls + " shadow-sm" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300 hover:text-stone-600"}">
                  <i data-lucide="${s.icon}" class="w-3 h-3 pointer-events-none"></i>
                  <span class="pointer-events-none">${s.label}</span>
                </button>`;
              }).join("")}
            </div>
          </div>`).join(""))}

      <button type="button" data-action="validate"
        class="mt-7 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-stone-900 text-white font-medium shadow-lg hover:bg-stone-800 active:scale-[.99] transition">
        <i data-lucide="check" class="w-4 h-4 pointer-events-none"></i>
        Valider les critères de ${esc(p.name) || "…"}
      </button>
    </div>

    ${allDone ? `<button type="button" data-action="to-summary"
      class="mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-orange-700 text-white font-medium shadow-lg shadow-orange-700/20 hover:bg-orange-800 active:scale-[.99] transition">
      <i data-lucide="sparkles" class="w-4 h-4 pointer-events-none"></i>
      Découvrir la synthèse du groupe
      <i data-lucide="chevron-right" class="w-4 h-4 pointer-events-none"></i>
    </button>` : ""}
  </div>`;
}

function radarSvg(radar) {
  const cx = 130, cy = 105, R = 72;
  const pt = (i, f) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const poly = (f) => radar.map((_, i) => pt(i, f).map((v) => v.toFixed(1)).join(",")).join(" ");
  const dataPoly = radar.map((d, i) => pt(i, d.v / 100).map((v) => v.toFixed(1)).join(",")).join(" ");
  const labels = radar.map((d, i) => {
    const [x, y] = pt(i, 1.22);
    return `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle"
      font-size="11" fill="#57534e" font-family="system-ui,sans-serif">${d.axis}</text>`;
  }).join("");
  const spokes = radar.map((_, i) => {
    const [x, y] = pt(i, 1);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e7e5e4" stroke-width="1"/>`;
  }).join("");
  return `<svg viewBox="0 0 260 210" class="w-full h-full">
    ${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${poly(f)}" fill="none" stroke="#e7e5e4" stroke-width="1"/>`).join("")}
    ${spokes}
    <polygon points="${dataPoly}" fill="${ACCENT}" fill-opacity="0.22" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round"/>
    ${radar.map((d, i) => {
      const [x, y] = pt(i, d.v / 100);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${ACCENT}" stroke="#fff" stroke-width="1.5"><title>${d.axis} : ${d.v}/100</title></circle>`;
    }).join("")}
    ${labels}
  </svg>`;
}

function gaugeHtml(value) {
  const R = 52, C = 2 * Math.PI * R;
  return `<div class="relative w-36 h-36">
    <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90">
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="#e7e5e4" stroke-width="10"/>
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="${ACCENT}" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - value / 100)}"
        style="transition:stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)"/>
    </svg>
    <div class="absolute inset-0 grid place-items-center">
      <div class="text-center">
        <div class="font-serif text-4xl text-stone-900 leading-none">${value}<span class="text-lg text-stone-400">%</span></div>
        <div class="text-[10px] uppercase tracking-widest text-stone-500 mt-1">compatibles</div>
      </div>
    </div>
  </div>`;
}

function renderSummary() {
  const ps = state.participants;
  const cfg = MODES[state.mode];
  const S = computeSynthesis(ps, state.mode);
  const span = S.unionHi - S.unionLo || 1;

  const listHtml = (items, tone) => items.length === 0
    ? `<p class="text-sm text-stone-400 italic">${tone === "ok" ? "Rien de consensuel pour l'instant…" : "Aucune tension détectée — rare et précieux."}</p>`
    : `<ul class="space-y-3">${items.map((c) => `
      <li class="flex gap-2.5 items-start">
        <span class="w-7 h-7 rounded-lg ${tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"} grid place-items-center shrink-0 mt-0.5">
          <i data-lucide="${c.icon}" class="w-4 h-4"></i>
        </span>
        <div class="min-w-0">
          <p class="text-sm font-medium text-stone-800 leading-snug">${esc(c.title)}</p>
          <p class="text-xs text-stone-500">${esc(c.detail)}</p>
        </div>
      </li>`).join("")}</ul>`;

  return `<div class="tc-in space-y-5">
    <div>
      <p class="font-serif italic text-orange-700 mb-1">Étape 3</p>
      <h1 class="font-serif text-3xl sm:text-4xl leading-tight">La synthèse du groupe</h1>
    </div>

    <div class="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
      <div class="flex flex-col sm:flex-row items-center gap-6">
        <div class="flex flex-col items-center gap-2 shrink-0">
          ${gaugeHtml(S.global)}
          <div class="font-serif italic text-lg text-stone-900 text-center leading-tight">${S.verdict}</div>
          <div class="flex -space-x-1.5">${ps.map((pt) => avatarHtml(pt, "sm")).join("")}</div>
        </div>
        <div class="flex-1 w-full min-w-0">
          <p class="text-[10px] uppercase tracking-widest text-stone-500 mb-1 text-center sm:text-left">
            Accord du groupe par dimension (0–100)
          </p>
          <div class="h-60 sm:h-64">${radarSvg(S.radar)}</div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
      <h2 class="font-serif text-xl mb-1">Le budget, fourchette par fourchette</h2>
      <p class="text-xs text-stone-500 mb-5">
        ${S.overlap
          ? `Zone commune : <strong class="text-emerald-700">${fmtNum(S.lo)} – ${fmtNum(S.hi)} ${cfg.unit}</strong>`
          : `<span class="text-red-600 font-medium">Les fourchettes ne se croisent pas.</span>`}
      </p>
      <div class="space-y-2.5">
        ${ps.map((pt) => {
          const c = PALETTE[pt.colorIdx];
          const left = ((pt.budgetMin - S.unionLo) / span) * 100;
          const width = ((pt.budgetMax - pt.budgetMin) / span) * 100;
          return `<div class="flex items-center gap-2.5">
            <span class="w-20 sm:w-24 text-xs text-stone-600 truncate text-right shrink-0">${esc(pt.name)}</span>
            <div class="flex-1 relative h-4 rounded-full bg-stone-100">
              <div class="absolute top-0 h-full rounded-full opacity-90"
                style="left:${left}%;width:${Math.max(width, 1)}%;background:${c.hex}"
                title="${esc(pt.name)} : ${fmtNum(pt.budgetMin)} – ${fmtNum(pt.budgetMax)} ${cfg.unit}"></div>
            </div>
          </div>`;
        }).join("")}
        <div class="flex items-center gap-2.5 pt-1">
          <span class="w-20 sm:w-24 text-xs font-medium text-right shrink-0 text-emerald-700">Commun</span>
          <div class="flex-1 relative h-5">
            <div class="absolute inset-0 rounded-full border border-dashed border-stone-300"></div>
            ${S.overlap
              ? `<div class="absolute top-0 h-full rounded-full bg-emerald-600 shadow-sm"
                  style="left:${((S.lo - S.unionLo) / span) * 100}%;width:${Math.max(((S.hi - S.lo) / span) * 100, 1)}%"
                  title="Zone commune : ${fmtNum(S.lo)} – ${fmtNum(S.hi)} ${cfg.unit}"></div>`
              : `<span class="absolute inset-0 grid place-items-center text-[10px] text-red-500 font-medium">aucun recouvrement</span>`}
          </div>
        </div>
      </div>
      <div class="flex justify-between text-[10px] text-stone-400 mt-2 tabular-nums pl-24">
        <span>${fmtNum(S.unionLo)} ${cfg.unit}</span><span>${fmtNum(S.unionHi)} ${cfg.unit}</span>
      </div>
    </div>

    <div class="grid sm:grid-cols-2 gap-5">
      <div class="bg-white rounded-3xl border border-stone-200 shadow-sm p-5">
        <h2 class="font-serif text-xl mb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>Là où ça matche
        </h2>
        ${listHtml(S.consensus, "ok")}
      </div>
      <div class="bg-white rounded-3xl border border-stone-200 shadow-sm p-5">
        <h2 class="font-serif text-xl mb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>Là où ça frotte
        </h2>
        ${listHtml(S.tensions, "warn")}
      </div>
    </div>

    <div class="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
      <h2 class="font-serif text-xl mb-1">Qui tient à quoi</h2>
      <p class="text-xs text-stone-500 mb-4">Chaque colonne est un participant, chaque ligne un critère.</p>
      <div class="overflow-x-auto -mx-1 px-1">
        <table class="w-full border-separate" style="border-spacing:3px">
          <thead><tr>
            <th class="text-left text-[10px] uppercase tracking-widest text-stone-400 font-medium pb-1">Critère</th>
            ${ps.map((pt) => `<th class="pb-1"><div class="flex flex-col items-center gap-0.5">
              ${avatarHtml(pt, "sm")}
              <span class="text-[9px] text-stone-500 max-w-[3.5rem] truncate">${esc(pt.name)}</span>
            </div></th>`).join("")}
            <th class="text-[10px] uppercase tracking-widest text-stone-400 font-medium pb-1">Accord</th>
          </tr></thead>
          <tbody>
            ${S.extras.map((e) => {
              const badge = e.spread === 0 ? ["aligné", "bg-emerald-50 text-emerald-700"]
                : e.spread === 1 ? ["mitigé", "bg-amber-50 text-amber-700"]
                : ["tension", "bg-red-50 text-red-600"];
              return `<tr>
                <td class="pr-2"><span class="inline-flex items-center gap-1.5 text-xs text-stone-700 whitespace-nowrap">
                  <i data-lucide="${e.icon}" class="w-3.5 h-3.5 text-stone-400"></i>${e.label}</span></td>
                ${ps.map((pt) => {
                  const st = pt.extras[e.id];
                  const cell = st === "must" ? ["bg-orange-700 text-white", "lock"]
                    : st === "nice" ? ["bg-amber-200 text-orange-900", "heart"]
                    : ["bg-stone-100 text-stone-400", "minus"];
                  return `<td><div class="h-8 min-w-[2.25rem] rounded-lg grid place-items-center ${cell[0]}"
                    title="${esc(pt.name)} — ${e.label} : ${stanceLabel(st)}">
                    <i data-lucide="${cell[1]}" class="w-3.5 h-3.5"></i>
                  </div></td>`;
                }).join("")}
                <td class="pl-1"><span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${badge[1]}">${badge[0]}</span></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap gap-3 mt-4 text-[11px] text-stone-500">
        <span class="inline-flex items-center gap-1.5"><span class="w-4 h-4 rounded bg-orange-700 grid place-items-center text-white"><i data-lucide="lock" class="w-2.5 h-2.5"></i></span>Indispensable</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-4 h-4 rounded bg-amber-200 grid place-items-center text-orange-900"><i data-lucide="heart" class="w-2.5 h-2.5"></i></span>Souhaité</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-4 h-4 rounded bg-stone-100 grid place-items-center text-stone-400"><i data-lucide="minus" class="w-2.5 h-2.5"></i></span>Peu importe</span>
      </div>
    </div>

    <div class="bg-stone-900 text-stone-100 rounded-3xl shadow-lg p-5 sm:p-7">
      <h2 class="font-serif text-xl text-white mb-1">Le portrait-robot du bien</h2>
      <p class="text-xs text-stone-400 mb-5">Le plus petit dénominateur qui satisfait tout le monde.</p>
      <dl class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        ${[
          ["Type", S.typeLabel],
          ["Budget", S.overlap ? `${fmtNum(S.lo)} – ${fmtNum(S.hi)} ${cfg.unit}` : "à renégocier"],
          ["Où", S.commonLocs.length ? S.commonLocs.map((l) => esc(l.label)).join(", ") : S.listedCount === 0 ? "libre" : "à discuter"],
          ["Surface", `≥ ${S.needSurface} m²`],
          ["Pièces", `≥ ${S.needRooms}`],
          ["Chambres", `≥ ${S.needBedrooms}`],
        ].map(([k, v]) => `<div>
          <dt class="text-[10px] uppercase tracking-widest text-stone-400">${k}</dt>
          <dd class="font-serif text-lg text-white leading-snug">${v}</dd>
        </div>`).join("")}
      </dl>
      ${S.groupMusts.length ? `<div class="mt-5 pt-4 border-t border-stone-700">
        <p class="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Indispensables du groupe</p>
        <div class="flex flex-wrap gap-1.5">
          ${S.groupMusts.map((e) => `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-700 text-white text-xs">
            <i data-lucide="lock" class="w-3 h-3"></i>${e.label}
            <span class="text-orange-200">· ${e.musts.map(esc).join(", ")}</span>
          </span>`).join("")}
        </div>
      </div>` : ""}
    </div>

    <div class="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 class="font-serif text-xl">Partager la synthèse</h2>
          <p class="text-xs text-stone-500">Un résumé texte prêt à coller dans vos messages.</p>
        </div>
        <div class="flex gap-2">
          <button type="button" data-action="toggle-export"
            class="px-4 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-600 hover:border-stone-400 hover:bg-stone-50 active:scale-95 transition">
            ${state.showExport ? "Masquer" : "Aperçu"}
          </button>
          <button type="button" data-action="copy" id="copy-btn"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow active:scale-95 transition bg-orange-700 text-white hover:bg-orange-800">
            <i data-lucide="copy" class="w-4 h-4 pointer-events-none"></i>
            <span class="pointer-events-none">Copier le résumé</span>
          </button>
        </div>
      </div>
      ${state.showExport ? `<pre class="tc-in mt-4 p-4 rounded-2xl bg-stone-100 border border-stone-200 text-xs text-stone-700 whitespace-pre-wrap leading-relaxed overflow-x-auto">${esc(buildExport(ps, state.mode, S))}</pre>` : ""}
    </div>

    <div class="flex justify-center">
      <button type="button" data-action="to-entry"
        class="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-orange-700 transition py-2">
        <i data-lucide="pencil" class="w-3.5 h-3.5 pointer-events-none"></i>
        Modifier les critères d'un participant
      </button>
    </div>
  </div>`;
}

/* ---------------------------- rendu -------------------------------- */

const app = document.getElementById("app");
const rail = document.getElementById("rail");

function render() {
  rail.innerHTML = railHtml();
  app.innerHTML = state.step === "setup" ? renderSetup()
    : state.step === "entry" ? renderEntry() : renderSummary();
  if (window.lucide) lucide.createIcons();
  bindInputs();
}

function bindInputs() {
  /* setup : prénoms (sans re-render pour garder le focus) */
  app.querySelectorAll("[data-name-idx]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const i = +inp.dataset.nameIdx;
      state.participants[i].name = inp.value;
      const av = document.getElementById(`av-${i}`);
      if (av) av.textContent = (inp.value || "?").trim().charAt(0).toUpperCase() || "?";
      const can = state.participants.every((p) => p.name.trim().length > 0);
      const btn = document.getElementById("start-btn");
      const hint = document.getElementById("start-hint");
      if (btn) btn.disabled = !can;
      if (hint) hint.classList.toggle("hidden", can);
    });
  });

  /* entry : sliders (mise à jour DOM directe) */
  const p = state.participants[state.active];
  const cfg = MODES[state.mode];
  const rlo = document.getElementById("rlo");
  const rhi = document.getElementById("rhi");
  const rs = document.getElementById("rs");
  const pctB = (v) => ((v - cfg.min) / (cfg.max - cfg.min)) * 100;
  const refreshBudget = () => {
    document.getElementById("blo").textContent = fmtNum(p.budgetMin);
    document.getElementById("bhi").textContent = fmtNum(p.budgetMax);
    const f = document.getElementById("bfill");
    f.style.left = pctB(p.budgetMin) + "%";
    f.style.width = Math.max(0, pctB(p.budgetMax) - pctB(p.budgetMin)) + "%";
  };
  if (rlo) rlo.addEventListener("input", () => {
    p.budgetMin = Math.min(+rlo.value, p.budgetMax - cfg.step);
    rlo.value = p.budgetMin; refreshBudget();
  });
  if (rhi) rhi.addEventListener("input", () => {
    p.budgetMax = Math.max(+rhi.value, p.budgetMin + cfg.step);
    rhi.value = p.budgetMax; refreshBudget();
  });
  if (rs) rs.addEventListener("input", () => {
    p.surface = +rs.value;
    document.getElementById("sval").textContent = p.surface;
    document.getElementById("sfill").style.width = ((p.surface - 15) / (300 - 15)) * 100 + "%";
  });

  /* entry : localisation, ajout au clavier */
  const loc = document.getElementById("loc-input");
  if (loc) loc.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addLocation(); }
  });
}

function addLocation() {
  const inp = document.getElementById("loc-input");
  const v = (inp?.value || "").trim();
  if (!v) return;
  const p = state.participants[state.active];
  if (!p.locations.some((x) => x.trim().toLowerCase() === v.toLowerCase())) p.locations.push(v);
  render();
  const again = document.getElementById("loc-input");
  if (again) again.focus();
}

/* --------------------------- interactions -------------------------- */

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  const p = state.participants[state.active];

  if (a === "reset") { state = initialState(); render(); }
  else if (a === "mode") {
    state.mode = el.dataset.mode;
    const d = MODES[state.mode].defaults;
    state.participants.forEach((x) => { x.budgetMin = d[0]; x.budgetMax = d[1]; });
    render();
  }
  else if (a === "count") {
    const n = +el.dataset.n;
    if (n <= state.participants.length) state.participants = state.participants.slice(0, n);
    else for (let k = state.participants.length; k < n; k++)
      state.participants.push(makeParticipant(k, state.mode));
    render();
  }
  else if (a === "cycle-color") {
    const i = +el.dataset.idx;
    state.participants[i].colorIdx = (state.participants[i].colorIdx + 1) % PALETTE.length;
    render();
  }
  else if (a === "start") { state.active = 0; state.step = "entry"; render(); window.scrollTo(0, 0); }
  else if (a === "tab") { state.active = +el.dataset.idx; render(); }
  else if (a === "type") { p.type = el.dataset.type; render(); }
  else if (a === "weight") { p.weights[el.dataset.dim] = +el.dataset.val; render(); }
  else if (a === "stance") { p.extras[el.dataset.extra] = el.dataset.stance; render(); }
  else if (a === "step") {
    const f = el.dataset.field;
    p[f] = Math.min(+el.dataset.max, Math.max(+el.dataset.min, p[f] + +el.dataset.d));
    render();
  }
  else if (a === "loc-add") addLocation();
  else if (a === "loc-del") {
    p.locations = p.locations.filter((x) => x !== el.dataset.loc);
    render();
  }
  else if (a === "validate") {
    p.done = true;
    const next = state.participants.findIndex((x, i) => i !== state.active && !x.done);
    if (next >= 0) state.active = next; else state.step = "summary";
    render(); window.scrollTo(0, 0);
  }
  else if (a === "to-summary") { state.step = "summary"; render(); window.scrollTo(0, 0); }
  else if (a === "to-entry") { state.step = "entry"; render(); window.scrollTo(0, 0); }
  else if (a === "toggle-export") { state.showExport = !state.showExport; render(); }
  else if (a === "copy") {
    const S = computeSynthesis(state.participants, state.mode);
    const txt = buildExport(state.participants, state.mode, S);
    const done = () => {
      const btn = document.getElementById("copy-btn");
      btn.className = btn.className.replace("bg-orange-700", "bg-emerald-600").replace("hover:bg-orange-800", "");
      btn.querySelector("span").textContent = "Copié !";
      setTimeout(() => render(), 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(() => { fallbackCopy(txt); done(); });
    } else { fallbackCopy(txt); done(); }
  }
});

function fallbackCopy(txt) {
  const ta = document.createElement("textarea");
  ta.value = txt;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

render();
