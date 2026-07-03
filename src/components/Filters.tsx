import { useMemo } from "react";
import type { Session } from "../types";
import { FOCUS_ORDER } from "../data";
import {
  countBy,
  emptyFilters,
  strokeLabel,
  todLabel,
  type FilterState,
} from "../lib/filters";
import ChipGroup from "./ChipGroup";

interface Props {
  sessions: Session[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  mobileOpen: boolean;
}

type Key = "focus" | "phase" | "term" | "stroke" | "equipment" | "tod";

export default function Filters({ sessions, filters, setFilters, mobileOpen }: Props) {
  const entries = useMemo(() => {
    const build = (
      counts: Map<string, number>,
      order?: string[],
      labeler?: (v: string) => string,
    ) => {
      const arr = Array.from(counts.entries()).map(([value, count]) => ({
        value,
        count,
        label: labeler ? labeler(value) : value,
      }));
      if (order) {
        arr.sort((a, b) => {
          const ia = order.indexOf(a.value);
          const ib = order.indexOf(b.value);
          if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          return b.count - a.count;
        });
      } else {
        arr.sort((a, b) => b.count - a.count);
      }
      return arr;
    };
    return {
      focus: build(countBy(sessions, (s) => s.categories), FOCUS_ORDER),
      phase: build(countBy(sessions, (s) => s.phase)),
      term: build(countBy(sessions, (s) => s.term)),
      stroke: build(countBy(sessions, (s) => s.strokes), undefined, strokeLabel),
      equipment: build(countBy(sessions, (s) => s.equipment)),
      tod: build(countBy(sessions, (s) => todLabel(s))),
    };
  }, [sessions]);

  const toggle = (key: Key, value: string) => {
    setFilters((f) => {
      const set = new Set(f[key]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...f, [key]: Array.from(set) };
    });
  };

  const setNum = (key: keyof FilterState, raw: string) => {
    const v = raw === "" ? null : Number(raw);
    setFilters((f) => ({ ...f, [key]: Number.isNaN(v as number) ? null : v }));
  };

  const activeCount =
    filters.focus.length +
    filters.phase.length +
    filters.term.length +
    filters.stroke.length +
    filters.equipment.length +
    filters.tod.length +
    (filters.search ? 1 : 0) +
    [filters.distMin, filters.distMax, filters.durMin, filters.durMax].filter(
      (v) => v != null,
    ).length;

  return (
    <aside className={"filters" + (mobileOpen ? " open" : "")}>
      <div className="filters-head">
        <h2>Filters{activeCount ? ` · ${activeCount}` : ""}</h2>
        <button
          className="link-btn"
          type="button"
          onClick={() => setFilters({ ...emptyFilters, sort: filters.sort })}
        >
          Clear all
        </button>
      </div>

      <div className="field">
        <label>Search</label>
        <div className="search-box">
          <span className="icon">⌕</span>
          <input
            type="search"
            value={filters.search}
            placeholder="FLY sprint, dive starts, IM…"
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
      </div>

      <ChipGroup label="Session focus" entries={entries.focus} selected={filters.focus} onToggle={(v) => toggle("focus", v)} />
      <ChipGroup label="Phase" entries={entries.phase} selected={filters.phase} onToggle={(v) => toggle("phase", v)} />
      <ChipGroup label="Term" entries={entries.term} selected={filters.term} onToggle={(v) => toggle("term", v)} />
      <ChipGroup label="Stroke emphasis" entries={entries.stroke} selected={filters.stroke} onToggle={(v) => toggle("stroke", v)} />
      <ChipGroup label="Equipment" entries={entries.equipment} selected={filters.equipment} onToggle={(v) => toggle("equipment", v)} />
      <ChipGroup label="Time of day" entries={entries.tod} selected={filters.tod} onToggle={(v) => toggle("tod", v)} />

      <div className="field">
        <label>Total distance (m)</label>
        <div className="range-row">
          <input type="number" min={0} step={100} placeholder="min" value={filters.distMin ?? ""} onChange={(e) => setNum("distMin", e.target.value)} />
          <span>–</span>
          <input type="number" min={0} step={100} placeholder="max" value={filters.distMax ?? ""} onChange={(e) => setNum("distMax", e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Duration (min)</label>
        <div className="range-row">
          <input type="number" min={0} step={5} placeholder="min" value={filters.durMin ?? ""} onChange={(e) => setNum("durMin", e.target.value)} />
          <span>–</span>
          <input type="number" min={0} step={5} placeholder="max" value={filters.durMax ?? ""} onChange={(e) => setNum("durMax", e.target.value)} />
        </div>
      </div>
    </aside>
  );
}
