import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CommuteMode, FloodRisk, ListingResult, ParsedNotes } from "@/lib/api";
import { MODE_OPTIONS } from "@/lib/constants";
import { SYMBOLS } from "@/lib/currency";
import { computeTradeOff, MODE_SHORT } from "@/lib/fare";
import { cn } from "@/lib/utils";
import { FloodCard } from "./FloodCard";
import { ResultCard } from "./ResultCard";
import { TradeOffCallout } from "./TradeOffCallout";

export interface ResultsContext {
  city: string;
  dest: string;
  budget: number; // in `currency` units (what the user typed)
  currency: string;
  commuteDays: number;
  rainySeason: boolean;
  stayMonths: number | null;
  radiusUsed: number | null;
  parsed: ParsedNotes | null;
  /** True while showing the curated zero-API starter picks. */
  featured: boolean;
}

export function Results({
  results,
  note,
  mode,
  context,
  flood,
  savedNames,
  onToggleSave,
  onChangeMode,
  geoFailedMsg,
  page,
  totalPages,
  total,
  onPage,
}: {
  results: ListingResult[];
  note: string | null;
  mode: CommuteMode;
  context: ResultsContext;
  flood: FloodRisk | null;
  savedNames: Set<string>;
  onToggleSave: (listing: ListingResult) => void;
  onChangeMode: (m: CommuteMode) => void;
  geoFailedMsg: string | null;
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const tradeOff = computeTradeOff(results, context.commuteDays);
  const title = context.featured
    ? "Popular with students in Bangkok"
    : context.dest
      ? `Listings near ${context.dest}`
      : `Top listings in ${context.city || "your city"}`;
  // budget is already in the user's currency — just prefix its symbol
  const budgetLabel =
    (SYMBOLS[context.currency] ?? context.currency) + context.budget.toLocaleString("en-US");

  return (
    <div className="space-y-4">
      {/* context header */}
      <div>
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-muted font-medium">
          <span className="font-bold text-ink">{total}</span>{" "}
          place{total === 1 ? "" : "s"} · ranked by true monthly cost
          {!context.featured && (
            <>
              {" "}
              · within <span className="font-bold text-ink">{budgetLabel}</span>/mo
            </>
          )}
          {context.stayMonths != null && (
            <>
              {" "}
              · <span className="font-bold text-ink">{context.stayMonths} mo</span> stay
            </>
          )}
          {context.radiusUsed != null && context.radiusUsed > 2500 && (
            <>
              {" "}
              · searched <span className="font-bold text-ink">
                {(context.radiusUsed / 1000).toFixed(1)} km
              </span>{" "}
              wide for your priorities
            </>
          )}
        </p>
        {geoFailedMsg && <p className="mt-1 text-xs text-secondary-dim font-semibold">{geoFailedMsg}</p>}
        {context.parsed && context.parsed.detected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[11px] text-muted font-bold py-1">From your note:</span>
            {context.parsed.detected.map((d) => (
              <span key={d} className="px-2.5 py-1 rounded-full bg-ok-soft text-ok text-[11px] font-bold">
                ✓ {d}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* commute mode toggle — swaps client-side from the fares each result
          already carries; no backend call */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted font-bold">
          Commute by
        </span>
        <div className="inline-flex rounded-full border-2 border-line bg-lowest p-0.5">
          {MODE_OPTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onChangeMode(m.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer",
                mode === m.value ? "bg-primary text-on-primary" : "text-muted hover:text-ink",
              )}
            >
              {m.icon} {MODE_SHORT[m.value]}
            </button>
          ))}
        </div>
      </div>

      {/* weather + flood risk for the searched area */}
      {flood && <FloodCard flood={flood} rainySeason={context.rainySeason} />}

      {tradeOff && (
        <TradeOffCallout data={tradeOff} mode={mode} commuteDays={context.commuteDays} />
      )}

      {/* the 3×2 grid: 3 columns on desktop, 2 on tablets, 1 on phones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {results.map((r, i) => (
          <ResultCard
            key={r.name + i}
            r={r}
            isTop={page === 1 && i === 0}
            saved={savedNames.has(r.name)}
            currency={context.currency}
            onToggleSave={onToggleSave}
          />
        ))}
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-line bg-lowest text-xs font-bold text-ink hover:bg-surface-c transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="text-xs font-bold text-muted">
            Page <span className="text-ink">{page}</span> of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-line bg-lowest text-xs font-bold text-ink hover:bg-surface-c transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {note && (
        <div className="rounded-2xl border border-line bg-surface-low p-4 text-xs text-muted leading-relaxed font-medium">
          <span className="font-bold text-ink">Honest data note:</span> {note}
        </div>
      )}
    </div>
  );
}
