import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Staged search progress. Stages advance on a timer while the request runs
// (the network does the real work); the bar restarts from stage 0 on every
// re-apply — keyed by searchId so an aborted/re-fired search always resets.
const STAGES = [
  "Consolidating Request…",
  "Searching area…",
  "Narrowing down the best options for you :)",
  "Finalising Selection!",
] as const;

// how long each stage holds before advancing (the last stage holds until done)
const STAGE_MS = [900, 2600, 3500];

export function LoadingState({ searchId = 0 }: { searchId?: number }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
    const timers = STAGE_MS.map((_, i) =>
      setTimeout(
        () => setStage(i + 1),
        STAGE_MS.slice(0, i + 1).reduce((a, b) => a + b, 0),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [searchId]);

  const pct = ((stage + 1) / STAGES.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 animate-sift-fade">
      <div className="w-full max-w-sm">
        <div className="h-3 rounded-full bg-surface-high overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dim transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <h3 className="mt-5 text-lg font-bold text-ink" aria-live="polite">
          {STAGES[stage]}
        </h3>
        <div className="mt-4 flex justify-center gap-1.5">
          {STAGES.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i <= stage ? "bg-primary-dim" : "bg-surface-high",
              )}
            />
          ))}
        </div>
        <p className="mt-4 text-sm text-muted max-w-xs mx-auto font-medium">
          Pulling real listings, pricing the commute, and ranking by true monthly cost.
        </p>
      </div>
    </div>
  );
}

export function EmptyState({
  onWider,
  onEdit,
  canWiden,
}: {
  onWider: () => void;
  onEdit: () => void;
  canWiden: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 animate-sift-fade">
      <div className="text-5xl mb-4">🧭</div>
      <h3 className="text-lg font-bold text-ink mb-1">No places found near there</h3>
      <p className="text-sm text-muted max-w-xs mb-6 font-medium">
        Try a wider search radius, or a different area or city.
      </p>
      <div className="flex gap-3">
        {canWiden && (
          <button
            onClick={onWider}
            className="sf-cta px-5 py-2.5 text-sm cursor-pointer"
          >
            Search wider
          </button>
        )}
        <button
          onClick={onEdit}
          className="px-5 py-2.5 rounded-full border-2 border-line text-muted text-sm font-bold hover:bg-surface-c cursor-pointer"
        >
          Edit search
        </button>
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  onEdit,
}: {
  message: string;
  onRetry: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 animate-sift-fade">
      <div className="text-5xl mb-4">⚠️</div>
      <h3 className="text-lg font-bold text-ink mb-1">Something went sideways</h3>
      <p className="text-sm text-muted max-w-sm mb-2 font-medium">{message}</p>
      <p className="text-xs text-muted/70 max-w-xs mb-6 font-medium">
        Make sure the backend is running and reachable at the configured VITE_API_URL.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="sf-cta px-5 py-2.5 text-sm cursor-pointer"
        >
          Try again
        </button>
        <button
          onClick={onEdit}
          className="px-5 py-2.5 rounded-full border-2 border-line text-muted text-sm font-bold hover:bg-surface-c cursor-pointer"
        >
          Edit search
        </button>
      </div>
    </div>
  );
}
