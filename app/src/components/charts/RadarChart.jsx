const RADAR_METRICS = [
  { key: "predicted_points", label: "Predicted" },
  { key: "form", label: "Form" },
  { key: "total_points", label: "Total Pts" },
  { key: "xG", label: "xG" },
  { key: "xA", label: "xA" },
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "ict_index", label: "ICT" },
];

function percentile(value, key, pool) {
  const sorted = pool.map((p) => p[key]).sort((a, b) => a - b);
  const rank = sorted.filter((v) => v <= value).length;
  return (rank / sorted.length) * 100;
}

function polarToXY(cx, cy, radius, angleIndex, totalAxes) {
  const angle = (Math.PI * 2 * angleIndex) / totalAxes - Math.PI / 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

export default function RadarChart({ playerA, playerB, allPlayers, metrics = RADAR_METRICS }) {
  const cx = 150;
  const cy = 150;
  const radius = 120;
  const totalAxes = metrics.length;

  const valsA = metrics.map((m) => percentile(playerA[m.key], m.key, allPlayers));
  const valsB = metrics.map((m) => percentile(playerB[m.key], m.key, allPlayers));

  const buildPolygon = (vals) =>
    vals
      .map((v, i) => {
        const r = (v / 100) * radius;
        const { x, y } = polarToXY(cx, cy, r, i, totalAxes);
        return `${x},${y}`;
      })
      .join(" ");

  const rings = [0.33, 0.66, 1];

  const ringPolygon = (pct) =>
    Array.from({ length: totalAxes }, (_, i) => {
      const { x, y } = polarToXY(cx, cy, radius * pct, i, totalAxes);
      return `${x},${y}`;
    }).join(" ");

  const labelOffset = 18;

  return (
    <svg
      viewBox="0 0 300 300"
      className="w-full max-w-[300px] mx-auto"
      role="img"
      aria-label="Radar chart comparing two players"
    >
      {rings.map((pct) => (
        <polygon
          key={pct}
          points={ringPolygon(pct)}
          className="stroke-surface-700 fill-none"
          strokeWidth={1}
        />
      ))}

      {metrics.map((_, i) => {
        const { x, y } = polarToXY(cx, cy, radius, i, totalAxes);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            className="stroke-surface-800"
            strokeWidth={1}
          />
        );
      })}

      <polygon
        points={buildPolygon(valsA)}
        fill="rgb(var(--brand-400))"
        fillOpacity={0.2}
        stroke="rgb(var(--brand-400))"
        strokeWidth={2}
      />

      <polygon
        points={buildPolygon(valsB)}
        fill="rgb(var(--info-400))"
        fillOpacity={0.2}
        stroke="rgb(var(--info-400))"
        strokeWidth={2}
      />

      {valsA.map((v, i) => {
        const r = (v / 100) * radius;
        const { x, y } = polarToXY(cx, cy, r, i, totalAxes);
        return <circle key={`a-${i}`} cx={x} cy={y} r={3} fill="rgb(var(--brand-400))" />;
      })}

      {valsB.map((v, i) => {
        const r = (v / 100) * radius;
        const { x, y } = polarToXY(cx, cy, r, i, totalAxes);
        return <circle key={`b-${i}`} cx={x} cy={y} r={3} fill="rgb(var(--info-400))" />;
      })}

      {metrics.map((m, i) => {
        const { x, y } = polarToXY(cx, cy, radius + labelOffset, i, totalAxes);
        return (
          <text
            key={m.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-2xs fill-surface-500 font-data tabular-nums"
            style={{ fontSize: "10px" }}
          >
            {m.label}
          </text>
        );
      })}
    </svg>
  );
}
