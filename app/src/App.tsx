import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  geocode,
  search,
  type CommuteMode,
  type ListingResult,
  type SearchRequest,
} from "@/lib/api";
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

  const [status, setStatus] = useState<Status>("loading");
  const [results, setResults] = useState<ListingResult[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [geoFailedMsg, setGeoFailedMsg] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ResultsContext>({ city: "", dest: "", budget: 0, commuteDays: 5 });
  const [lastReq, setLastReq] = useState<SearchRequest | null>(null);
  const [radius, setRadius] = useState(RADIUS_DEFAULT);

  const [tab, setTab] = useState<Tab>("listings");

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

  const runSearch = async (req: SearchRequest) => {
    setLastReq(req);
    setStatus("loading");
    setRadius(req.radius_m);
    try {
      const res = await search(req);
      setResults(res.results);
      setNote(res.note);
      setStatus(res.results.length === 0 ? "empty" : "ok");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unexpected error.");
      setStatus("error");
    }
  };

  const handleSearch = async (values: IntakeValues) => {
    setIntake(values);
    setStatus("loading");
    setGeoFailedMsg(null);

    let anchor: { lat: number; lon: number } | null = null;
    let geoFailed = false;
    const dest = values.destination.trim();

    if (dest) {
      try {
        const g = await geocode(values.city ? `${dest}, ${values.city}` : dest);
        if (g.found && g.lat != null && g.lon != null) {
          anchor = { lat: g.lat, lon: g.lon };
        } else {
          geoFailed = true;
        }
      } catch (e) {
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
    setCtx({
      city: values.city,
      dest: dest,
      budget: values.budget,
      commuteDays: values.commuteDays,
    });

    await runSearch(buildReq(values, anchor, RADIUS_DEFAULT));
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
    void runSearch({ ...lastReq, commute_mode: m });
  };

  const widerRadius = () => {
    if (!lastReq) return;
    void runSearch({ ...lastReq, radius_m: Math.min(lastReq.radius_m + RADIUS_STEP, RADIUS_MAX) });
  };

  const retry = () => {
    void handleSearch(intake);
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
    <div className="min-h-screen text-white">
      {/* ambient background */}
      <div className="fixed inset-0 -z-10 bg-[#030303]">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.06] via-transparent to-rose-500/[0.05]" />
      </div>

      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070707]/90 backdrop-blur-md">
          <div className="max-w-3xl mx-auto flex items-center justify-between px-5 py-3">
            <span className="font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              SiftPlace
            </span>
            {tab === "listings" ? (
              <button
                onClick={openFilter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] text-white/75 text-xs font-semibold hover:bg-white/[0.06] transition cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
              </button>
            ) : (
              <span className="w-16" />
            )}
          </div>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto px-5 py-6">
          {tab !== "listings" && <h2 className="text-xl font-bold mb-4">{TAB_TITLES[tab]}</h2>}

          {tab === "listings" &&
            (status === "loading" ? (
              <LoadingState />
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
                savedNames={savedNames}
                onToggleSave={toggleSave}
                onChangeMode={changeMode}
                geoFailedMsg={geoFailedMsg}
              />
            ))}

          {tab === "saved" && <Saved items={savedItems} onToggleSave={toggleSave} />}
          {tab === "areas" && <Areas />}
          {tab === "guide" && <Guide />}
        </main>

        <BottomNav tab={tab} onTab={goTab} savedCount={saved.size} />
      </div>

      {/* SiftPlace filter overlay */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 bg-[#030303] overflow-y-auto">
          <div className="sticky top-0 z-10 flex justify-end px-5 py-3 bg-[#030303]/80 backdrop-blur-md">
            <button
              onClick={() => setFilterOpen(false)}
              aria-label="Close filters"
              className="h-9 w-9 rounded-full border border-white/[0.1] bg-white/[0.03] text-white/60 hover:text-white flex items-center justify-center cursor-pointer"
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
