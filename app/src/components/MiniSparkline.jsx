export default function MiniSparkline({ pts, width = 56, height = 20 }) {
  if (!pts || pts.length === 0) return null;
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;
  const step = width / (pts.length - 1);
  const points = pts.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const trend = pts[pts.length - 1] >= pts[0];
  const color = trend ? "rgb(var(--success-400))" : "rgb(var(--danger-400))";
  const lastX = (pts.length - 1) * step;
  const lastY = height - ((pts[pts.length - 1] - min) / range) * (height - 4) - 2;

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}
