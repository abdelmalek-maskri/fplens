/**
 * Article list skeleton for NewsSentiment.
 * @param {number} count  Number of article placeholders (default 5)
 */
export default function SkeletonArticle({ count = 5 }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="py-3 border-b border-surface-800/60 last:border-0">
          <div className="flex items-start gap-3">
            <div className="skeleton w-2 h-2 !rounded-full mt-1.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-4/5" />
              <div className="skeleton h-3 w-3/5" />
              <div className="flex items-center gap-3">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-3 w-12" />
                <div className="skeleton h-3 w-8" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
