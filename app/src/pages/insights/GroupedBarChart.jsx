export default function GroupedBarChart({ labels, series, yMin = 0, yMax, yStep = 0.5 }) {
  const n = labels.length;
  const numSeries = series.length;

  const barW = 18;
  const barGap = 2;
  const groupGap = numSeries <= 2 ? 14 : 16;
  const groupW = numSeries * barW + (numSeries - 1) * barGap;

  const padL = 38;
  const padR = 8;
  const padT = 8;
  const padB = 26;

  const chartW = n * groupW + (n - 1) * groupGap;
  const chartH = 180;
  const svgW = padL + chartW + padR;
  const svgH = padT + chartH + padB;

  const yRange = yMax - yMin;
  const toY = (val) =>
    padT + chartH - ((Math.min(Math.max(val, yMin), yMax) - yMin) / yRange) * chartH;

  const ticks = [];
  for (let t = yMin; t <= yMax + yStep * 0.01; t += yStep) {
    ticks.push(parseFloat(t.toFixed(4)));
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        style={{ maxWidth: Math.max(svgW * 1.1, 480), minWidth: 360 }}
        role="img"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              y1={toY(t)}
              x2={padL + chartW}
              y2={toY(t)}
              style={{ stroke: "rgb(var(--surface-700))", strokeWidth: 0.5 }}
            />
            <text
              x={padL - 5}
              y={toY(t) + 3.5}
              textAnchor="end"
              style={{ fill: "rgb(var(--surface-400))", fontSize: 9 }}
            >
              {yStep < 0.5 ? t.toFixed(2) : t.toFixed(1)}
            </text>
          </g>
        ))}

        <line
          x1={padL}
          y1={toY(yMin)}
          x2={padL + chartW}
          y2={toY(yMin)}
          style={{ stroke: "rgb(var(--surface-500))", strokeWidth: 0.5 }}
        />

        {labels.map((label, i) => {
          const groupX = padL + i * (groupW + groupGap);
          return (
            <g key={label}>
              {series.map((s, si) => {
                const val = s.values[i];
                const x = groupX + si * (barW + barGap);
                const barH = Math.max(((Math.max(val, yMin) - yMin) / yRange) * chartH, 1);
                return (
                  <rect
                    key={s.name}
                    x={x}
                    y={toY(val)}
                    width={barW}
                    height={barH}
                    rx={2}
                    style={{ fill: s.color, fillOpacity: 0.7 }}
                  />
                );
              })}
              <text
                x={groupX + groupW / 2}
                y={toY(yMin) + 15}
                textAnchor="middle"
                style={{ fill: "rgb(var(--surface-400))", fontSize: 9 }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 mt-2 ml-10">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: s.color, opacity: 0.7 }} />
            <span className="text-xs text-surface-400">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
