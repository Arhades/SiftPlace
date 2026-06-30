import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 animate-sift-fade">
      <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mb-5" />
      <h3 className="text-lg font-semibold text-white mb-1">Sifting real places near you…</h3>
      <p className="text-sm text-white/40 max-w-xs">
        Geocoding your destination, pulling listings from OpenStreetMap, and pricing the commute.
      </p>
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
      <h3 className="text-lg font-semibold text-white mb-1">No places found near there</h3>
      <p className="text-sm text-white/40 max-w-xs mb-6">
        Try a wider search radius, or a different area or city.
      </p>
      <div className="flex gap-3">
        {canWiden && (
          <button
            onClick={onWider}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-rose-500 text-white text-sm font-semibold cursor-pointer active:scale-[0.98]"
          >
            Search wider
          </button>
        )}
        <button
          onClick={onEdit}
          className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-white/70 text-sm font-medium hover:bg-white/[0.04] cursor-pointer"
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
      <h3 className="text-lg font-semibold text-white mb-1">Something went sideways</h3>
      <p className="text-sm text-white/40 max-w-sm mb-2">{message}</p>
      <p className="text-xs text-white/30 max-w-xs mb-6">
        Make sure the backend is running and reachable at the configured VITE_API_URL.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-rose-500 text-white text-sm font-semibold cursor-pointer active:scale-[0.98]"
        >
          Try again
        </button>
        <button
          onClick={onEdit}
          className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-white/70 text-sm font-medium hover:bg-white/[0.04] cursor-pointer"
        >
          Edit search
        </button>
      </div>
    </div>
  );
}
