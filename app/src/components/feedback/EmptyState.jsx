export default function EmptyState({ title, message }) {
  return (
    <div className="py-12 text-center">
      <p className="text-surface-400">{title}</p>
      {message && <p className="text-xs text-surface-500 mt-1">{message}</p>}
    </div>
  );
}
