import { Link } from "react-router-dom";

/**
 * A player's name, as a real link to their page.
 *
 * These were spans and paragraphs carrying onClick, so a keyboard user could
 * not reach any of them and a screen reader announced plain text. A link also
 * brings middle-click, open-in-new-tab and the status bar preview, none of
 * which a click handler can offer.
 *
 * stopPropagation is for the names inside a row that is itself clickable.
 */
export default function PlayerLink({ element, className = "", stopPropagation = false, children }) {
  return (
    <Link
      to={`/player/${element}`}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={`hover:text-brand-700 transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}
