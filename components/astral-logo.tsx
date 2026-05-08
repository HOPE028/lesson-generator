export function AstralLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="200"
      viewBox="0 0 200 200"
      width="200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6"
      >
        <path d="M 100 24 C 132 24 154 48 154 80 C 154 102 142 116 132 128 C 126 134 124 140 124 148 L 76 148 C 76 140 74 134 68 128 C 58 116 46 102 46 80 C 46 48 68 24 100 24 Z" />
        <path d="M 78 158 L 122 158" />
        <path d="M 82 168 L 118 168" />
        <path d="M 88 178 L 112 178" />
      </g>
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      >
        <path d="M 76 78 L 98 60 L 128 76 L 112 108 Z" />
        <path d="M 98 60 L 112 108" />
      </g>
      <g fill="currentColor">
        <circle cx="76" cy="78" r="4" />
        <circle cx="98" cy="60" r="5" />
        <circle cx="128" cy="76" r="4" />
        <circle cx="112" cy="108" r="4" />
      </g>
    </svg>
  );
}
