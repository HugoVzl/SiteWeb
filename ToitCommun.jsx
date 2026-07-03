import React, { useMemo, useState } from "react";
import {
  Home, Building2, Shuffle, MapPin, Star, Plus, Minus, X, Check,
  ChevronRight, Copy, TreePine, Car, Sun, MoveVertical, Bus, Moon,
  Lightbulb, Hammer, RefreshCw, Lock, Heart, ArrowRight, Pencil,
  AlertTriangle, Sparkles, KeyRound,
} from "lucide-react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Toit Commun — décider d'un logement à plusieurs                    */
/*  Direction visuelle : atelier d'architecte — papier chaud, encre,   */
/*  terracotta, titres serif. Un seul fichier, state en mémoire.       */
/* ------------------------------------------------------------------ */

const ACCENT = "#c2410c"; // terracotta (orange-700)

/* Palette catégorielle des participants — ordre fixe, validée CVD
   (pire ΔE adjacent 40.2). Les couleurs faibles en contraste (ambre,
   rose) sont toujours accompagnées du nom en toutes lettres. */
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
  { id: "jardin",     label: "Jardin / extérieur",  icon: TreePine },
  { id: "parking",    label: "Parking / garage",    icon: Car },
  { id: "balcon",     label: "Balcon / terrasse",   icon: Sun },
  { id: "ascenseur",  label: "Ascenseur",           icon: MoveVertical },
  { id: "transports", label: "Proche transports",   icon: Bus },
  { id: "calme",      label: "Quartier calme",      icon: Moon },
  { id: "lumineux",   label: "Très lumineux",       icon: Lightbulb },
  { id: "recent",     label: "Neuf / rénové",       icon: Hammer },
];

const STANCES = [
  { id: "must", label: "Indispensable", icon: Lock,  val: 2 },
  { id: "nice", label: "Souhaité",      icon: Heart, val: 1 },
  { id: "any",  label: "Peu importe",   icon: Minus, val: 0 },
];
const stanceVal = (s) => (STANCES.find((x) => x.id === s) || STANCES[2]).val;

const TYPES = [
  { id: "maison",      label: "Maison",      icon: Home },
  { id: "appartement", label: "Appartement", icon: Building2 },
  { id: "indifferent", label: "Indifférent", icon: Shuffle },
];

function makeParticipant(i, mode) {
  const cfg = MODES[mode];
  return {
    id: i,
    name: "",
    colorIdx: i % PALETTE.length,
    type: "indifferent",
    budgetMin: cfg.defaults[0],
    budgetMax: cfg.defaults[1],
    locations: [],
    rooms: 3,
    bedrooms: 2,
    surface: 70,
    extras: Object.fromEntries(EXTRAS.map((e) => [e.id, "any"])),
    weights: { type: 3, budget: 4, location: 4, space: 3 },
    done: false,
  };
}

const fmtNum = (n) => n.toLocaleString("fr-FR");

/* --------------------------- synthèse ----------------------------- */

function computeSynthesis(ps, mode) {
  const cfg = MODES[mode];
  const names = ps.map((p) => p.name || "—");

  /* Budget : intersection des fourchettes */
  const mins = ps.map((p) => p.budgetMin);
  const maxs = ps.map((p) => p.budgetMax);
  const lo = Math.max(...mins);
  const hi = Math.min(...maxs);
  const unionLo = Math.min(...mins);
  const unionHi = Math.max(...maxs);
  const overlap = hi > lo;
  const budgetScore = !overlap
    ? 0
    : unionHi === unionLo
      ? 100
      : Math.round(((hi - lo) / (unionHi - unionLo)) * 100);

  /* Type de bien */
  const nbMaison = ps.filter((p) => p.type === "maison").length;
  const nbAppart = ps.filter((p) => p.type === "appartement").length;
  const typeScore =
    nbMaison === 0 || nbAppart === 0
      ? 100
      : Math.round(100 * (1 - (2 * Math.min(nbMaison, nbAppart)) / (nbMaison + nbAppart)));
  const typeLabel =
    nbMaison > 0 && nbAppart > 0
      ? `À trancher (${nbMaison} maison · ${nbAppart} appartement)`
      : nbMaison > 0
        ? "Maison"
        : nbAppart > 0
          ? "Appartement"
          : "Indifférent";

  /* Localisations : intersection des listes (vide = ouvert à tout) */
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
  const partialLocs = allLocs.filter((l) => l.holders.length < listedCount);
  const locScore =
    listedCount === 0 ? 100 : allLocs.length === 0 ? 100 : Math.round((commonLocs.length / allLocs.length) * 100);

  /* Surface & pièces : la contrainte du groupe = max des minima */
  const spreadScore = (vals) => {
    const mx = Math.max(...vals);
    const mn = Math.min(...vals);
    return mx === 0 ? 100 : Math.max(0, Math.round(100 * (1 - (mx - mn) / mx)));
  };
  const surfaceScore = spreadScore(ps.map((p) => p.surface));
  const roomsScore = Math.round(
    (spreadScore(ps.map((p) => p.rooms)) + spreadScore(ps.map((p) => p.bedrooms))) / 2
  );
  const needSurface = Math.max(...ps.map((p) => p.surface));
  const needRooms = Math.max(...ps.map((p) => p.rooms));
  const needBedrooms = Math.max(...ps.map((p) => p.bedrooms));

  /* Options : accord par critère */
  const extras = EXTRAS.map((e) => {
    const vals = ps.map((p) => stanceVal(p.extras[e.id]));
    const spread = Math.max(...vals) - Math.min(...vals);
    const score = 100 - 50 * spread;
    const musts = ps.filter((p) => p.extras[e.id] === "must").map((p) => p.name || "—");
    const nices = ps.filter((p) => p.extras[e.id] === "nice").map((p) => p.name || "—");
    const anys = ps.filter((p) => p.extras[e.id] === "any").map((p) => p.name || "—");
    return { ...e, vals, spread, score, musts, nices, anys };
  });
  const optionsScore = Math.round(extras.reduce((s, e) => s + e.score, 0) / extras.length);

  /* Score global pondéré par les étoiles moyennes du groupe */
  const avgW = (dim) => ps.reduce((s, p) => s + p.weights[dim], 0) / ps.length;
  const meanStance =
    ps.reduce((s, p) => s + EXTRAS.reduce((t, e) => t + stanceVal(p.extras[e.id]), 0), 0) /
    (ps.length * EXTRAS.length);
  const parts = [
    [typeScore, avgW("type")],
    [budgetScore, avgW("budget")],
    [locScore, avgW("location")],
    [(surfaceScore + roomsScore) / 2, avgW("space")],
    [optionsScore, 1 + meanStance],
  ];
  const totalW = parts.reduce((s, [, w]) => s + w, 0);
  const global = Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) / totalW);

  const verdict =
    global >= 80 ? "Accord solide" :
    global >= 60 ? "Bonne base commune" :
    global >= 40 ? "Des compromis à négocier" :
    "Grosses divergences";

  /* Consensus & tensions */
  const consensus = [];
  const tensions = [];
  if (overlap) {
    consensus.push({
      icon: KeyRound,
      title: "Une zone de budget commune existe",
      detail: `${fmtNum(lo)} – ${fmtNum(hi)} ${cfg.unit}`,
    });
    if (budgetScore < 25)
      tensions.push({
        icon: AlertTriangle,
        title: "Budget commun étroit",
        detail: `Seulement ${budgetScore} % des fourchettes se recouvrent.`,
      });
  } else {
    tensions.push({
      icon: AlertTriangle,
      title: "Budgets incompatibles",
      detail: `Il manque ${fmtNum(lo - hi)} ${cfg.unit} pour que les fourchettes se croisent.`,
    });
  }
  if (nbMaison > 0 && nbAppart > 0) {
    const wantM = ps.filter((p) => p.type === "maison").map((p) => p.name || "—");
    const wantA = ps.filter((p) => p.type === "appartement").map((p) => p.name || "—");
    tensions.push({
      icon: Home,
      title: "Type de bien à trancher",
      detail: `Maison pour ${wantM.join(", ")} · appartement pour ${wantA.join(", ")}.`,
    });
  } else if (typeLabel !== "Indifférent") {
    consensus.push({ icon: nbMaison > 0 ? Home : Building2, title: `Tout le monde vise : ${typeLabel.toLowerCase()}`, detail: "Aucun désaccord sur le type de bien." });
  }
  if (commonLocs.length > 0)
    consensus.push({
      icon: MapPin,
      title: "Localisations partagées",
      detail: commonLocs.map((l) => l.label).join(", "),
    });
  if (listedCount > 1 && commonLocs.length === 0 && allLocs.length > 0)
    tensions.push({
      icon: MapPin,
      title: "Aucune localisation commune",
      detail: allLocs.map((l) => `${l.label} (${l.holders.join(", ")})`).join(" · "),
    });
  if (surfaceScore >= 85)
    consensus.push({
      icon: Sparkles,
      title: "Attentes de surface alignées",
      detail: `Le groupe converge autour de ${needSurface} m² minimum.`,
    });
  if (surfaceScore < 60)
    tensions.push({
      icon: AlertTriangle,
      title: "Attentes de surface éloignées",
      detail: `De ${Math.min(...ps.map((p) => p.surface))} à ${needSurface} m² selon les personnes.`,
    });
  extras.forEach((e) => {
    if (e.musts.length === ps.length)
      consensus.push({ icon: e.icon, title: `${e.label} : indispensable pour tous`, detail: "Critère verrouillé par tout le groupe." });
    else if (e.anys.length === 0 && e.musts.length + e.nices.length === ps.length && e.musts.length > 0)
      consensus.push({ icon: e.icon, title: `${e.label} : voulu par tous`, detail: "Entre indispensable et souhaité — personne n'y est indifférent." });
    else if (e.musts.length > 0 && e.anys.length > 0)
      tensions.push({
        icon: e.icon,
        title: `${e.label} : positions opposées`,
        detail: `Indispensable pour ${e.musts.join(", ")} · peu importe pour ${e.anys.join(", ")}.`,
      });
  });

  const groupMusts = extras.filter((e) => e.musts.length > 0);
  const groupNices = extras.filter((e) => e.musts.length === 0 && e.nices.length > 0);

  const radar = [
    { axis: "Type",    v: typeScore },
    { axis: "Budget",  v: budgetScore },
    { axis: "Lieu",    v: locScore },
    { axis: "Surface", v: surfaceScore },
    { axis: "Pièces",  v: roomsScore },
    { axis: "Options", v: optionsScore },
  ];

  return {
    cfg, names, lo, hi, unionLo, unionHi, overlap, budgetScore,
    typeScore, typeLabel, commonLocs, partialLocs, locScore, listedCount,
    surfaceScore, roomsScore, needSurface, needRooms, needBedrooms,
    extras, optionsScore, global, verdict, consensus, tensions, radar,
    groupMusts, groupNices,
  };
}

function buildExport(ps, mode, S) {
  const cfg = MODES[mode];
  const lines = [];
  lines.push(`TOIT COMMUN — Synthèse du ${new Date().toLocaleDateString("fr-FR")}`);
  lines.push(`Projet : ${cfg.label} · ${ps.length} participants (${S.names.join(", ")})`);
  lines.push(`Compatibilité du groupe : ${S.global} % — ${S.verdict}`);
  lines.push("");
  lines.push(`BUDGET COMMUN : ${S.overlap ? `${fmtNum(S.lo)} – ${fmtNum(S.hi)} ${cfg.unit}` : "aucune zone commune"}`);
  lines.push(`TYPE DE BIEN : ${S.typeLabel}`);
  lines.push(`LOCALISATIONS COMMUNES : ${S.commonLocs.length ? S.commonLocs.map((l) => l.label).join(", ") : "aucune"}`);
  lines.push(`SURFACE : ≥ ${S.needSurface} m² · PIÈCES : ≥ ${S.needRooms} · CHAMBRES : ≥ ${S.needBedrooms}`);
  if (S.groupMusts.length) {
    lines.push("");
    lines.push("INDISPENSABLES DU GROUPE :");
    S.groupMusts.forEach((e) => lines.push(`- ${e.label} (exigé par ${e.musts.join(", ")})`));
  }
  if (S.groupNices.length) {
    lines.push("");
    lines.push("SOUHAITS PARTAGÉS :");
    S.groupNices.forEach((e) => lines.push(`- ${e.label} (souhaité par ${e.nices.join(", ")})`));
  }
  if (S.tensions.length) {
    lines.push("");
    lines.push("POINTS DE VIGILANCE :");
    S.tensions.forEach((t) => lines.push(`- ${t.title} — ${t.detail}`));
  }
  return lines.join("\n");
}

/* ------------------------- petites briques ------------------------ */

function Avatar({ p, size = "md", onClick }) {
  const c = PALETTE[p.colorIdx];
  const cls = size === "lg" ? "w-12 h-12 text-lg" : size === "sm" ? "w-6 h-6 text-[10px]" : "w-9 h-9 text-sm";
  const initial = (p.name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? "Changer de couleur" : p.name}
      className={`${cls} ${c.bg} ${c.fg} rounded-full grid place-items-center font-serif font-bold shrink-0 select-none transition-transform ${onClick ? "hover:scale-110 active:scale-95 cursor-pointer ring-2 ring-white shadow" : ""}`}
    >
      {initial}
    </button>
  );
}

function Stars({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Priorité">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          aria-label={`${i} étoile${i > 1 ? "s" : ""}`}
          className={`p-0.5 transition-transform hover:scale-125 active:scale-95 ${i <= value ? "text-amber-500" : "text-stone-300"}`}
        >
          <Star className="w-4 h-4" fill={i <= value ? "currentColor" : "none"} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

function Section({ num, title, hint, stars, children }) {
  return (
    <section className="border-t border-stone-200 pt-5 mt-6 first:border-t-0 first:pt-0 first:mt-0">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-serif text-lg text-stone-900 leading-tight">
            <span className="text-orange-700 italic mr-2">{num}.</span>
            {title}
          </h3>
          {hint && <p className="text-xs text-stone-500 mt-0.5">{hint}</p>}
        </div>
        {stars && (
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span className="hidden sm:inline">Priorité</span>
            {stars}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function Stepper({ value, min, max, onChange, suffix }) {
  const Btn = ({ d, icon: I }) => (
    <button
      type="button"
      onClick={() => onChange(Math.min(max, Math.max(min, value + d)))}
      className="w-8 h-8 rounded-full border border-stone-300 grid place-items-center text-stone-600 hover:bg-stone-100 hover:border-stone-400 active:scale-90 transition"
    >
      <I className="w-4 h-4" />
    </button>
  );
  return (
    <div className="flex items-center gap-3">
      <Btn d={-1} icon={Minus} />
      <span className="font-serif text-xl text-stone-900 min-w-[3.5rem] text-center tabular-nums">
        {value}
        {suffix && <span className="text-xs text-stone-500 font-sans ml-1">{suffix}</span>}
      </span>
      <Btn d={1} icon={Plus} />
    </div>
  );
}

function DualRange({ min, max, step, lo, hi, onLo, onHi, hex, unit }) {
  const pct = (v) => ((v - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200">
          <span className="font-serif text-lg text-stone-900 tabular-nums">{fmtNum(lo)}</span>
          <span className="text-[10px] text-stone-500">{unit}</span>
        </span>
        <span className="text-stone-400 text-xs">→</span>
        <span className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200">
          <span className="font-serif text-lg text-stone-900 tabular-nums">{fmtNum(hi)}</span>
          <span className="text-[10px] text-stone-500">{unit}</span>
        </span>
      </div>
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-stone-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
          style={{ left: `${pct(lo)}%`, width: `${Math.max(0, pct(hi) - pct(lo))}%`, background: hex }}
        />
        <input
          type="range" className="tc-range absolute inset-0 w-full h-full" style={{ "--thumb": hex }}
          min={min} max={max} step={step} value={lo}
          onChange={(e) => onLo(Math.min(+e.target.value, hi - step))}
          aria-label="Budget minimum"
        />
        <input
          type="range" className="tc-range absolute inset-0 w-full h-full" style={{ "--thumb": hex }}
          min={min} max={max} step={step} value={hi}
          onChange={(e) => onHi(Math.max(+e.target.value, lo + step))}
          aria-label="Budget maximum"
        />
      </div>
      <div className="flex justify-between text-[10px] text-stone-400 mt-1 tabular-nums">
        <span>{fmtNum(min)}</span>
        <span>{fmtNum(max)}</span>
      </div>
    </div>
  );
}

function ChipsInput({ values, onChange, colorIdx }) {
  const [draft, setDraft] = useState("");
  const c = PALETTE[colorIdx];
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.some((x) => x.trim().toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Ville, quartier… puis Entrée"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-700 focus:ring-2 focus:ring-orange-700/20 transition"
        />
        <button
          type="button" onClick={add}
          className="px-3 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 hover:border-stone-400 active:scale-95 transition"
          aria-label="Ajouter la localisation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2 min-h-[1.75rem]">
        {values.length === 0 && (
          <span className="text-xs text-stone-400 italic py-1">Aucune contrainte = ouvert à tout</span>
        )}
        {values.map((v) => (
          <span key={v} className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium ${c.soft} ${c.text} border border-current/20`}>
            <MapPin className="w-3 h-3" />
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="p-0.5 rounded-full hover:bg-white/70 transition"
              aria-label={`Retirer ${v}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function StanceRow({ extra, value, onChange }) {
  const I = extra.icon;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5 border-b border-stone-100 last:border-b-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="w-7 h-7 rounded-lg bg-stone-100 grid place-items-center text-stone-500 shrink-0">
          <I className="w-4 h-4" />
        </span>
        <span className="text-sm text-stone-800 truncate">{extra.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 sm:w-auto w-full">
        {STANCES.map((s) => {
          const SI = s.icon;
          const on = value === s.id;
          const onCls =
            s.id === "must" ? "bg-orange-700 text-white border-orange-700" :
            s.id === "nice" ? "bg-amber-200 text-orange-900 border-amber-300" :
            "bg-stone-200 text-stone-600 border-stone-300";
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all active:scale-95 ${
                on ? `${onCls} shadow-sm` : "bg-white text-stone-400 border-stone-200 hover:border-stone-300 hover:text-stone-600"
              }`}
            >
              <SI className="w-3 h-3" />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- écrans -------------------------------- */

function ProgressRail({ step }) {
  const steps = ["L'équipe", "Les critères", "La synthèse"];
  const idx = step === "setup" ? 0 : step === "entry" ? 1 : 2;
  return (
    <ol className="flex items-center justify-center gap-1 sm:gap-2 text-[11px] sm:text-xs">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1 sm:gap-2">
          {i > 0 && <span className={`w-6 sm:w-10 h-px ${i <= idx ? "bg-orange-700" : "bg-stone-300"}`} />}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors ${
              i === idx
                ? "bg-orange-700 text-white border-orange-700 font-medium"
                : i < idx
                  ? "bg-orange-50 text-orange-700 border-orange-200"
                  : "bg-white text-stone-400 border-stone-200"
            }`}
          >
            {i < idx ? <Check className="w-3 h-3" /> : <span className="font-serif italic">{i + 1}</span>}
            <span className="hidden sm:inline">{s}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Gauge({ value }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-36 h-36">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#e7e5e4" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={R} fill="none" stroke={ACCENT} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - value / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-serif text-4xl text-stone-900 leading-none">{value}<span className="text-lg text-stone-400">%</span></div>
          <div className="text-[10px] uppercase tracking-widest text-stone-500 mt-1">compatibles</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ App ------------------------------- */

export default function ToitCommun() {
  const [step, setStep] = useState("setup");
  const [mode, setMode] = useState("achat");
  const [participants, setParticipants] = useState(() => [makeParticipant(0, "achat"), makeParticipant(1, "achat")]);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const cfg = MODES[mode];
  const update = (idx, patch) =>
    setParticipants((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const setCount = (n) =>
    setParticipants((ps) => {
      if (n <= ps.length) return ps.slice(0, n);
      const add = Array.from({ length: n - ps.length }, (_, k) => makeParticipant(ps.length + k, mode));
      return [...ps, ...add];
    });

  const switchMode = (m) => {
    setMode(m);
    const d = MODES[m].defaults;
    setParticipants((ps) => ps.map((p) => ({ ...p, budgetMin: d[0], budgetMax: d[1] })));
  };

  const reset = () => {
    setStep("setup");
    setMode("achat");
    setParticipants([makeParticipant(0, "achat"), makeParticipant(1, "achat")]);
    setActive(0);
    setShowExport(false);
  };

  const canStart = participants.every((p) => p.name.trim().length > 0);
  const allDone = participants.every((p) => p.done);

  const S = useMemo(() => computeSynthesis(participants, mode), [participants, mode]);
  const exportText = useMemo(() => buildExport(participants, mode, S), [participants, mode, S]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = exportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validate = (idx) => {
    update(idx, { done: true });
    const next = participants.findIndex((p, i) => i !== idx && !p.done);
    if (next >= 0) setActive(next);
    else setStep("summary");
  };

  const p = participants[active];
  const pc = p ? PALETTE[p.colorIdx] : PALETTE[0];

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 antialiased">
      <style>{`
        .tc-range { -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; }
        .tc-range:focus { outline: none; }
        .tc-range::-webkit-slider-runnable-track { background: transparent; }
        .tc-range::-moz-range-track { background: transparent; }
        .tc-range::-webkit-slider-thumb {
          -webkit-appearance: none; pointer-events: auto; width: 22px; height: 22px; border-radius: 9999px;
          background: #fff; border: 3px solid var(--thumb, ${ACCENT}); box-shadow: 0 1px 4px rgba(28,25,23,.25);
          cursor: grab; margin-top: 3px; transition: transform .15s;
        }
        .tc-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .tc-range::-moz-range-thumb {
          pointer-events: auto; width: 16px; height: 16px; border-radius: 9999px;
          background: #fff; border: 3px solid var(--thumb, ${ACCENT}); box-shadow: 0 1px 4px rgba(28,25,23,.25); cursor: grab;
        }
        @keyframes tc-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .tc-in { animation: tc-in .5s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* ------------------------------ header ------------------------ */}
      <header className="sticky top-0 z-20 bg-stone-100/90 backdrop-blur border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-orange-700 text-white grid place-items-center shadow-sm">
              <Home className="w-5 h-5" />
            </span>
            <div className="leading-tight">
              <div className="font-serif text-lg">Toit&nbsp;Commun</div>
              <div className="text-[10px] uppercase tracking-widest text-stone-500 hidden sm:block">
                Décidez ensemble, sous le même toit
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ProgressRail step={step} />
            <button
              type="button" onClick={reset} title="Tout recommencer"
              className="w-8 h-8 rounded-full grid place-items-center text-stone-400 hover:text-orange-700 hover:bg-orange-50 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10 pb-24">
        {/* ============================ SETUP ========================= */}
        {step === "setup" && (
          <div key="setup" className="tc-in">
            <p className="font-serif italic text-orange-700 mb-1">Étape 1</p>
            <h1 className="font-serif text-3xl sm:text-4xl leading-tight mb-2">
              Qui cherche un toit<br className="sm:hidden" /> avec vous&nbsp;?
            </h1>
            <p className="text-sm text-stone-500 mb-8 max-w-md">
              Chacun posera ses critères de son côté, puis Toit Commun croisera tout
              pour révéler ce qui vous rassemble — et ce qu'il faudra négocier.
            </p>

            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
              <Section num="1" title="Le projet">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(MODES).map(([id, m]) => (
                    <button
                      key={id} type="button" onClick={() => switchMode(id)}
                      className={`px-4 py-3 rounded-2xl border text-sm font-medium transition-all active:scale-[.98] ${
                        mode === id
                          ? "bg-orange-700 text-white border-orange-700 shadow"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                      }`}
                    >
                      <span className="font-serif text-base block">{m.label}</span>
                      <span className={`text-[11px] ${mode === id ? "text-orange-100" : "text-stone-400"}`}>
                        budget en {m.unit}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section num="2" title="Le nombre de participants">
                <div className="flex flex-wrap gap-1.5">
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n} type="button" onClick={() => setCount(n)}
                      className={`w-10 h-10 rounded-full border font-serif text-lg transition-all active:scale-90 ${
                        participants.length === n
                          ? "bg-stone-900 text-white border-stone-900 shadow"
                          : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Section>

              <Section num="3" title="Les prénoms" hint="Touchez la pastille pour changer de couleur.">
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {participants.map((pt, i) => (
                    <div key={pt.id} className="flex items-center gap-2.5 p-2 rounded-2xl border border-stone-200 bg-stone-50 focus-within:border-orange-700 focus-within:bg-white transition">
                      <Avatar p={pt} onClick={() => update(i, { colorIdx: (pt.colorIdx + 1) % PALETTE.length })} />
                      <input
                        value={pt.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                        placeholder={`Participant ${i + 1}`}
                        className="flex-1 min-w-0 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            <button
              type="button"
              disabled={!canStart}
              onClick={() => { setActive(0); setStep("entry"); }}
              className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-orange-700 text-white font-medium shadow-lg shadow-orange-700/20 hover:bg-orange-800 active:scale-[.98] transition disabled:opacity-40 disabled:pointer-events-none"
            >
              Commencer la saisie
              <ArrowRight className="w-4 h-4" />
            </button>
            {!canStart && (
              <p className="text-xs text-stone-400 mt-2">Renseignez tous les prénoms pour continuer.</p>
            )}
          </div>
        )}

        {/* ============================ ENTRY ========================= */}
        {step === "entry" && p && (
          <div key="entry" className="tc-in">
            <p className="font-serif italic text-orange-700 mb-1">Étape 2</p>
            <h1 className="font-serif text-3xl sm:text-4xl leading-tight mb-5">
              Les critères de <span className={pc.text}>{p.name || "…"}</span>
            </h1>

            {/* onglets participants */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-4">
              {participants.map((pt, i) => {
                const c = PALETTE[pt.colorIdx];
                const on = i === active;
                return (
                  <button
                    key={pt.id} type="button" onClick={() => setActive(i)}
                    className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border whitespace-nowrap text-sm transition-all active:scale-95 shrink-0 ${
                      on ? "bg-stone-900 text-white border-stone-900 shadow" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                    }`}
                  >
                    <Avatar p={pt} size="sm" />
                    {pt.name}
                    {pt.done && (
                      <span className={`w-4 h-4 rounded-full grid place-items-center ${on ? "bg-emerald-400 text-stone-900" : "bg-emerald-600 text-white"}`}>
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div key={active} className="tc-in bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
              <Section
                num="1" title="Type de bien"
                stars={<Stars value={p.weights.type} onChange={(v) => update(active, { weights: { ...p.weights, type: v } })} />}
              >
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map((t) => {
                    const TI = t.icon;
                    const on = p.type === t.id;
                    return (
                      <button
                        key={t.id} type="button" onClick={() => update(active, { type: t.id })}
                        className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border text-xs font-medium transition-all active:scale-[.97] ${
                          on ? "border-orange-700 bg-orange-50 text-orange-800 shadow-sm" : "border-stone-200 bg-white text-stone-500 hover:border-stone-400"
                        }`}
                      >
                        <TI className={`w-5 h-5 ${on ? "text-orange-700" : "text-stone-400"}`} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section
                num="2" title="Budget" hint={`Fourchette en ${cfg.unit}.`}
                stars={<Stars value={p.weights.budget} onChange={(v) => update(active, { weights: { ...p.weights, budget: v } })} />}
              >
                <DualRange
                  min={cfg.min} max={cfg.max} step={cfg.step}
                  lo={p.budgetMin} hi={p.budgetMax}
                  onLo={(v) => update(active, { budgetMin: v })}
                  onHi={(v) => update(active, { budgetMax: v })}
                  hex={pc.hex} unit={cfg.unit}
                />
              </Section>

              <Section
                num="3" title="Localisations"
                stars={<Stars value={p.weights.location} onChange={(v) => update(active, { weights: { ...p.weights, location: v } })} />}
              >
                <ChipsInput
                  values={p.locations}
                  onChange={(v) => update(active, { locations: v })}
                  colorIdx={p.colorIdx}
                />
              </Section>

              <Section
                num="4" title="Surface & pièces"
                stars={<Stars value={p.weights.space} onChange={(v) => update(active, { weights: { ...p.weights, space: v } })} />}
              >
                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs text-stone-500">Surface minimum</span>
                    <span className="font-serif text-xl tabular-nums">{p.surface} <span className="text-xs text-stone-500 font-sans">m²</span></span>
                  </div>
                  <div className="relative h-7">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-stone-200" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-2 rounded-l-full"
                      style={{ width: `${((p.surface - 15) / (300 - 15)) * 100}%`, background: pc.hex }}
                    />
                    <input
                      type="range" className="tc-range absolute inset-0 w-full h-full" style={{ "--thumb": pc.hex }}
                      min={15} max={300} step={5} value={p.surface}
                      onChange={(e) => update(active, { surface: +e.target.value })}
                      aria-label="Surface minimum"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 flex flex-col items-center gap-1.5">
                    <span className="text-xs text-stone-500">Pièces min.</span>
                    <Stepper value={p.rooms} min={1} max={10} onChange={(v) => update(active, { rooms: v })} />
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 flex flex-col items-center gap-1.5">
                    <span className="text-xs text-stone-500">Chambres min.</span>
                    <Stepper value={p.bedrooms} min={0} max={8} onChange={(v) => update(active, { bedrooms: v })} />
                  </div>
                </div>
              </Section>

              <Section num="5" title="Ce qui compte vraiment" hint="Indispensable = deal-breaker. Souhaité = un plus. Peu importe = neutre.">
                <div>
                  {EXTRAS.map((e) => (
                    <StanceRow
                      key={e.id} extra={e} value={p.extras[e.id]}
                      onChange={(v) => update(active, { extras: { ...p.extras, [e.id]: v } })}
                    />
                  ))}
                </div>
              </Section>

              <button
                type="button" onClick={() => validate(active)}
                className="mt-7 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-stone-900 text-white font-medium shadow-lg hover:bg-stone-800 active:scale-[.99] transition"
              >
                <Check className="w-4 h-4" />
                Valider les critères de {p.name || "…"}
              </button>
            </div>

            {allDone && (
              <button
                type="button" onClick={() => setStep("summary")}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-orange-700 text-white font-medium shadow-lg shadow-orange-700/20 hover:bg-orange-800 active:scale-[.99] transition"
              >
                <Sparkles className="w-4 h-4" />
                Découvrir la synthèse du groupe
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* =========================== SUMMARY ======================== */}
        {step === "summary" && (
          <div key="summary" className="tc-in space-y-5">
            <div>
              <p className="font-serif italic text-orange-700 mb-1">Étape 3</p>
              <h1 className="font-serif text-3xl sm:text-4xl leading-tight">La synthèse du groupe</h1>
            </div>

            {/* score + radar */}
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <Gauge value={S.global} />
                  <div className="font-serif italic text-lg text-stone-900 text-center leading-tight">{S.verdict}</div>
                  <div className="flex -space-x-1.5">
                    {participants.map((pt) => <Avatar key={pt.id} p={pt} size="sm" />)}
                  </div>
                </div>
                <div className="flex-1 w-full min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1 text-center sm:text-left">
                    Accord du groupe par dimension (0–100)
                  </p>
                  <div className="h-60 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={S.radar} cx="50%" cy="50%" outerRadius="72%">
                        <PolarGrid stroke="#e7e5e4" />
                        <PolarAngleAxis dataKey="axis" tick={{ fill: "#57534e", fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar dataKey="v" stroke={ACCENT} fill={ACCENT} fillOpacity={0.22} strokeWidth={2} isAnimationActive />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* budget commun */}
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
              <h2 className="font-serif text-xl mb-1">Le budget, fourchette par fourchette</h2>
              <p className="text-xs text-stone-500 mb-5">
                {S.overlap
                  ? <>Zone commune : <strong className="text-emerald-700">{fmtNum(S.lo)} – {fmtNum(S.hi)} {cfg.unit}</strong></>
                  : <span className="text-red-600 font-medium">Les fourchettes ne se croisent pas.</span>}
              </p>
              <div className="space-y-2.5">
                {participants.map((pt) => {
                  const c = PALETTE[pt.colorIdx];
                  const span = S.unionHi - S.unionLo || 1;
                  const left = ((pt.budgetMin - S.unionLo) / span) * 100;
                  const width = ((pt.budgetMax - pt.budgetMin) / span) * 100;
                  return (
                    <div key={pt.id} className="flex items-center gap-2.5">
                      <span className="w-20 sm:w-24 text-xs text-stone-600 truncate text-right shrink-0">{pt.name}</span>
                      <div className="flex-1 relative h-4 rounded-full bg-stone-100">
                        <div
                          className="absolute top-0 h-full rounded-full opacity-90"
                          style={{ left: `${left}%`, width: `${Math.max(width, 1)}%`, background: c.hex }}
                          title={`${pt.name} : ${fmtNum(pt.budgetMin)} – ${fmtNum(pt.budgetMax)} ${cfg.unit}`}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2.5 pt-1">
                  <span className="w-20 sm:w-24 text-xs font-medium text-right shrink-0 text-emerald-700">Commun</span>
                  <div className="flex-1 relative h-5">
                    <div className="absolute inset-0 rounded-full border border-dashed border-stone-300" />
                    {S.overlap ? (
                      <div
                        className="absolute top-0 h-full rounded-full bg-emerald-600 shadow-sm"
                        style={{
                          left: `${((S.lo - S.unionLo) / (S.unionHi - S.unionLo || 1)) * 100}%`,
                          width: `${Math.max(((S.hi - S.lo) / (S.unionHi - S.unionLo || 1)) * 100, 1)}%`,
                        }}
                        title={`Zone commune : ${fmtNum(S.lo)} – ${fmtNum(S.hi)} ${cfg.unit}`}
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-[10px] text-red-500 font-medium">
                        aucun recouvrement
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 mt-2 tabular-nums pl-24">
                <span>{fmtNum(S.unionLo)} {cfg.unit}</span>
                <span>{fmtNum(S.unionHi)} {cfg.unit}</span>
              </div>
            </div>

            {/* consensus / tensions */}
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5">
                <h2 className="font-serif text-xl mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  Là où ça matche
                </h2>
                {S.consensus.length === 0 && (
                  <p className="text-sm text-stone-400 italic">Rien de consensuel pour l'instant…</p>
                )}
                <ul className="space-y-3">
                  {S.consensus.map((c, i) => {
                    const CI = c.icon;
                    return (
                      <li key={i} className="flex gap-2.5 items-start">
                        <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 grid place-items-center shrink-0 mt-0.5">
                          <CI className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-800 leading-snug">{c.title}</p>
                          <p className="text-xs text-stone-500">{c.detail}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5">
                <h2 className="font-serif text-xl mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Là où ça frotte
                </h2>
                {S.tensions.length === 0 && (
                  <p className="text-sm text-stone-400 italic">Aucune tension détectée — rare et précieux.</p>
                )}
                <ul className="space-y-3">
                  {S.tensions.map((t, i) => {
                    const TI = t.icon;
                    return (
                      <li key={i} className="flex gap-2.5 items-start">
                        <span className="w-7 h-7 rounded-lg bg-red-50 text-red-600 grid place-items-center shrink-0 mt-0.5">
                          <TI className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-800 leading-snug">{t.title}</p>
                          <p className="text-xs text-stone-500">{t.detail}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* heatmap critères × participants */}
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
              <h2 className="font-serif text-xl mb-1">Qui tient à quoi</h2>
              <p className="text-xs text-stone-500 mb-4">Chaque colonne est un participant, chaque ligne un critère.</p>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full border-separate" style={{ borderSpacing: "3px" }}>
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] uppercase tracking-widest text-stone-400 font-medium pb-1">Critère</th>
                      {participants.map((pt) => (
                        <th key={pt.id} className="pb-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <Avatar p={pt} size="sm" />
                            <span className="text-[9px] text-stone-500 max-w-[3.5rem] truncate">{pt.name}</span>
                          </div>
                        </th>
                      ))}
                      <th className="text-[10px] uppercase tracking-widest text-stone-400 font-medium pb-1">Accord</th>
                    </tr>
                  </thead>
                  <tbody>
                    {S.extras.map((e) => {
                      const EI = e.icon;
                      const badge =
                        e.spread === 0
                          ? { txt: "aligné", cls: "bg-emerald-50 text-emerald-700" }
                          : e.spread === 1
                            ? { txt: "mitigé", cls: "bg-amber-50 text-amber-700" }
                            : { txt: "tension", cls: "bg-red-50 text-red-600" };
                      return (
                        <tr key={e.id}>
                          <td className="pr-2">
                            <span className="inline-flex items-center gap-1.5 text-xs text-stone-700 whitespace-nowrap">
                              <EI className="w-3.5 h-3.5 text-stone-400" />
                              {e.label}
                            </span>
                          </td>
                          {participants.map((pt) => {
                            const st = pt.extras[e.id];
                            const cell =
                              st === "must"
                                ? { cls: "bg-orange-700 text-white", icon: Lock }
                                : st === "nice"
                                  ? { cls: "bg-amber-200 text-orange-900", icon: Heart }
                                  : { cls: "bg-stone-100 text-stone-400", icon: Minus };
                            const CI2 = cell.icon;
                            return (
                              <td key={pt.id}>
                                <div
                                  className={`h-8 min-w-[2.25rem] rounded-lg grid place-items-center ${cell.cls}`}
                                  title={`${pt.name} — ${e.label} : ${STANCES.find((s) => s.id === st).label}`}
                                >
                                  <CI2 className="w-3.5 h-3.5" />
                                </div>
                              </td>
                            );
                          })}
                          <td className="pl-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.cls}`}>
                              {badge.txt}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-stone-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-orange-700 grid place-items-center text-white"><Lock className="w-2.5 h-2.5" /></span>
                  Indispensable
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-amber-200 grid place-items-center text-orange-900"><Heart className="w-2.5 h-2.5" /></span>
                  Souhaité
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-stone-100 grid place-items-center text-stone-400"><Minus className="w-2.5 h-2.5" /></span>
                  Peu importe
                </span>
              </div>
            </div>

            {/* portrait-robot */}
            <div className="bg-stone-900 text-stone-100 rounded-3xl shadow-lg p-5 sm:p-7">
              <h2 className="font-serif text-xl text-white mb-1">Le portrait-robot du bien</h2>
              <p className="text-xs text-stone-400 mb-5">Le plus petit dénominateur qui satisfait tout le monde.</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  ["Type", S.typeLabel],
                  ["Budget", S.overlap ? `${fmtNum(S.lo)} – ${fmtNum(S.hi)} ${cfg.unit}` : "à renégocier"],
                  ["Où", S.commonLocs.length ? S.commonLocs.map((l) => l.label).join(", ") : S.listedCount === 0 ? "libre" : "à discuter"],
                  ["Surface", `≥ ${S.needSurface} m²`],
                  ["Pièces", `≥ ${S.needRooms}`],
                  ["Chambres", `≥ ${S.needBedrooms}`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] uppercase tracking-widest text-stone-400">{k}</dt>
                    <dd className="font-serif text-lg text-white leading-snug">{v}</dd>
                  </div>
                ))}
              </dl>
              {S.groupMusts.length > 0 && (
                <div className="mt-5 pt-4 border-t border-stone-700">
                  <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Indispensables du groupe</p>
                  <div className="flex flex-wrap gap-1.5">
                    {S.groupMusts.map((e) => (
                      <span key={e.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-700 text-white text-xs">
                        <Lock className="w-3 h-3" />
                        {e.label}
                        <span className="text-orange-200">· {e.musts.join(", ")}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* export + actions */}
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <h2 className="font-serif text-xl">Partager la synthèse</h2>
                  <p className="text-xs text-stone-500">Un résumé texte prêt à coller dans vos messages.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button" onClick={() => setShowExport((v) => !v)}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-600 hover:border-stone-400 hover:bg-stone-50 active:scale-95 transition"
                  >
                    {showExport ? "Masquer" : "Aperçu"}
                  </button>
                  <button
                    type="button" onClick={copy}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow active:scale-95 transition ${
                      copied ? "bg-emerald-600 text-white" : "bg-orange-700 text-white hover:bg-orange-800"
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copié !" : "Copier le résumé"}
                  </button>
                </div>
              </div>
              {showExport && (
                <pre className="tc-in mt-4 p-4 rounded-2xl bg-stone-100 border border-stone-200 text-xs text-stone-700 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {exportText}
                </pre>
              )}
            </div>

            <div className="flex justify-center">
              <button
                type="button" onClick={() => setStep("entry")}
                className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-orange-700 transition py-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Modifier les critères d'un participant
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-4 pb-8 text-center text-[10px] uppercase tracking-widest text-stone-400">
        Toit Commun — trouver un toit qui met tout le monde d'accord
      </footer>
    </div>
  );
}
