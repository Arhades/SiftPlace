import type { CommuteMode, ListingResult } from "@/lib/api";
import { MODE_OPTIONS } from "@/lib/constants";
import { computeTradeOff, MODE_SHORT } from "@/lib/fare";
import { cn } from "@/lib/utils";
import { ResultCard } from "./ResultCard";
import { TradeOffCallout } from "./TradeOffCallout";

export interface ResultsContext {
  city: string;
  dest: string;
  budget: number;
  commuteDays: number;
}

export function Results({
  results,
  note,
  mode,
  context,
  savedNames,
  onToggleSave,
  onChangeMode,
  geoFailedMsg,
}: {
  results: ListingResult[];
  note: string | null;
  mode: CommuteMode;
  context: ResultsContext;
  savedNames: Set<string>;
  onToggleSave: (listing: ListingResult) => void;
  onChangeMode: (m: CommuteMode) => void;
  geoFailedMsg: string | null;
}) {
  const tradeOff = computeTradeOff(results, context.commuteDays);
  const title = context.dest
    ? `Listings near ${context.dest}`
    : `Top listings in ${context.city || "your city"}`;

  return (
    <div className="space-y-4">
      {/* context header */}
      <div>
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-muted font-medium">
          <span className="font-bold text-ink">{results.length}</span>{" "}
          place{results.length === 1 ? "" : "s"} · ranked by true monthly cost · within{" "}
          <span className="font-bold text-ink">
            ฿{context.budget.toLocaleString("en-US")}
          </span>
          /mo
        </p>
        {geoFailedMsg && <p className="mt-1 text-xs text-secondary-dim font-semibold">{geoFailedMsg}</p>}
      </div>

      {/* commute mode toggle (re-runs the search for consistent scores) */}
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

      {tradeOff && (
        <TradeOffCallout data={tradeOff} mode={mode} commuteDays={context.commuteDays} />
      )}

      <div className="space-y-4">
        {results.map((r, i) => (
          <ResultCard
            key={r.name + i}
            r={r}
            isTop={i === 0}
            saved={savedNames.has(r.name)}
            onToggleSave={onToggleSave}
          />
        ))}
      </div>

      {note && (
        <div className="rounded-2xl border border-line bg-surface-low p-4 text-xs text-muted leading-relaxed font-medium">
          <span className="font-bold text-ink">Honest data note:</span> {note}
        </div>
      )}
    </div>
  );
}
