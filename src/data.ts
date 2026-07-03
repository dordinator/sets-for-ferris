import raw from "./data/sessions.json";
import type { Dataset, Session } from "./types";

export const dataset = raw as unknown as Dataset;
export const sessions: Session[] = dataset.sessions;

export const STROKE_LABELS: Record<string, string> = {
  FS: "Freestyle",
  BK: "Backstroke",
  BR: "Breaststroke",
  FLY: "Butterfly",
  IM: "Individual Medley",
};

export const FOCUS_ORDER = [
  "Sprint",
  "Pure sprint",
  "Distance",
  "Long-distance free",
  "IM",
];
