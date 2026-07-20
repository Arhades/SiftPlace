import { CloudRain, Droplets } from "lucide-react";
import type { FloodRisk, FloodRiskLevel } from "@/lib/api";
import { cn, monthShortName } from "@/lib/utils";

const RISK_STYLE: Record<FloodRiskLevel, { badge: string; label: string; icon: string }> = {
  low: { badge: "bg-ok-soft text-ok", label: "Low flood risk", icon: "✅" },
  moderate: { badge: "bg-warn-soft text-warn", label: "Moderate flood risk", icon: "⚠️" },
  high: { badge: "bg-error-soft text-error", label: "High flood risk", icon: "🌊" },
};

const RISK_SHORT: Record<FloodRiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

/** Compact one-line month chips ("Oct ⚠️ Nov ✅ …") — used under each area in
 *  the Areas tab; the full FloodCard below is the results-page version. */
export function FloodMonthChips({ flood }: { flood: FloodRisk }) {
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] font-bold text-muted">🌊 Flood risk:</span>
      {flood.months.map((m) => (
        <span
          key={m.month}
          title={`${monthShortName(m.month)}: ${RISK_SHORT[m.risk]} — ${m.reasons.join("; ")}`}
          className={cn(
            "text-[11px] font-bold px-2 py-0.5 rounded-full",
            RISK_STYLE[m.risk].badge,
          )}
        >
          {monthShortName(m.month)} {RISK_STYLE[m.risk].icon}
        </span>
      ))}
    </span>
  );
}

/** Per-month flood indicator for the searched area, month by month over the
 *  user's stay dates (or the next quarter without dates). Open data via the
 *  backend's /flood-risk — a rough signal, not hydrology. */
export function FloodCard({
  flood,
  rainySeason,
  scope,
}: {
  flood: FloodRisk;
  rainySeason: boolean;
  scope: "stay" | "quarter";
}) {
  const style = RISK_STYLE[flood.risk];
  const monthSpan =
    flood.months.length > 0
      ? `${monthShortName(flood.months[0].month)} – ${monthShortName(flood.months[flood.months.length - 1].month)}`
      : "";

  return (
    <section className="sf-card p-4 animate-sift-fade">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          <CloudRain className="h-3.5 w-3.5" /> Flood risk in this area ·{" "}
          {scope === "stay" ? `your stay (${monthSpan})` : `next quarter (${monthSpan})`}
        </span>
        <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", style.badge)}>
          {style.icon} {style.label}
        </span>
      </div>

      {/* one easy row per month: name, risk badge, plain-language why */}
      <ul className="mt-3 space-y-1.5">
        {flood.months.map((m) => (
          <li key={m.month} className="flex items-center gap-2.5 text-xs">
            <span className="w-8 shrink-0 font-bold text-ink">{monthShortName(m.month)}</span>
            <span
              className={cn(
                "shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full w-24 text-center",
                RISK_STYLE[m.risk].badge,
              )}
            >
              {RISK_STYLE[m.risk].icon} {RISK_SHORT[m.risk]}
            </span>
            <span className="text-muted font-medium min-w-0">
              {m.heavy_rain_pct != null
                ? `~${Math.round(m.heavy_rain_pct)}% of days see heavy rain`
                : m.reasons[0]}
            </span>
          </li>
        ))}
      </ul>

      {flood.elevation_m != null && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted font-medium">
          <Droplets className="h-3.5 w-3.5 shrink-0" />
          ~{Math.round(flood.elevation_m)} m elevation
          {flood.elevation_m <= 4 && <> — low-lying ground drains poorly</>}
        </div>
      )}

      {rainySeason && (
        <p className="mt-2 text-[11px] font-semibold text-warn bg-warn-soft rounded-xl px-3 py-2">
          🌧️ Your stay overlaps Sep–Oct, Bangkok's rainy/flood window — check ground-floor
          water-line marks before signing (see the Guide tab).
        </p>
      )}

      {flood.reasons.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {flood.reasons.map((r) => (
            <li key={r} className="text-[11px] text-muted font-medium">
              · {r}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-muted/70 font-medium">
        Rough indicator from {flood.source}. Tune, don't trust blindly.
      </p>
    </section>
  );
}
