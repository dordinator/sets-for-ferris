export type ItemType = "set" | "note" | "free";

export interface SetItem {
  type: ItemType;
  reps: number | null;
  distance: number | null;
  info: string | null;
  wr: string | null;
  interval: string | null;
  rounds: number | null;
  total_time: string | null;
  total_distance: number | null;
  strokes: string[];
}

export interface Block {
  name: string;
  zone: string | null;
  items: SetItem[];
}

export interface Session {
  id: string;
  squad: string;
  week: number | null;
  date_iso: string;
  date_display: string;
  day_label: string;
  day_of_week: string;
  time_of_day: string | null;
  time: string | null;
  phase: string;
  term: string;
  source_files: string[];
  total_time: string | null;
  total_distance: number | null;
  summed_distance: number;
  total_time_seconds: number | null;
  duration_min: number | null;
  quote?: string | null;
  strokes: string[];
  stroke_names: string[];
  equipment: string[];
  zones: string[];
  categories: string[];
  blocks: Block[];
}

export interface Dataset {
  generated_from: string[];
  session_count: number;
  sessions: Session[];
}
