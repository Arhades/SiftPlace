import { AREAS } from "@/lib/constants";
import { fmtTHB } from "@/lib/fare";

export function Areas() {
  return (
    <div className="space-y-3 animate-sift-fade">
      <p className="text-xs text-muted font-medium">
        Neighbourhoods at a glance — vibe, safety and typical rent.{" "}
        <span className="text-ink font-bold">Sample data · Bangkok.</span>
      </p>
      {AREAS.map((a) => (
        <div
          key={a.name}
          className="flex items-center gap-4 sf-card p-4"
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
          </div>
        </div>
      ))}
    </div>
  );
}
