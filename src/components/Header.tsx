import { motion } from "framer-motion";
import type { Session } from "../types";

interface Props {
  sessions: Session[];
}

export default function Header({ sessions }: Props) {
  const totalMetres = sessions.reduce((n, s) => n + (s.total_distance || 0), 0);
  const totalHours = sessions.reduce((n, s) => n + (s.total_time_seconds || 0), 0) / 3600;
  const weeks = new Set(sessions.map((s) => `${s.term}-${s.week}`)).size;

  const stats = [
    { num: sessions.length.toString(), lbl: "Sessions" },
    { num: (totalMetres / 1000).toFixed(1), small: "km", lbl: "Total volume" },
    { num: Math.round(totalHours).toString(), small: "hrs", lbl: "Pool time" },
    { num: weeks.toString(), lbl: "Training weeks" },
  ];

  return (
    <header className="hero">
      <div className="container hero-inner">
        <div className="hero-top">
          <motion.div
            className="wave-badge"
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          >
            🌊
          </motion.div>
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.4 }}
          >
            <h1>Durham Swimming</h1>
            <p className="tagline">Training session library · AAA squad · 2025–26</p>
          </motion.div>
        </div>

        <div className="hero-stats">
          {stats.map((s, i) => (
            <motion.div
              className="stat-pill"
              key={s.lbl}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12 + i * 0.06, duration: 0.4 }}
            >
              <div className="num">
                {s.num}
                {s.small && <small> {s.small}</small>}
              </div>
              <div className="lbl">{s.lbl}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </header>
  );
}
