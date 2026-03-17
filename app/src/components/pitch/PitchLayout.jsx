export default function PitchLayout({ id = "pitch", children }) {
  const patternId = `grass-${id}`;
  const filterId = `grassNoise-${id}`;

  return (
    <div className="relative overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <pattern id={patternId} width="100%" height="90" patternUnits="userSpaceOnUse">
            <rect width="100%" height="45" fill="#1b7a35" />
            <rect y="45" width="100%" height="45" fill="#1a7030" />
          </pattern>
          <filter id={filterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        <rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
          opacity="0.3"
          filter={`url(#${filterId})`}
        />
      </svg>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-[16px] border-2 border-white/20 rounded-[3px]" />
        <div className="absolute left-[16px] right-[16px] top-1/2 h-[2px] bg-white/20" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full border-2 border-white/20" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/25" />
        <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-[220px] h-[65px] border-b-2 border-l-2 border-r-2 border-white/15 rounded-b-[2px]" />
        <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] border-b-2 border-l-2 border-r-2 border-white/12 rounded-b-[2px]" />
        <div className="absolute top-[68px] left-1/2 -translate-x-1/2 w-[70px] h-[35px] border-b-2 border-white/10 rounded-b-full" />
        <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 w-[220px] h-[65px] border-t-2 border-l-2 border-r-2 border-white/15 rounded-t-[2px]" />
        <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] border-t-2 border-l-2 border-r-2 border-white/12 rounded-t-[2px]" />
        <div className="absolute bottom-[68px] left-1/2 -translate-x-1/2 w-[70px] h-[35px] border-t-2 border-white/10 rounded-t-full" />
        <div className="absolute top-[16px] left-[16px] w-5 h-5 border-r-2 border-b-2 border-white/10 rounded-br-full" />
        <div className="absolute top-[16px] right-[16px] w-5 h-5 border-l-2 border-b-2 border-white/10 rounded-bl-full" />
        <div className="absolute bottom-[16px] left-[16px] w-5 h-5 border-r-2 border-t-2 border-white/10 rounded-tr-full" />
        <div className="absolute bottom-[16px] right-[16px] w-5 h-5 border-l-2 border-t-2 border-white/10 rounded-tl-full" />
      </div>

      {children}
    </div>
  );
}
