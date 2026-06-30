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
    <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-tr from-indigo-500/[0.07] via-white/[0.01] to-rose-500/[0.07] p-5 animate-sift-fade">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">💡</span>
        <h3 className="text-sm font-bold text-white">The distance trade-off</h3>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">
        <span className="font-semibold text-white">{near.name}</span> is ~{near.commute_min} min away;{" "}
        <span className="font-semibold text-white">{far.name}</span> is ~{far.commute_min} min. Living
        closer saves about{" "}
        <span className="font-semibold text-indigo-300">{fmtTHB(fareDiff)}/mo</span> in {MODE_LABEL[mode]}{" "}
        fares
        {hoursDiff > 0 && (
          <>
            {" "}
            and <span className="font-semibold text-indigo-300">~{fmtHours(hoursDiff)}/mo</span> of your
            time
          </>
        )}
        .
      </p>

      {rentKnown && netSaving != null && (
        <p className="mt-2 text-sm text-white/70 leading-relaxed">
          {netSaving > 0 ? (
            <>
              All-in, <span className="font-semibold text-white">{near.name}</span> still wins by{" "}
              <span className="font-semibold text-emerald-300">{fmtTHB(netSaving)}/mo</span> once the
              commute is counted.
            </>
          ) : netSaving < 0 ? (
            <>
              Even with the fare, <span className="font-semibold text-white">{far.name}</span> is{" "}
              <span className="font-semibold text-emerald-300">{fmtTHB(-netSaving)}/mo</span> cheaper
              all-in — the farther place wins on money, but costs you the extra time.
            </>
          ) : (
            <>All-in they land at about the same monthly cost — so it comes down to travel time.</>
          )}
        </p>
      )}

      {rentKnown && breakEvenDays != null && rentPremium != null && rentPremium > 0 && (
        <p className="mt-2 text-xs text-white/45">
          Break-even: paying {fmtTHB(rentPremium)} more to live at {near.name} pays for itself if you
          commute{" "}
          {breakEvenDays <= 7 ? (
            <>
              ≥ <span className="font-semibold text-white/70">{breakEvenDays} days/week</span>.
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
