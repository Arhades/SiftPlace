import type { CommuteMode, ListingResult } from "@/lib/api";
import { MODE_OPTIONS } from "@/lib/constants";
import { computeTradeOff, MODE_SHORT } from "@/lib/fare";
import { cn } from "@/lib/utils";
import { ResultCard } from "./ResultCard";
import { TradeOffCallout } from "./TradeOffCallout";

export interface ResultsContext {
  destLabel: string;
  city: string;
  budget: number;
  commuteDays: number;
}

export function Results({
  results,
  note,
  mode,
  context,
  saved,
  onToggleSave,
  onChangeMode,
  geoFailedMsg,
}: {
  results: ListingResult[];
  note: string | null;
  mode: CommuteMode;
  context: ResultsContext;
  saved: Set<string>;
  onToggleSave: (name: string) => void;
  onChangeMode: (m: CommuteMode) => void;
  geoFailedMsg: string | null;
}) {
  const tradeOff = computeTradeOff(results, context.commuteDays);

  return (
    <div className="space-y-4">
      {/* context header */}
      <div>
        <p className="text-sm text-white/55">
          <span className="font-semibold text-white">{results.length}</span>{" "}
          place{results.length === 1 ? "" : "s"} near{" "}
          <span className="font-semibold text-white">{context.destLabel}</span>
          {context.city ? (
            <>
              {" "}
              in <span className="font-semibold text-white">{context.city}</span>
            </>
          ) : null}
          , within{" "}
          <span className="font-semibold text-white">
            ฿{context.budget.toLocaleString("en-US")}
          </span>
          /mo.
        </p>
        {geoFailedMsg && <p className="mt-1 text-xs text-amber-300/90">{geoFailedMsg}</p>}
      </div>

      {/* mode toggle (re-runs the search for consistent scores) */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
          Commute by
        </span>
        <div className="inline-flex rounded-xl border border-white/[0.1] bg-white/[0.02] p-0.5">
          {MODE_OPTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onChangeMode(m.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
                mode === m.value ? "bg-indigo-500 text-white" : "text-white/55 hover:text-white/80",
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
            saved={saved.has(r.name)}
            onToggleSave={onToggleSave}
          />
        ))}
      </div>

      {note && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-white/45 leading-relaxed">
          <span className="font-semibold text-white/60">Honest data note:</span> {note}
        </div>
      )}
    </div>
  );
}
