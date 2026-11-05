import { useState, useEffect } from "react";

const FIRST_MESSAGE = "Nice things take time :)";

// For pages that call the API and may take longer than expected.
export const WAKING_API = "Loading is taking longer than expected. Please wait.";

const MESSAGES = [
  "Crunching the numbers...",
  "Scouting 800+ players...",
  "Consulting the stats oracle...",
  "Analysing expected goals...",
  "Computing SHAP values...",
  "Checking the form table...",
  "Running the stacked ensemble...",
  "Scanning fixture difficulty...",
  "Predicting the unpredictable...",
  "Reviewing 10 seasons of data...",
  "Optimising your squad...",
];

function BouncingBall() {
  return (
    <div className="relative w-12 h-20 mx-auto mb-6">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-2 rounded-full bg-brand-700/20 animate-ball-shadow" />
      <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-brand-700 animate-ball-bounce">
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand-500/40" />
        </div>
      </div>
    </div>
  );
}

/**
 * @param slowMessage  Shown instead of the rotating lines once the wait passes
 *                     slowAfterMs, instead of continuing to cycle through
 *                     the loading messages.
 */
export default function Loading({ slowMessage = null, slowAfterMs = 6_000 }) {
  const [msg, setMsg] = useState(FIRST_MESSAGE);
  const [fade, setFade] = useState(true);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!slowMessage) return;
    const timer = setTimeout(() => setIsSlow(true), slowAfterMs);
    return () => clearTimeout(timer);
  }, [slowMessage, slowAfterMs]);

  useEffect(() => {
    // Once there is something true to say, stop cycling through guesses.
    if (isSlow) return;
    let i = -1;
    let timeout;
    const interval = setInterval(() => {
      setFade(false);
      timeout = setTimeout(() => {
        i = (i + 1) % MESSAGES.length;
        setMsg(MESSAGES[i]);
        setFade(true);
      }, 200);
    }, 2800);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isSlow]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <BouncingBall />
      <p
        role="status"
        aria-live="polite"
        className={`text-base text-surface-600 transition-opacity duration-200 ${
          isSlow || fade ? "opacity-100" : "opacity-0"
        }`}
      >
        {isSlow ? slowMessage : msg}
      </p>
    </div>
  );
}
