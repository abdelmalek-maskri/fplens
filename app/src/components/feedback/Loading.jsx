import { useState, useEffect } from "react";

const FIRST_MESSAGE = "Nice things take time :)";

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
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-2 rounded-full bg-brand-400/20 animate-ball-shadow" />
      <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-brand-400 animate-ball-bounce">
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand-300/40" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  const [msg, setMsg] = useState(FIRST_MESSAGE);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        i = (i + 1) % MESSAGES.length;
        setMsg(MESSAGES[i]);
        setFade(true);
      }, 200);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <BouncingBall />
      <p
        className={`text-base text-surface-400 transition-opacity duration-200 ${fade ? "opacity-100" : "opacity-0"}`}
      >
        {msg}
      </p>
    </div>
  );
}
