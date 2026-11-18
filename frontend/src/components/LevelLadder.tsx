import type { Level } from "@/lib/fibonacci";

/** Vertical price ladder: every level on one scale with the spot marker. No candles are drawn here. */
export function LevelLadder({ levels, spot }: { levels: Level[]; spot: string | null }) {
  const prices = levels.map((l) => Number(l.price)).concat(spot ? [Number(spot)] : []);
  const max = Math.max(...prices), min = Math.min(...prices);
  const H = 420, pad = 12;
  const y = (p: number) => pad + ((max - p) / (max - min || 1)) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 180 ${H}`} className="h-[420px] w-full" role="img" aria-label="Fibonacci level ladder">
      {levels.map((l) => {
        const yy = y(Number(l.price));
        const ext = l.kind === "extension";
        return (
          <g key={l.kind + l.label}>
            <line x1="4" x2="100" y1={yy} y2={yy} stroke="var(--accent)" strokeOpacity={ext ? 0.45 : 0.9} strokeDasharray={ext ? "4 3" : undefined} />
            <text x="104" y={yy + 3} fontSize="9" fill="var(--muted)" className="num">{l.label} {l.price}</text>
          </g>
        );
      })}
      {spot && (
        <g>
          <line x1="4" x2="100" y1={y(Number(spot))} y2={y(Number(spot))} stroke="var(--text)" strokeWidth="2" />
          <text x="104" y={y(Number(spot)) + 3} fontSize="9" fontWeight="700" fill="var(--text)">Spot {spot}</text>
        </g>
      )}
    </svg>
  );
}
