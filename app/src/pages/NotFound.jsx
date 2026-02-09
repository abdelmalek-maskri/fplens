import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card p-8 max-w-md text-center space-y-4">
        <p className="text-6xl font-black text-surface-700">404</p>
        <h2 className="text-lg font-bold text-surface-100">Page not found</h2>
        <p className="text-sm text-surface-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="btn-primary inline-flex">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
