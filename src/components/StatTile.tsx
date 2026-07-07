interface Props {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
}

export default function StatTile({ label, value, tone = "neutral" }: Props) {
  return (
    <div
      className="stat-tile rounded-md border border-border bg-surface py-2.5 pr-3 pl-3"
      data-tone={tone}
    >
      <div className="text-xs tracking-wide text-muted uppercase">{label}</div>
      <div className="stat-value mt-1 font-mono text-lg font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

/** Sign → tile tone: positive pos, negative neg, zero neutral. */
export function tone(v: number): "pos" | "neg" | "neutral" {
  return v > 0 ? "pos" : v < 0 ? "neg" : "neutral";
}
