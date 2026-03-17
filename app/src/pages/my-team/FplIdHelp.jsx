const FplIdHelp = () => (
  <details className="text-surface-400">
    <summary className="cursor-pointer text-sm text-surface-400 hover:text-surface-200 transition-colors">
      How to find your FPL ID
    </summary>
    <div className="mt-3 space-y-0 text-sm text-surface-400">
      <div className="border-l-2 border-surface-700 pl-3 py-2.5">
        <p className="text-surface-200 font-medium mb-2">Website</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Log in at <span className="font-mono text-surface-300">fantasy.premierleague.com</span>
          </li>
          <li>
            Click <span className="text-surface-200">Points</span> or{" "}
            <span className="text-surface-200">My Team</span>
          </li>
          <li>
            Copy the number after <span className="font-mono text-brand-400">/entry/</span> in the
            URL
          </li>
        </ol>
        <div className="mt-2.5 bg-surface-800 rounded px-3 py-2 font-mono text-xs text-surface-500 inline-block">
          fantasy.premierleague.com/entry/
          <span className="text-brand-400 font-semibold">1234567</span>/event/20
        </div>
      </div>
      <div className="border-l-2 border-surface-700 pl-3 py-2.5">
        <p className="text-surface-200 font-medium mb-2">Mobile App</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Open the FPL app → <span className="text-surface-200">Points</span> tab
          </li>
          <li>
            Tap <span className="text-surface-200">⋯</span> (top-right) →{" "}
            <span className="text-surface-200">Share Team Link</span>
          </li>
          <li>The number in the shared link is your ID</li>
        </ol>
      </div>
    </div>
  </details>
);

export default FplIdHelp;
