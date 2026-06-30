import type { ListingResult } from "@/lib/api";
import { ResultCard } from "./ResultCard";

export function Saved({
  results,
  saved,
  onToggleSave,
}: {
  results: ListingResult[];
  saved: Set<string>;
  onToggleSave: (name: string) => void;
}) {
  const items = results.filter((r) => saved.has(r.name));

  if (items.length === 0) {
    return (
      <div className="text-center py-20 px-6 animate-sift-fade">
        <div className="text-5xl mb-4">💛</div>
        <h3 className="text-lg font-semibold text-white mb-1">No saved places yet</h3>
        <p className="text-sm text-white/40 max-w-xs mx-auto">
          Tap the heart on any match and it'll wait for you here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((r, i) => (
        <ResultCard
          key={r.name + i}
          r={r}
          isTop={false}
          saved={saved.has(r.name)}
          onToggleSave={onToggleSave}
        />
      ))}
    </div>
  );
}
