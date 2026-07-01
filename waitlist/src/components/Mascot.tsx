// SiftPlace "Solar Friend" mascot — the little sun character from the prototype.
// Rendered as inline SVG so it inherits crisp scaling at any size.
export function Mascot({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <ellipse cx="24" cy="30" rx="14" ry="13" fill="#ffd24a" />
      <circle cx="24" cy="17" r="11" fill="#ffdf6b" />
      <circle cx="20" cy="16" r="2" fill="#3a2a00" />
      <circle cx="28" cy="16" r="2" fill="#3a2a00" />
      <path d="M22 20 l2 2 l2 -2 z" fill="#fe6f42" />
      <path d="M14 9 l5 4 M34 9 l-5 4" stroke="#e0a800" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
