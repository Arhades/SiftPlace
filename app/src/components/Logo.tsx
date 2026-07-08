// SiftPlace brand mark — the blue pixel-house mascot as a crisp vector
// (public/siftplace-logo.svg, the single source of truth for the logo; the
// PWA/favicon PNGs are generated from it via scripts/generate-icons.mjs).
// Kept on a white rounded tile so it reads cleanly in both themes.
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl bg-white border border-line overflow-hidden shrink-0"
      style={{ width: size, height: size }}
    >
      <img
        src="/siftplace-logo.svg"
        alt="SiftPlace"
        className="h-full w-full object-contain p-0.5"
      />
    </span>
  );
}
