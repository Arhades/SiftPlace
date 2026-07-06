import { CloudRain, Droplets } from "lucide-react";
import type { FloodRisk, FloodRiskLevel } from "@/lib/api";
import { cn } from "@/lib/utils";

const RISK_STYLE: Record<FloodRiskLevel, { badge: string; label: string; icon: string }> = {
  low: { badge: "bg-ok-soft text-ok", label: "Low flood risk", icon: "✅" },
  moderate: { badge: "bg-warn-soft text-warn", label: "Moderate flood risk", icon: "⚠️" },
  high: { badge: "bg-error-soft text-error", label: "High flood risk", icon: "🌊" },
};

function dayName(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

/** Weather forecast + heuristic flood indicator for the searched area
 * (open data via the backend's /flood-risk — a rough signal, not hydrology). */
export function FloodCard({ flood, rainySeason }: { flood: FloodRisk; rainySeason: boolean }) {
  const style = RISK_STYLE[flood.risk];
  const maxRain = Math.max(8, ...flood.daily.map((d) => d.rain_mm));

  return (
    <section className="sf-card p-4 animate-sift-fade">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          <CloudRain className="h-3.5 w-3.5" /> Weather &amp; flood risk in this area
        </span>
        <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", style.badge)}>
          {style.icon} {style.label}
        </span>
      </div>

      {flood.daily.length > 0 && (
        <div className="mt-3 flex items-end gap-1.5 h-16">
          {flood.daily.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex items-end justify-center h-10">
                <div
                  className="w-3/5 rounded-t-md bg-tertiary/70"
                  style={{ height: `${Math.max(4, (d.rain_mm / maxRain) * 100)}%` }}
                  title={`${d.rain_mm} mm`}
                />
              </div>
              <span className="text-[9px] font-bold text-muted truncate">{dayName(d.date)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted font-medium">
        <Droplets className="h-3.5 w-3.5 shrink-0" />
        {flood.heavy_rain_pct != null
<<<<<<< Updated upstream
          ? <>~{Math.round(flood.heavy_rain_pct)}% of days this month typically see heavy rain</>
          : <>seasonal rain data unavailable — season-only estimate</>}
=======
          ? <>heavy rain expected on ~{flood.heavy_rain_pct}% of days this month</>
          : <>~{Math.round(flood.week_rain_mm)} mm of rain in the next 7 days</>}
>>>>>>> Stashed changes
        {flood.elevation_m != null && <> · ~{Math.round(flood.elevation_m)} m elevation</>}
      </div>

      {rainySeason && (
        <p className="mt-2 text-[11px] font-semibold text-warn bg-warn-soft rounded-xl px-3 py-2">
          🌧️ Your stay overlaps Sep–Oct, Bangkok's rainy/flood window — check ground-floor
          water-line marks before signing (see the Guide tab).
        </p>
      )}

      <ul className="mt-2 space-y-0.5">
        {flood.reasons.map((r) => (
          <li key={r} className="text-[11px] text-muted font-medium">
            · {r}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted/70 font-medium">
        Rough indicator from {flood.source}. Tune, don't trust blindly.
      </p>
    </section>
  );
}
