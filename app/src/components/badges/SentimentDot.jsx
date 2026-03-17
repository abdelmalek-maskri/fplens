export default function SentimentDot({ value, className = "" }) {
  const color = value >= 0.5 ? "bg-success-400" : value >= 0 ? "bg-surface-400" : "bg-danger-400";
  return <div className={`w-2 h-2 rounded-full ${color} ${className}`} />;
}
