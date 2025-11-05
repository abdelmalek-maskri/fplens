export default function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="my-4 rounded-md bg-red-500/10 border border-red-400/40 text-red-200 p-3">
      <strong className="mr-2">Error:</strong>{message}
    </div>
  );
}
