import { AnimatePresence, motion } from "framer-motion";
import type { Block, Session, SetItem } from "../types";
import { strokeLabel } from "../lib/filters";

const PHASE_COLORS: Record<string, string> = {
  Threshold: "#68246d",
  Endurance: "#0a7f9c",
  "Speed Development / Production": "#c2410c",
  "Competition Phase": "#b91c6b",
  "Critical Velocity": "#7c3aed",
  "Lactate Tolerance": "#be123c",
  "Lactate Production": "#be123c",
  Moderate: "#0d9488",
  "Post Comp & Correction": "#4b5563",
};

function accentFor(phase: string): string {
  return PHASE_COLORS[phase] || "#68246d";
}

function blockDistance(b: Block): number {
  return b.items.reduce((sum, it) => sum + (it.total_distance || 0), 0);
}

function SetRow({ it }: { it: SetItem }) {
  if (it.type === "free") {
    const lines = (it.info || "").split("\n");
    const first = lines.shift() || "";
    return (
      <tr className="row-free">
        <td colSpan={4}>
          <span className="free-label">{first}</span>
          {lines.join("\n")}
        </td>
      </tr>
    );
  }
  if (it.type === "note") {
    return (
      <tr className="row-note">
        <td colSpan={4}>
          {it.info}
          {it.interval ? ` · ${it.interval}` : ""}
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td className="set-reps">
        {it.reps} × {it.distance}
      </td>
      <td className="set-info">{it.info}</td>
      <td className="set-wr">{it.wr || ""}</td>
      <td className="set-int">{it.interval ? `on ${it.interval}` : ""}</td>
    </tr>
  );
}

interface Props {
  session: Session;
  open: boolean;
  onToggle: () => void;
}

export default function SessionCard({ session: s, open, onToggle }: Props) {
  const accent = accentFor(s.phase);
  const setCount = s.blocks.reduce(
    (n, b) => n + b.items.filter((i) => i.type === "set").length,
    0,
  );

  return (
    <motion.article
      layout
      className={"card" + (open ? " open" : "")}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="card-head" onClick={onToggle}>
        <div className="card-accent" style={{ background: accent }} />
        <div className="card-top">
          <div>
            <div className="card-date">{s.date_display}</div>
            <div className="card-day">
              {s.day_label}
              {s.time ? ` · ${s.time}` : ""}
            </div>
          </div>
          <div className="badges">
            {s.week != null && <span className="badge week">Week {s.week}</span>}
            <span className="badge term">{s.term}</span>
            {s.time_of_day && <span className="badge tod">{s.time_of_day}</span>}
          </div>
        </div>

        <span className="phase-pill" style={{ color: accent, background: `${accent}14` }}>
          {s.phase}
        </span>

        <div className="stats-row">
          <div className="stat-box">
            <div className="v">
              {(s.total_distance || 0).toLocaleString()} <small>m</small>
            </div>
            <div className="k">Distance</div>
          </div>
          <div className="stat-box">
            <div className="v">
              {s.duration_min || "–"} <small>min</small>
            </div>
            <div className="k">Duration</div>
          </div>
          <div className="stat-box">
            <div className="v">{setCount}</div>
            <div className="k">Sets</div>
          </div>
        </div>

        <div className="tag-row">
          {s.categories.map((c) => (
            <span className="tag focus" key={c}>
              {c}
            </span>
          ))}
          {s.strokes.map((c) => (
            <span className="tag stroke" key={c}>
              {strokeLabel(c)}
            </span>
          ))}
          {s.equipment.map((c) => (
            <span className="tag equip" key={c}>
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="card-toggle" onClick={onToggle}>
        {open ? "Hide session" : "View full session"}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          ▾
        </motion.span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="card-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="card-body-inner">
              {s.blocks.map((b, i) => {
                const bd = blockDistance(b);
                return (
                  <div className="block" key={i}>
                    <div className="block-head">
                      <div className="block-name">{b.name}</div>
                      {bd > 0 && <div className="block-dist">{bd.toLocaleString()} m</div>}
                    </div>
                    <table className="sets">
                      <tbody>
                        {b.items.map((it, j) => (
                          <SetRow it={it} key={j} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {s.quote && <div className="quote">“{s.quote}”</div>}
              <div className="source-note">Source: {s.source_files.join(", ")}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
