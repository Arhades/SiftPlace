import { AREAS } from "@/lib/constants";
import { fmtTHB } from "@/lib/fare";

export function Areas() {
  return (
    <div className="space-y-3 animate-sift-fade">
      <p className="text-xs text-white/40">
        Neighbourhoods at a glance — vibe, safety and typical rent.{" "}
        <span className="text-white/60 font-medium">Sample data · Bangkok.</span>
      </p>
      {AREAS.map((a) => (
        <div
          key={a.name}
          className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4"
        >
          <div className="h-12 w-12 rounded-xl bg-white/[0.04] flex items-center justify-center text-2xl shrink-0">
            {a.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white">{a.name}</h3>
            <div className="text-xs text-white/45">
              {a.vibe} · {a.good}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
                🛡️ Safety {a.safety}/10
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.05] text-white/60">
                Avg {fmtTHB(a.rent)}/mo
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
