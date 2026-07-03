import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { sessions as allSessions, dataset } from "./data";
import {
  emptyFilters,
  matches,
  sortSessions,
  type FilterState,
  type SortKey,
} from "./lib/filters";
import Header from "./components/Header";
import Filters from "./components/Filters";
import SessionCard from "./components/SessionCard";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-asc", label: "Date (earliest)" },
  { value: "date-desc", label: "Date (latest)" },
  { value: "dist-desc", label: "Distance (high → low)" },
  { value: "dist-asc", label: "Distance (low → high)" },
  { value: "dur-desc", label: "Duration (long → short)" },
  { value: "dur-asc", label: "Duration (short → long)" },
];

export default function App() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [openId, setOpenId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);

  const filtered = useMemo(() => {
    const list = allSessions.filter((s) => matches(s, filters));
    return sortSessions(list, filters.sort);
  }, [filters]);

  const activeFilterCount =
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

  useEffect(() => {
    document.body.classList.toggle("no-scroll", mobileFilters);
    return () => document.body.classList.remove("no-scroll");
  }, [mobileFilters]);

  const toggleCard = (id: string) => {
    if (allOpen) {
      // switch out of "expand all" mode, collapsing everything except toggled
      setAllOpen(false);
      setOpenId((prev) => (prev === id ? null : id));
      return;
    }
    setOpenId((prev) => (prev === id ? null : id));
  };

  const isOpen = (id: string) => allOpen || openId === id;

  return (
    <div className="app-shell">
      <Header sessions={allSessions} />

      <div className="container">
        <div className="layout">
          <div
            className={"filters-backdrop" + (mobileFilters ? " show" : "")}
            onClick={() => setMobileFilters(false)}
          />
          <Filters
            sessions={allSessions}
            filters={filters}
            setFilters={setFilters}
            mobileOpen={mobileFilters}
            resultCount={filtered.length}
            onClose={() => setMobileFilters(false)}
          />

          <section className="results">
            <div className="results-bar">
              <div className="results-count">
                {filtered.length} session{filtered.length === 1 ? "" : "s"}{" "}
                <span className="muted">of {allSessions.length}</span>
              </div>
              <div className="results-actions">
                <label htmlFor="sort">Sort</label>
                <select
                  id="sort"
                  className="select"
                  value={filters.sort}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, sort: e.target.value as SortKey }))
                  }
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => {
                    setAllOpen((v) => !v);
                    setOpenId(null);
                  }}
                >
                  {allOpen ? "Collapse all" : "Expand all"}
                </button>
              </div>
            </div>

            <div className="cards">
              <AnimatePresence mode="popLayout">
                {filtered.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    open={isOpen(s.id)}
                    onToggle={() => toggleCard(s.id)}
                  />
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <div className="empty">No sessions match these filters.</div>
              )}
            </div>
          </section>
        </div>
      </div>

      <footer className="site-footer">
        <div className="container">
          Extracted from {dataset.generated_from.length} coach PDF exports · duplicate
          sessions merged automatically · {allSessions.length} unique sessions. Built for
          the Durham University swimming squad, 2025–26.
        </div>
      </footer>

      {!mobileFilters && (
        <button
          className="filters-toggle"
          type="button"
          onClick={() => setMobileFilters(true)}
        >
          <span>⚙ Filters</span>
          {activeFilterCount > 0 && <span className="fab-count">{activeFilterCount}</span>}
        </button>
      )}
    </div>
  );
}
