interface ChipEntry {
  value: string;
  label: string;
  count: number;
}

interface Props {
  label: string;
  entries: ChipEntry[];
  selected: string[];
  onToggle: (value: string) => void;
}

export default function ChipGroup({ label, entries, selected, onToggle }: Props) {
  if (!entries.length) return null;
  return (
    <div className="field">
      <label>{label}</label>
      <div className="chips">
        {entries.map((e) => (
          <button
            key={e.value}
            type="button"
            className={"chip" + (selected.includes(e.value) ? " active" : "")}
            onClick={() => onToggle(e.value)}
          >
            {e.label}
            <span className="count">{e.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
