import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-5xl font-black text-surface-700 font-data tabular-nums">404</p>
        <p className="text-sm text-surface-400">Page not found</p>
        <Link to="/" className="btn-ghost link-action text-sm inline-flex">
          ← Dashboard
        </Link>
      </div>
    </div>
  );
}
