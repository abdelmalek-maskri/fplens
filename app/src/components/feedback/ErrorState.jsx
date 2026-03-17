export default function ErrorState({ message = "Something went wrong", onRetry }) {
  return (
    <div className="py-12 text-center">
      <p className="text-danger-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-1.5 text-sm font-medium rounded bg-surface-800 text-surface-300 hover:text-surface-100 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
