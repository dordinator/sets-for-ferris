import type { Session } from "../types";
import { STROKE_LABELS } from "../data";

export type SortKey =
  | "date-asc"
  | "date-desc"
  | "dist-desc"
  | "dist-asc"
  | "dur-desc"
  | "dur-asc";

export interface FilterState {
  search: string;
  focus: string[];
  phase: string[];
  term: string[];
  stroke: string[];
  equipment: string[];
  tod: string[];
  distMin: number | null;
  distMax: number | null;
  durMin: number | null;
  durMax: number | null;
  sort: SortKey;
}

export const emptyFilters: FilterState = {
  search: "",
  focus: [],
  phase: [],
  term: [],
  stroke: [],
  equipment: [],
  tod: [],
  distMin: null,
  distMax: null,
  durMin: null,
  durMax: null,
  sort: "date-asc",
};

export const todLabel = (s: Session): string => s.time_of_day || "Evening/Full";

const textCache = new WeakMap<Session, string>();
function sessionText(s: Session): string {
  const cached = textCache.get(s);
  if (cached) return cached;
  const parts: string[] = [
    s.phase,
    s.day_label,
    s.term,
    s.date_display,
    ...s.categories,
    ...s.stroke_names,
    ...s.equipment,
  ];
  for (const b of s.blocks) {
    parts.push(b.name);
    for (const it of b.items) if (it.info) parts.push(it.info);
  }
  const txt = parts.join(" ").toLowerCase();
  textCache.set(s, txt);
  return txt;
}

export function matches(s: Session, f: FilterState): boolean {
  if (f.search) {
    const terms = f.search.toLowerCase().split(/\s+/).filter(Boolean);
    const txt = sessionText(s);
    if (!terms.every((t) => txt.includes(t))) return false;
  }
  if (f.focus.length && !s.categories.some((c) => f.focus.includes(c))) return false;
  if (f.phase.length && !f.phase.includes(s.phase)) return false;
  if (f.term.length && !f.term.includes(s.term)) return false;
  if (f.stroke.length && !s.strokes.some((c) => f.stroke.includes(c))) return false;
  if (f.equipment.length && !s.equipment.some((c) => f.equipment.includes(c))) return false;
  if (f.tod.length && !f.tod.includes(todLabel(s))) return false;

  const dist = s.total_distance || 0;
  if (f.distMin != null && dist < f.distMin) return false;
  if (f.distMax != null && dist > f.distMax) return false;

  const dur = s.duration_min || 0;
  if (f.durMin != null && dur < f.durMin) return false;
  if (f.durMax != null && dur > f.durMax) return false;

  return true;
}

const todRank = (s: Session) => (s.time_of_day === "PM" ? 1 : 0);

export function sortSessions(list: Session[], sort: SortKey): Session[] {
  const arr = list.slice();
  switch (sort) {
    case "date-asc":
      return arr.sort((a, b) => a.date_iso.localeCompare(b.date_iso) || todRank(a) - todRank(b));
    case "date-desc":
      return arr.sort((a, b) => b.date_iso.localeCompare(a.date_iso) || todRank(b) - todRank(a));
    case "dist-desc":
      return arr.sort((a, b) => (b.total_distance || 0) - (a.total_distance || 0));
    case "dist-asc":
      return arr.sort((a, b) => (a.total_distance || 0) - (b.total_distance || 0));
    case "dur-desc":
      return arr.sort((a, b) => (b.duration_min || 0) - (a.duration_min || 0));
    case "dur-asc":
      return arr.sort((a, b) => (a.duration_min || 0) - (b.duration_min || 0));
    default:
      return arr;
  }
}

export function countBy(
  sessions: Session[],
  getter: (s: Session) => string | string[] | null,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const v = getter(s);
    const vals = Array.isArray(v) ? v : [v];
    for (const val of vals) {
      if (val == null || val === "") continue;
      counts.set(val, (counts.get(val) || 0) + 1);
    }
  }
  return counts;
}

export const strokeLabel = (code: string) => STROKE_LABELS[code] || code;
