import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { getFloodRisk, type FloodRisk, type ListingResult } from "@/lib/api";
import { AREAS, type AreaCard } from "@/lib/constants";
import { fmtTHB } from "@/lib/fare";
import { AREA_LISTINGS } from "@/data/areaListings";
import { FloodMonthChips } from "./FloodCard";
import { ResultCard } from "./ResultCard";

// Neighbourhood explorer: the glance list, plus a click-through per area with
// its top popular listings — same card formatting as search results, minus the
// cost/location/living metrics (no query to score against while browsing).

// Per-area flood risk survives tab switches: the backend caches by coordinate
// bucket, but this also skips re-render churn and repeat HTTP round trips.
const floodCache = new Map<string, FloodRisk>();

export function Areas({
  savedNames,
  onToggleSave,
  currency = "THB",
  floodMonths,
}: {
  savedNames?: Set<string>;
  onToggleSave?: (listing: ListingResult) => void;
  currency?: string;
  /** Calendar months (1-12) the flood chips cover — the user's stay months,
   *  or the next quarter without dates. */
  floodMonths: number[];
}) {
  const [selected, setSelected] = useState<AreaCard | null>(null);

  // per-month flood risk under every area (best effort — no chips on failure)
  const [floods, setFloods] = useState<Record<string, FloodRisk>>({});
  const monthsKey = floodMonths.join(",");
  useEffect(() => {
    let cancelled = false;
    AREAS.forEach((a) => {
      const key = `${a.name}:${monthsKey}`;
      const hit = floodCache.get(key);
      if (hit) {
        setFloods((p) => (p[a.name] === hit ? p : { ...p, [a.name]: hit }));
        return;
      }
      getFloodRisk(a.lat, a.lon, floodMonths)
        .then((f) => {
          floodCache.set(key, f);
          if (!cancelled) setFloods((p) => ({ ...p, [a.name]: f }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsKey]);

  if (selected) {
    const picks = AREA_LISTINGS[selected.name] ?? [];
    return (
      <div className="space-y-4 animate-sift-fade">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 border-line bg-lowest text-xs font-bold text-ink hover:bg-surface-c transition cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All areas
        </button>

        {/* area header */}
        <div className="sf-card p-5 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-surface-c flex items-center justify-center text-3xl shrink-0">
            {selected.emoji}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-ink leading-tight">{selected.name}</h3>
            <p className="text-xs text-muted font-medium">
              {selected.vibe} · {selected.good}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-ok-soft text-ok">
                🛡️ Safety {selected.safety}/10
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-surface-c text-ink">
                Avg {fmtTHB(selected.rent)}/mo
              </span>
            </div>
            {floods[selected.name] && (
              <div className="mt-2">
                <FloodMonthChips flood={floods[selected.name]} />
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted font-medium">
          <span className="font-bold text-ink">Popular with students in {selected.name}</span> —
          curated sample picks with estimated prices; commute figures assume the Siam/Chula city
          core. Run a search for live places ranked for YOUR priorities.
        </p>

        {picks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {picks.map((r) => (
              <ResultCard
                key={r.name}
                r={r}
                isTop={false}
                saved={savedNames?.has(r.name) ?? false}
                currency={currency}
                onToggleSave={onToggleSave ?? (() => {})}
                hideMetrics
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted font-medium py-8 text-center">
            No curated picks for this area yet — run a search to see live listings here.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-sift-fade">
      <p className="text-xs text-muted font-medium">
        Neighbourhoods at a glance — vibe, safety and typical rent. Tap one to see its most
        popular places. <span className="text-ink font-bold">Sample data · Bangkok.</span>
      </p>
      {AREAS.map((a) => (
        <button
          key={a.name}
          type="button"
          onClick={() => setSelected(a)}
          className="w-full flex items-center gap-4 sf-card p-4 text-left cursor-pointer hover:bg-surface-low transition"
        >
          <div className="h-12 w-12 rounded-2xl bg-surface-c flex items-center justify-center text-2xl shrink-0">
            {a.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-ink">{a.name}</h3>
            <div className="text-xs text-muted font-medium">
              {a.vibe} · {a.good}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-ok-soft text-ok">
                🛡️ Safety {a.safety}/10
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-surface-c text-ink">
                Avg {fmtTHB(a.rent)}/mo
              </span>
            </div>
            {floods[a.name] && (
              <div className="mt-2">
                <FloodMonthChips flood={floods[a.name]} />
              </div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted shrink-0" />
        </button>
      ))}
    </div>
  );
}
