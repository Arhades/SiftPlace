import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import Landing from "@/components/Landing";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";
import { 
  fetchSavedListings, 
  saveListingToCloud, 
  deleteListingFromCloud, 
  syncLocalSavesToCloud 
} from "@/lib/savedListings";
import {
  geocode,
  getFloodRisk,
  getRates,
  search,
  type CommuteMode,
  type FloodRisk,
  type ListingResult,
  type ParsedNotes,
  type SearchRequest,
} from "@/lib/api";
import { setRates } from "@/lib/currency";
import { withMode } from "@/lib/fare";
import { nextQuarterMonths, stayMonthsList, staySpansRainySeason } from "@/lib/utils";
import { FEATURED_CENTRE, FEATURED_LISTINGS, FEATURED_NOTE } from "@/data/featured";
import { Intake, defaultIntake, type IntakeValues } from "@/components/Intake";
import { Results, type ResultsContext } from "@/components/Results";
import { Saved } from "@/components/Saved";
import { Areas } from "@/components/Areas";
import { Guide } from "@/components/Guide";
import { SiftChat } from "@/components/SiftChat";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { LoadingState, EmptyState, ErrorState } from "@/components/States";

type Status = "loading" | "ok" | "empty" | "error";

const RADIUS_DEFAULT = 2500;
const RADIUS_MAX = 8000;
const RADIUS_STEP = 2500;
const PAGE_SIZE = 6; // 3×2 grid
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
  page = 1,
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
    other_terms: [], // the "Other…" chips were removed — notes + the Sift chat cover free text
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
    top_n: PAGE_SIZE,
    page,
    page_size: PAGE_SIZE,
    lease_types: v.leaseTypes,
    allow_training: v.allowTraining,
  };
}

function App() {
  const [view, setView] = useState<'landing' | 'app'>(() => {
    const landed = sessionStorage.getItem("siftplace:landed");
    return landed === "1" ? "app" : "landing";
  });
  const [session, setSession] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [intake, setIntake] = useState<IntakeValues>(defaultIntake);
  const [filterOpen, setFilterOpen] = useState(false);

  // Solar Friend theme toggle — warm light by default, warm dark on demand.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "";
  }, [dark]);

  // Saved listings are stored in full (not just by name) so the Compare table
  // works across searches and survives reloads.
  const [saved, setSaved] = useState<Map<string, ListingResult>>(new Map());

  // Auth & Sync Handling
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        setView("app");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        setView("app");
        // Sync local saves to cloud
        try {
          const localRaw = localStorage.getItem("siftplace:saved");
          const localArr = localRaw ? (JSON.parse(localRaw) as ListingResult[]) : [];
          if (localArr.length > 0) {
            await syncLocalSavesToCloud(localArr);
            localStorage.removeItem("siftplace:saved");
          }
          const cloudListings = await fetchSavedListings();
          setSaved(new Map(cloudListings.map(l => [l.name, l])));
        } catch (err) {
          console.error("Sync failed:", err);
        }
      } else {
        // Logged out: fallback to local storage
        try {
          const raw = localStorage.getItem("siftplace:saved");
          const arr = raw ? (JSON.parse(raw) as ListingResult[]) : [];
          setSaved(new Map(arr.map((l) => [l.name, l])));
        } catch {
          setSaved(new Map());
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // FX table for displaying prices in the user's currency. On failure we keep
  // the labelled fallback table AND tell the user amounts are approximate —
  // silently wrong prices are worse than an honest notice.
  const [fxStale, setFxStale] = useState(false);
  useEffect(() => {
    getRates()
      .then((r) => {
        setRates(r);
        setFxStale(false);
      })
      .catch(() => setFxStale(true));
  }, []);

  // Instant first screen: curated Bangkok picks from the local seed — rendered
  // with ZERO API calls, so the app never opens empty or spinning. The first
  // real search replaces them.
  const [status, setStatus] = useState<Status>("ok");
  const [results, setResults] = useState<ListingResult[]>(FEATURED_LISTINGS);
  const [isFeatured, setIsFeatured] = useState(true);
  const [note, setNote] = useState<string | null>(FEATURED_NOTE);
  const [errorMsg, setErrorMsg] = useState("");
  const [geoFailedMsg, setGeoFailedMsg] = useState<string | null>(null);
  const [flood, setFlood] = useState<FloodRisk | null>(null);
  // whether the flood card covers the user's stay months or the next quarter
  const [floodScope, setFloodScope] = useState<"stay" | "quarter">("quarter");
  const [ctx, setCtx] = useState<ResultsContext>({
    city: "Bangkok", dest: "", budget: 20000, currency: "THB", commuteDays: 5,
    rainySeason: false, stayMonths: null, radiusUsed: null, parsed: null,
    featured: true,
  });
  const [lastReq, setLastReq] = useState<SearchRequest | null>(null);
  const [radius, setRadius] = useState(RADIUS_DEFAULT);
  const [pageInfo, setPageInfo] = useState({
    page: 1, totalPages: 1, total: FEATURED_LISTINGS.length,
  });

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

  // Flood risk for the instant featured screen: the curated picks are all
  // around the Siam/Chula anchor, so fetch that area's next-quarter card once
  // on mount (best effort). A real search replaces it with the searched area's.
  useEffect(() => {
    const seqAtMount = seqRef.current;
    getFloodRisk(FEATURED_CENTRE[0], FEATURED_CENTRE[1], nextQuarterMonths())
      .then((f) => {
        // a search started meanwhile owns the card now — don't overwrite it
        if (seqRef.current === seqAtMount) setFlood(f);
      })
      .catch(() => {});
  }, []);

  const toggleSave = async (l: ListingResult) => {
    const hasListing = saved.has(l.name);
    
    setSaved((prev) => {
      const next = new Map(prev);
      if (next.has(l.name)) next.delete(l.name);
      else next.set(l.name, l);
      return next;
    });

    if (session) {
      try {
        if (hasListing) {
          await deleteListingFromCloud(l.name);
        } else {
          await saveListingToCloud(l);
        }
      } catch (err) {
        console.error("Cloud toggle save failed:", err);
      }
    } else {
      try {
        const raw = localStorage.getItem("siftplace:saved");
        const arr = raw ? (JSON.parse(raw) as ListingResult[]) : [];
        let nextArr;
        if (hasListing) {
          nextArr = arr.filter((x: ListingResult) => x.name !== l.name);
        } else {
          nextArr = [...arr, l];
        }
        localStorage.setItem("siftplace:saved", JSON.stringify(nextArr));
      } catch {
        // ignore storage errors
      }
    }
  };

  const runSearch = async (
    req: SearchRequest,
    handle?: { seq: number; signal: AbortSignal },
    ctxPatch?: Partial<ResultsContext>,
  ) => {
    const { seq, signal } = handle ?? beginSearch();
    setLastReq(req);
    setRadius(req.radius_m);
    try {
      const res = await search(req, signal);
      if (isStale(seq)) return;
      setResults(res.results);
      setIsFeatured(false);
      setNote(res.note);
      setPageInfo({
        page: res.page ?? 1,
        totalPages: res.total_pages ?? 1,
        total: res.total ?? res.results.length,
      });
      setCtx((p) => ({
        ...p,
        ...ctxPatch,
        budget: req.budget,
        currency: req.currency,
        commuteDays: req.commute_days,
        rainySeason: staySpansRainySeason(req.check_in ?? "", req.check_out ?? ""),
        stayMonths: res.stay_months,
        radiusUsed: res.radius_used,
        parsed: res.parsed,
        featured: false,
      }));
      setStatus(res.results.length === 0 ? "empty" : "ok");
      if (res.centre) {
        // per-month flood risk for the searched area (non-blocking, best
        // effort): the user's stay months, or the next quarter without dates
        const stayMonths = stayMonthsList(req.check_in ?? "", req.check_out ?? "");
        getFloodRisk(res.centre[0], res.centre[1], stayMonths ?? nextQuarterMonths(), signal)
          .then((f) => {
            if (!isStale(seq)) {
              setFlood(f);
              setFloodScope(stayMonths ? "stay" : "quarter");
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      if (isStale(seq) || (e instanceof DOMException && e.name === "AbortError")) return;
      setErrorMsg(e instanceof Error ? e.message : "Unexpected error.");
      setStatus("error");
    }
  };

  const handleSearch = async (values: IntakeValues, force = false) => {
    setIntake(values);

    // identical intake + a usable result on screen -> reuse it, don't refetch
    // (force=true bypasses this for the explicit Retry button; the featured
    // seed never counts as a usable search result)
    const fingerprint = JSON.stringify(values);
    if (!force && !isFeatured && fingerprint === lastSubmitRef.current
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

    await runSearch(buildReq(values, anchor, RADIUS_DEFAULT), handle, {
      city: values.city,
      dest,
    });
  };

  const applyFilters = (values: IntakeValues) => {
    setFilterOpen(false);
    setTab("listings");
    window.scrollTo(0, 0);
    void handleSearch(values);
  };

  // Commute-mode toggle: pure CLIENT-SIDE swap from the per-mode `fares` the
  // backend already returned — no refetch, no rate-limit slot burned. Scores
  // stay as ranked; the next real search re-ranks with the new mode.
  const changeMode = (m: CommuteMode) => {
    if (m === intake.mode) return;
    const valueOfTime = intake.valueOfTime;
    setIntake((p) => ({ ...p, mode: m }));
    setLastReq((r) => (r ? { ...r, commute_mode: m } : r));
    setResults((rs) => rs.map((r) => withMode(r, m, valueOfTime)));
  };

  const goPage = (p: number) => {
    if (!lastReq || p < 1 || p > pageInfo.totalPages || p === pageInfo.page) return;
    window.scrollTo(0, 0);
    void runSearch({ ...lastReq, page: p });
  };

  const widerRadius = () => {
    if (!lastReq) return;
    void runSearch({
      ...lastReq,
      page: 1,
      radius_m: Math.min(lastReq.radius_m + RADIUS_STEP, RADIUS_MAX),
    });
  };

  const retry = () => {
    void handleSearch(intake, true);
  };

  // The Sift mascot extracted structured demands — apply them to the filters
  // (visibly: chips change) and re-run the search, exactly like the form would.
  const applyChatDemands = (parsed: ParsedNotes, userText: string) => {
    const values: IntakeValues = { ...intake };
    (["amenities", "nearby", "types"] as const).forEach((bucket) => {
      const merged = [...values[bucket]];
      for (const key of parsed[bucket]) if (!merged.includes(key)) merged.push(key);
      values[bucket] = merged;
    });
    if (parsed.vibe && !values.vibe) values.vibe = parsed.vibe;
    const weights = { ...values.weights };
    (["cost", "location", "living"] as const).forEach((axis) => {
      const delta = parsed.weight_nudges[axis];
      if (delta) weights[axis] = Math.max(0, Math.min(10, weights[axis] + delta));
    });
    // keep the 20-point cap the sliders enforce: trim the heaviest axis
    while (weights.cost + weights.location + weights.living > 20) {
      const heaviest = (["cost", "location", "living"] as const)
        .reduce((a, b) => (weights[a] >= weights[b] ? a : b));
      weights[heaviest] -= 1;
    }
    values.weights = weights;
    // carry the plain-language ask so the backend NLP + semantic layer see it
    values.notes = [values.notes, userText].filter(Boolean).join(". ").slice(-500);
    setTab("listings");
    void handleSearch(values);
  };

  const filtersSummary = [
    `city ${intake.city || "?"}`,
    intake.destination && `commute to ${intake.destination}`,
    `budget ${intake.budget} ${intake.currency}/mo`,
    intake.nearby.length > 0 && `nearby: ${intake.nearby.join(", ")}`,
    intake.vibe && `vibe ${intake.vibe}`,
    intake.amenities.length > 0 && `amenities: ${intake.amenities.join(", ")}`,
    intake.types.length > 0 && `types: ${intake.types.join(", ")}`,
  ]
    .filter(Boolean)
    .join("; ");

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

  if (view === "landing") {
    return (
      <>
        <Landing 
          onGuest={() => {
            sessionStorage.setItem("siftplace:landed", "1");
            setView("app");
          }} 
          onLogin={() => setAuthModalOpen(true)}
          dark={dark}
          setDark={setDark}
        />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            setAuthModalOpen(false);
            setView("app");
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen text-ink">
      {/* ambient background */}
      <div className="fixed inset-0 -z-10 bg-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.10] via-transparent to-secondary/[0.08]" />
      </div>

      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3">
            <span 
              onClick={() => {
                setTab("listings");
                window.scrollTo(0, 0);
              }} 
              className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition"
            >
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
              {session ? (
                <div className="flex items-center gap-2">
                  <span className="hidden md:inline text-[11px] font-bold text-muted bg-surface-low border border-line px-2.5 py-1 rounded-full">
                    👤 {session.user?.email}
                  </span>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      sessionStorage.removeItem("siftplace:landed");
                      setView("landing");
                    }}
                    className="px-3 py-2 rounded-full border-2 border-line bg-lowest text-ink text-xs font-bold hover:bg-surface-c transition cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="px-3.5 py-2 rounded-full border-2 border-line bg-lowest text-ink text-xs font-bold hover:bg-surface-c transition cursor-pointer"
                >
                  Sign In
                </button>
              )}
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

        <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-6">
          {fxStale && ctx.currency !== "THB" && (
            <p className="mb-4 text-[11px] font-semibold text-warn bg-warn-soft rounded-xl px-3 py-2">
              ⚠️ Live exchange rates are unavailable — amounts in {ctx.currency} use an
              approximate fallback rate.
            </p>
          )}

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
                mode={intake.mode}
                context={ctx}
                flood={flood}
                floodScope={floodScope}
                savedNames={savedNames}
                onToggleSave={toggleSave}
                onChangeMode={changeMode}
                geoFailedMsg={geoFailedMsg}
                page={pageInfo.page}
                totalPages={pageInfo.totalPages}
                total={pageInfo.total}
                onPage={goPage}
              />
            ))}

          {tab === "saved" && <Saved items={savedItems} onToggleSave={toggleSave} currency={ctx.currency} />}
          {tab === "areas" && (
            <Areas
              savedNames={savedNames}
              onToggleSave={toggleSave}
              currency={ctx.currency}
              floodMonths={stayMonthsList(intake.checkIn, intake.checkOut) ?? nextQuarterMonths()}
            />
          )}
          {tab === "guide" && <Guide />}
        </main>

        <BottomNav tab={tab} onTab={goTab} savedCount={saved.size} />
      </div>

      {/* the Sift mascot — hidden while the filter overlay is up */}
      {!filterOpen && (
        <SiftChat filtersSummary={filtersSummary} onDemands={applyChatDemands} />
      )}

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

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
          setView("app");
        }}
      />
    </div>
  );
}

export default App;
