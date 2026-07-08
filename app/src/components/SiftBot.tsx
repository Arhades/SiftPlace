// "Sift" the robot — the chatbot's humanoid avatar: a cute rounded robot with
// an antenna bulb, arms and feet. Its face screen shows the SiftPlace house
// logo for now (placeholder face until the character gets its own art), so the
// bot and the brand read as one family. Palette matches siftplace-logo.svg.
export function SiftBot({ size = 64 }: { size?: number }) {
  const width = Math.round(size * (96 / 128));
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 96 128"
      role="img"
      aria-label="Sift, the SiftPlace robot"
    >
      {/* ground shadow */}
      <ellipse cx="48" cy="123" rx="26" ry="4" fill="rgba(39,43,99,0.18)" />

      {/* antenna + bulb */}
      <rect x="45" y="12" width="6" height="10" fill="#272b63" />
      <circle cx="48" cy="9" r="7" fill="#272b63" />
      <circle cx="48" cy="9" r="4.5" fill="#f7d84e" />

      {/* ears */}
      <rect x="10" y="36" width="10" height="18" rx="4" fill="#272b63" />
      <rect x="76" y="36" width="10" height="18" rx="4" fill="#272b63" />
      <rect x="12.5" y="39" width="5" height="12" rx="2" fill="#8d97f0" />
      <rect x="78.5" y="39" width="5" height="12" rx="2" fill="#8d97f0" />

      {/* head with the logo as its face */}
      <rect x="16" y="20" width="64" height="50" rx="15" fill="#272b63" />
      <rect x="20" y="24" width="56" height="42" rx="11" fill="#f6f7ff" />
      <image href="/siftplace-logo.svg" x="28" y="26" width="40" height="38" />

      {/* neck */}
      <rect x="42" y="68" width="12" height="6" fill="#272b63" />

      {/* arms */}
      <rect x="8" y="76" width="14" height="28" rx="7" fill="#272b63" />
      <rect x="74" y="76" width="14" height="28" rx="7" fill="#272b63" />
      <rect x="11" y="79" width="8" height="22" rx="4" fill="#8d97f0" />
      <rect x="77" y="79" width="8" height="22" rx="4" fill="#8d97f0" />

      {/* body with chest screen + yellow heart-light */}
      <rect x="22" y="72" width="52" height="40" rx="13" fill="#272b63" />
      <rect x="26" y="76" width="44" height="32" rx="9" fill="#5560e8" />
      <rect x="36" y="82" width="24" height="16" rx="5" fill="#dfe3fb" />
      <circle cx="48" cy="90" r="4" fill="#f7d84e" />

      {/* feet */}
      <rect x="30" y="108" width="14" height="14" rx="5" fill="#272b63" />
      <rect x="52" y="108" width="14" height="14" rx="5" fill="#272b63" />
      <rect x="33" y="111" width="8" height="8" rx="3" fill="#5560e8" />
      <rect x="55" y="111" width="8" height="8" rx="3" fill="#5560e8" />
    </svg>
  );
}
