import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 animate-sift-fade">
      <Loader2 className="h-8 w-8 text-primary-dim animate-spin mb-5" />
      <h3 className="text-lg font-bold text-ink mb-1">Sifting real places near you…</h3>
      <p className="text-sm text-muted max-w-xs font-medium">
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
