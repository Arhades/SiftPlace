import { useEffect, useState } from "react";
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

type Phase = "intake" | "results";
type Status = "loading" | "ok" | "empty" | "error";

const RADIUS_DEFAULT = 2500;
const RADIUS_MAX = 8000;
const RADIUS_STEP = 2500;
const TOP_N = 8;
const MAX_LISTINGS = 30;

const TAB_TITLES: Record<Exclude<Tab, "matches">, string> = {
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
  const [phase, setPhase] = useState<Phase>("intake");
  const [intake, setIntake] = useState<IntakeValues>(defaultIntake);

  const [status, setStatus] = useState<Status>("loading");
  const [results, setResults] = useState<ListingResult[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [geoFailedMsg, setGeoFailedMsg] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ResultsContext>({
    destLabel: "",
    city: "",
    budget: 0,
    commuteDays: 5,
  });
  const [lastReq, setLastReq] = useState<SearchRequest | null>(null);
  const [radius, setRadius] = useState(RADIUS_DEFAULT);

  const [tab, setTab] = useState<Tab>("matches");

  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("siftplace:saved");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("siftplace:saved", JSON.stringify([...saved]));
    } catch {
      // ignore storage failures (private mode, quota)
    }
  }, [saved]);

  const toggleSave = (name: string) =>
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
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

  const handleSubmit = async (values: IntakeValues) => {
    setIntake(values);
    setPhase("results");
    setTab("matches");
    setStatus("loading");
    setGeoFailedMsg(null);
    window.scrollTo(0, 0);

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
      destLabel: dest || values.city || "your city",
      city: dest ? values.city : "",
      budget: values.budget,
      commuteDays: values.commuteDays,
    });

    await runSearch(buildReq(values, anchor, RADIUS_DEFAULT));
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
    void handleSubmit(intake);
  };

  const goEdit = () => {
    setPhase("intake");
    window.scrollTo(0, 0);
  };

  const goTab = (t: Tab) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen text-white">
      {/* ambient background */}
      <div className="fixed inset-0 -z-10 bg-[#030303]">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.06] via-transparent to-rose-500/[0.05]" />
      </div>

      {phase === "intake" ? (
        <Intake initial={intake} onSubmit={handleSubmit} />
      ) : (
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070707]/90 backdrop-blur-md">
            <div className="max-w-3xl mx-auto flex items-center justify-between px-5 py-3">
              <button
                onClick={goEdit}
                className="text-xs font-medium text-white/55 hover:text-white transition cursor-pointer"
              >
                ← Edit search
              </button>
              <span className="font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                SiftPlace
              </span>
              <span className="w-16" />
            </div>
          </header>

          <main className="flex-1 max-w-3xl w-full mx-auto px-5 py-6">
            {tab !== "matches" && (
              <h2 className="text-xl font-bold mb-4">{TAB_TITLES[tab]}</h2>
            )}

            {tab === "matches" &&
              (status === "loading" ? (
                <LoadingState />
              ) : status === "error" ? (
                <ErrorState message={errorMsg} onRetry={retry} onEdit={goEdit} />
              ) : status === "empty" ? (
                <EmptyState onWider={widerRadius} onEdit={goEdit} canWiden={radius < RADIUS_MAX} />
              ) : (
                <Results
                  results={results}
                  note={note}
                  mode={lastReq?.commute_mode ?? "car"}
                  context={ctx}
                  saved={saved}
                  onToggleSave={toggleSave}
                  onChangeMode={changeMode}
                  geoFailedMsg={geoFailedMsg}
                />
              ))}

            {tab === "saved" && (
              <Saved results={results} saved={saved} onToggleSave={toggleSave} />
            )}
            {tab === "areas" && <Areas />}
            {tab === "guide" && <Guide />}
          </main>

          <BottomNav tab={tab} onTab={goTab} savedCount={saved.size} />
        </div>
      )}
    </div>
  );
}

export default App;
