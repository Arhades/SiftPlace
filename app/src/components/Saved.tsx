import { useState } from "react";
import type { ListingResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ResultCard } from "./ResultCard";
import { CompareTable } from "./CompareTable";

export function Saved({
  items,
  onToggleSave,
  currency = "THB",
}: {
  items: ListingResult[];
  onToggleSave: (listing: ListingResult) => void;
  currency?: string;
}) {
  const [comparing, setComparing] = useState(false);
  const canCompare = items.length >= 2;
  const showTable = comparing && canCompare;

  if (items.length === 0) {
    return (
      <div className="text-center py-20 px-6 animate-sift-fade">
        <div className="text-5xl mb-4">💛</div>
        <h3 className="text-lg font-bold text-ink mb-1">No saved places yet</h3>
        <p className="text-sm text-muted max-w-xs mx-auto font-medium">
          Tap the heart on any listing and it'll wait for you here — then compare your shortlist
          side by side.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-sift-fade">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted font-medium">
          {items.length} saved {items.length === 1 ? "place" : "places"}
        </p>
        {canCompare && (
          <button
            type="button"
            onClick={() => setComparing((c) => !c)}
            className={cn(
              "px-3.5 py-2 rounded-full text-xs font-bold transition cursor-pointer active:scale-[0.97]",
              showTable
                ? "border-2 border-line text-muted hover:bg-surface-c"
                : "sf-cta",
            )}
          >
            {showTable ? "← Back to list" : "Compare Listings"}
          </button>
        )}
      </div>

      {showTable ? (
        <CompareTable items={items} currency={currency} />
      ) : (
        <div className="space-y-4">
          {items.map((r, i) => (
            <ResultCard
              key={r.name + i}
              r={r}
              isTop={false}
              saved
              currency={currency}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
