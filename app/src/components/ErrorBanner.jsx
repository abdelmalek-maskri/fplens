export default function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="my-4 rounded-md bg-danger-500/10 border border-danger-500/30 text-danger-300 p-3">
      <strong className="mr-2">Error:</strong>{message}
    </div>
  );
}
