import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  geocode,
  getFloodRisk,
  getRates,
  search,
  type CommuteMode,
  type FloodRisk,
  type ListingResult,
  type SearchRequest,
} from "@/lib/api";
import { setRates } from "@/lib/currency";
import { Intake, defaultIntake, type IntakeValues } from "@/components/Intake";
import { Results, type ResultsContext } from "@/components/Results";
import { Saved } from "@/components/Saved";
import { Areas } from "@/components/Areas";
import { Guide } from "@/components/Guide";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { LoadingState, EmptyState, ErrorState } from "@/components/States";

type Status = "loading" | "ok" | "empty" | "error";

const RADIUS_DEFAULT = 2500;
const RADIUS_MAX = 8000;
const RADIUS_STEP = 2500;
const TOP_N = 8;
const MAX_LISTINGS = 30;

const TAB_TITLES: Record<Exclude<Tab, "listings">, string> = {
  saved: "Saved places",
  areas: "Explore areas",
  guide: "Rent safely",
};

function buildReq(
  v: IntakeValues,
  anchor: { lat: number; lon: number } | null,
  radius: number,
): SearchRequest {
  return {
    city: v.city || undefined,
    anchor_lat: anchor?.lat,
    anchor_lon: anchor?.lon,
    weights: v.weights,
    budget: v.budget,
    currency: v.currency,
    check_in: v.checkIn || null,
    check_out: v.checkOut || null,
    occupancy: v.occupancy,
    notes: v.notes || null,
    other_terms: [], // the "Other…" chips were removed — the notes field covers free text
    commute_days: v.commuteDays,
    max_commute: v.maxCommute,
    nearby: v.nearby,
    vibe: v.vibe || null,
    types: v.types,
    amenities: v.amenities,
    commute_mode: v.mode,
    provider: "grab",
    value_of_time: v.valueOfTime,
    radius_m: radius,
    max_listings: MAX_LISTINGS,
    top_n: TOP_N,
  };
}

function App() {
  const [intake, setIntake] = useState<IntakeValues>(defaultIntake);
  const [filterOpen, setFilterOpen] = useState(false);

  // Solar Friend theme toggle — warm light by default, warm dark on demand.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "";
  }, [dark]);

  // FX table for displaying prices in the user's currency (fallback built in).
  useEffect(() => {
    getRates().then(setRates).catch(() => {});
  }, []);

  const [status, setStatus] = useState<Status>("loading");
  const [results, setResults] = useState<ListingResult[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [geoFailedMsg, setGeoFailedMsg] = useState<string | null>(null);
  const [flood, setFlood] = useState<FloodRisk | null>(null);
  const [ctx, setCtx] = useState<ResultsContext>({
    city: "", dest: "", budget: 0, currency: "THB", commuteDays: 5,
    rainySeason: false, stayMonths: null, radiusUsed: null, parsed: null,
  });
  const [lastReq, setLastReq] = useState<SearchRequest | null>(null);
  const [radius, setRadius] = useState(RADIUS_DEFAULT);

  const [tab, setTab] = useState<Tab>("listings");

  // ---- duplicate-search protection ----------------------------------------
  // Re-applying the filter without changing anything must NOT re-hit the
  // backend (and through it the rate-limited free APIs) — the last result is
  // already correct. Fingerprint of the last submitted intake values.
  const lastSubmitRef = useRef<string>("");

  // ---- stale-search protection -------------------------------------------
  // Every apply aborts the in-flight request AND bumps a monotonic token, so a
  // slow earlier response can never overwrite a newer search's results.
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [searchId, setSearchId] = useState(0); // resets the staged progress bar

  const beginSearch = (): { seq: number; signal: AbortSignal } => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++seqRef.current;
    setSearchId(seq);
    setResults([]); // old results must never linger under the progress bar
    setFlood(null);
    setStatus("loading");
    return { seq, signal: controller.signal };
  };
  const isStale = (seq: number) => seq !== seqRef.current;

  // Saved listings are stored in full (not just by name) so the Compare table
  // works across searches and survives reloads. Persisted to localStorage.
  const [saved, setSaved] = useState<Map<string, ListingResult>>(() => {
    try {
      const raw = localStorage.getItem("siftplace:saved");
      const arr = raw ? (JSON.parse(raw) as ListingResult[]) : [];
      return new Map(arr.map((l) => [l.name, l]));
    } catch {
      return new Map<string, ListingResult>();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("siftplace:saved", JSON.stringify([...saved.values()]));
    } catch {
      // ignore storage failures (private mode, quota)
    }
  }, [saved]);

  const toggleSave = (l: ListingResult) =>
    setSaved((prev) => {
      const next = new Map(prev);
      if (next.has(l.name)) next.delete(l.name);
      else next.set(l.name, l);
      return next;
    });

  // Re-applying identical filters must not re-hit the backend (the free APIs
  // behind it are rate-limited): remember what the last SUCCESSFUL search was
  // for and reuse the on-screen results when nothing changed.
  const lastGoodIntake = useRef<string | null>(null);

  const runSearch = async (
    req: SearchRequest,
    handle?: { seq: number; signal: AbortSignal },
    ctxPatch?: Partial<ResultsContext>,
  ): Promise<boolean> => {
    const { seq, signal } = handle ?? beginSearch();
    setLastReq(req);
    setRadius(req.radius_m);
    try {
      const res = await search(req, signal);
      if (isStale(seq)) return false;
      setResults(res.results);
      setNote(res.note);
      setCtx((p) => ({
        ...p,
        ...ctxPatch,
        budget: req.budget,
        currency: req.currency,
        commuteDays: req.commute_days,
        rainySeason: res.rainy_season,
        stayMonths: res.stay_months,
        radiusUsed: res.radius_used,
        parsed: res.parsed,
      }));
      setStatus(res.results.length === 0 ? "empty" : "ok");
      if (res.centre) {
        // weather + flood risk for the searched area (non-blocking, best effort)
        getFloodRisk(res.centre[0], res.centre[1], signal)
          .then((f) => {
            if (!isStale(seq)) setFlood(f);
          })
          .catch(() => {});
      }
      return true;
    } catch (e) {
      if (isStale(seq) || (e instanceof DOMException && e.name === "AbortError")) return false;
      setErrorMsg(e instanceof Error ? e.message : "Unexpected error.");
      setStatus("error");
      return false;
    }
  };

<<<<<<< Updated upstream
  const handleSearch = async (values: IntakeValues, force = false) => {
=======
  const handleSearch = async (values: IntakeValues) => {
    // identical filters + results already on screen -> nothing to fetch
    const intakeKey = JSON.stringify(values);
    if (intakeKey === lastGoodIntake.current && (status === "ok" || status === "empty")) {
      setIntake(values);
      return;
    }
>>>>>>> Stashed changes
    setIntake(values);

    // identical intake + a usable result on screen -> reuse it, don't refetch
    // (force=true bypasses this for the explicit Retry button)
    const fingerprint = JSON.stringify(values);
    if (!force && fingerprint === lastSubmitRef.current
        && (status === "ok" || status === "empty")) {
      return;
    }
    lastSubmitRef.current = fingerprint;

    const handle = beginSearch();
    setGeoFailedMsg(null);

    let anchor: { lat: number; lon: number } | null = null;
    let geoFailed = false;
    const dest = values.destination.trim();

    if (dest) {
      try {
        const g = await geocode(values.city ? `${dest}, ${values.city}` : dest, handle.signal);
        if (isStale(handle.seq)) return;
        if (g.found && g.lat != null && g.lon != null) {
          anchor = { lat: g.lat, lon: g.lon };
        } else {
          geoFailed = true;
        }
      } catch (e) {
        if (isStale(handle.seq) || (e instanceof DOMException && e.name === "AbortError")) return;
        setErrorMsg(e instanceof Error ? e.message : "Unexpected error.");
        setStatus("error");
        return;
      }
    }

    setGeoFailedMsg(
      geoFailed
        ? `Couldn't pin "${dest}" — searching the ${values.city || "city"} centre instead.`
        : null,
    );

    const ok = await runSearch(buildReq(values, anchor, RADIUS_DEFAULT), handle, {
      city: values.city,
      dest,
    });
    lastGoodIntake.current = ok ? intakeKey : null;
  };

  // Browse-first: load default (Bangkok) listings on mount. Guard against the
  // StrictMode double-invoke so we don't hit Overpass twice.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void handleSearch(defaultIntake());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (values: IntakeValues) => {
    setFilterOpen(false);
    setTab("listings");
    window.scrollTo(0, 0);
    void handleSearch(values);
  };

  const changeMode = (m: CommuteMode) => {
    if (!lastReq || m === lastReq.commute_mode) return;
    setIntake((p) => ({ ...p, mode: m }));
    lastGoodIntake.current = null; // results no longer match the plain intake
    void runSearch({ ...lastReq, commute_mode: m });
  };

  const widerRadius = () => {
    if (!lastReq) return;
    lastGoodIntake.current = null; // results no longer match the plain intake
    void runSearch({ ...lastReq, radius_m: Math.min(lastReq.radius_m + RADIUS_STEP, RADIUS_MAX) });
  };

  const retry = () => {
    void handleSearch(intake, true);
  };

  const openFilter = () => {
    setFilterOpen(true);
    window.scrollTo(0, 0);
  };

  const goTab = (t: Tab) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  const savedNames = new Set(saved.keys());
  const savedItems = [...saved.values()];

  return (
    <div className="min-h-screen text-ink">
      {/* ambient background */}
      <div className="fixed inset-0 -z-10 bg-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.10] via-transparent to-secondary/[0.08]" />
      </div>

      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
          <div className="max-w-3xl mx-auto flex items-center justify-between px-5 py-3">
            <span className="flex items-center gap-2">
              <Logo size={38} />
              <span className="font-bold text-lg tracking-tight text-primary-dim">SiftPlace</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDark((d) => !d)}
                aria-label="Toggle dark mode"
                className="h-9 w-9 rounded-full bg-surface-c text-ink text-base flex items-center justify-center transition active:scale-90 cursor-pointer"
              >
                {dark ? "☀️" : "🌙"}
              </button>
              {tab === "listings" && (
                <button
                  onClick={openFilter}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 border-line bg-lowest text-ink text-xs font-bold hover:bg-surface-c transition cursor-pointer"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto px-5 py-6">
          {tab !== "listings" && <h2 className="text-xl font-bold mb-4 text-ink">{TAB_TITLES[tab]}</h2>}

          {tab === "listings" &&
            (status === "loading" ? (
              <LoadingState searchId={searchId} />
            ) : status === "error" ? (
              <ErrorState message={errorMsg} onRetry={retry} onEdit={openFilter} />
            ) : status === "empty" ? (
              <EmptyState onWider={widerRadius} onEdit={openFilter} canWiden={radius < RADIUS_MAX} />
            ) : (
              <Results
                results={results}
                note={note}
                mode={lastReq?.commute_mode ?? "car"}
                context={ctx}
                flood={flood}
                savedNames={savedNames}
                onToggleSave={toggleSave}
                onChangeMode={changeMode}
                geoFailedMsg={geoFailedMsg}
              />
            ))}

          {tab === "saved" && <Saved items={savedItems} onToggleSave={toggleSave} currency={ctx.currency} />}
          {tab === "areas" && <Areas />}
          {tab === "guide" && <Guide />}
        </main>

        <BottomNav tab={tab} onTab={goTab} savedCount={saved.size} />
      </div>

      {/* SiftPlace filter overlay */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 bg-surface overflow-y-auto">
          <div className="sticky top-0 z-10 flex justify-end px-5 py-3 bg-surface/80 backdrop-blur-md">
            <button
              onClick={() => setFilterOpen(false)}
              aria-label="Close filters"
              className="h-9 w-9 rounded-full border-2 border-line bg-lowest text-muted hover:text-ink flex items-center justify-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Intake initial={intake} onSubmit={applyFilters} />
        </div>
      )}
    </div>
  );
}

export default App;
