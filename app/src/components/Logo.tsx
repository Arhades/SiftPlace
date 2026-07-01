// SiftPlace brand mark — the pixel-art house logo (siftplace_logo.jpg).
// Shown on a white rounded tile so the logo's own white background blends
// cleanly and it stays crisp in both light and dark themes.
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl bg-white border border-line overflow-hidden shrink-0"
      style={{ width: size, height: size }}
    >
      <img
        src="/siftplace_logo.jpg"
        alt="SiftPlace"
        className="h-full w-full object-contain p-0.5"
      />
    </span>
  );
}
