import { useState } from "react";
import type { ListingResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ResultCard } from "./ResultCard";
import { CompareTable } from "./CompareTable";

export function Saved({
  items,
  onToggleSave,
}: {
  items: ListingResult[];
  onToggleSave: (listing: ListingResult) => void;
}) {
  const [comparing, setComparing] = useState(false);
  const canCompare = items.length >= 2;
  const showTable = comparing && canCompare;

  if (items.length === 0) {
    return (
      <div className="text-center py-20 px-6 animate-sift-fade">
        <div className="text-5xl mb-4">💛</div>
        <h3 className="text-lg font-semibold text-white mb-1">No saved places yet</h3>
        <p className="text-sm text-white/40 max-w-xs mx-auto">
          Tap the heart on any listing and it'll wait for you here — then compare your shortlist
          side by side.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-sift-fade">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          {items.length} saved {items.length === 1 ? "place" : "places"}
        </p>
        {canCompare && (
          <button
            type="button"
            onClick={() => setComparing((c) => !c)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-[0.98]",
              showTable
                ? "border border-white/[0.12] text-white/70 hover:bg-white/[0.04]"
                : "bg-gradient-to-r from-indigo-500 to-rose-500 text-white shadow-lg shadow-indigo-500/20",
            )}
          >
            {showTable ? "← Back to list" : "Compare Listings"}
          </button>
        )}
      </div>

      {showTable ? (
        <CompareTable items={items} />
      ) : (
        <div className="space-y-4">
          {items.map((r, i) => (
            <ResultCard key={r.name + i} r={r} isTop={false} saved onToggleSave={onToggleSave} />
          ))}
        </div>
      )}
    </div>
  );
}
