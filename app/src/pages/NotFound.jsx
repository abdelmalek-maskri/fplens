import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-5xl font-black text-surface-800 font-data tabular-nums">404</p>
        <p className="text-sm text-surface-400">Page not found</p>
        <Link to="/" className="btn-ghost text-sm inline-flex text-brand-400 hover:text-brand-300">
          ← Dashboard
        </Link>
      </div>
    </div>
  );
}
