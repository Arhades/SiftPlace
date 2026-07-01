import type { CommuteMode } from "@/lib/api";
import type { TradeOffData } from "@/lib/fare";
import { MODE_LABEL, fmtHours, fmtTHB } from "@/lib/fare";

/**
 * The headline SiftPlace insight made explicit: a cheaper-farther place can cost
 * more once you add the daily fare — and burn your time. Adapts to whether rent
 * is known (full money trade-off + break-even) or unknown (fare/time only).
 */
export function TradeOffCallout({
  data,
  mode,
  commuteDays,
}: {
  data: TradeOffData;
  mode: CommuteMode;
  commuteDays: number;
}) {
  const { near, far, fareDiff, hoursDiff, rentKnown, netSaving, rentPremium, breakEvenDays } = data;

  return (
    <div className="rounded-2xl border border-tertiary/30 bg-tertiary-c/50 p-5 animate-sift-fade">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">💡</span>
        <h3 className="text-sm font-bold text-ink">The distance trade-off</h3>
      </div>

      <p className="text-sm text-ink/80 leading-relaxed font-medium">
        <span className="font-bold text-ink">{near.name}</span> is ~{near.commute_min} min away;{" "}
        <span className="font-bold text-ink">{far.name}</span> is ~{far.commute_min} min. Living
        closer saves about{" "}
        <span className="font-bold text-secondary-dim">{fmtTHB(fareDiff)}/mo</span> in {MODE_LABEL[mode]}{" "}
        fares
        {hoursDiff > 0 && (
          <>
            {" "}
            and <span className="font-bold text-secondary-dim">~{fmtHours(hoursDiff)}/mo</span> of your
            time
          </>
        )}
        .
      </p>

      {rentKnown && netSaving != null && (
        <p className="mt-2 text-sm text-ink/80 leading-relaxed font-medium">
          {netSaving > 0 ? (
            <>
              All-in, <span className="font-bold text-ink">{near.name}</span> still wins by{" "}
              <span className="font-bold text-ok">{fmtTHB(netSaving)}/mo</span> once the
              commute is counted.
            </>
          ) : netSaving < 0 ? (
            <>
              Even with the fare, <span className="font-bold text-ink">{far.name}</span> is{" "}
              <span className="font-bold text-ok">{fmtTHB(-netSaving)}/mo</span> cheaper
              all-in — the farther place wins on money, but costs you the extra time.
            </>
          ) : (
            <>All-in they land at about the same monthly cost — so it comes down to travel time.</>
          )}
        </p>
      )}

      {rentKnown && breakEvenDays != null && rentPremium != null && rentPremium > 0 && (
        <p className="mt-2 text-xs text-muted font-medium">
          Break-even: paying {fmtTHB(rentPremium)} more to live at {near.name} pays for itself if you
          commute{" "}
          {breakEvenDays <= 7 ? (
            <>
              ≥ <span className="font-bold text-ink">{breakEvenDays} days/week</span>.
            </>
          ) : (
            <>
              more than 7 days/week — i.e. it doesn't, at {commuteDays} day
              {commuteDays === 1 ? "" : "s"}/week.
            </>
          )}
        </p>
      )}
    </div>
  );
}
