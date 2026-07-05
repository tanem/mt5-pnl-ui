interface Props {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
}

export default function StatTile({ label, value, tone = "neutral" }: Props) {
  return (
    <div className="rounded border p-3" data-tone={tone}>
      <div className="text-sm">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
