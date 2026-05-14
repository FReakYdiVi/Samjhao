export function SamjhaoMark({
  className = "h-11 w-11",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="samjhao-shell" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB13B" />
          <stop offset="1" stopColor="#D88A00" />
        </linearGradient>
        <linearGradient id="samjhao-leaf" x1="16" y1="16" x2="45" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF4D9" />
          <stop offset="1" stopColor="#FFE5A8" />
        </linearGradient>
      </defs>

      <rect x="6" y="6" width="52" height="52" rx="18" fill="url(#samjhao-shell)" />
      <path
        d="M18 22.5C18 19.4624 20.4624 17 23.5 17H40.5C43.5376 17 46 19.4624 46 22.5V34.5C46 37.5376 43.5376 40 40.5 40H30.8L24.6 46.1C23.3252 47.3547 21.2 46.4518 21.2 44.664V40C19.4327 39.0778 18 37.2212 18 35.02V22.5Z"
        fill="url(#samjhao-leaf)"
      />
      <path
        d="M25 25.5H39M25 31H36M25 36.5H33"
        stroke="#B87300"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M45.5 18.5L47 15L48.5 18.5L52 20L48.5 21.5L47 25L45.5 21.5L42 20L45.5 18.5Z"
        fill="#FFF8E8"
      />
    </svg>
  );
}
