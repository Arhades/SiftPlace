import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, MapPin, ArrowRight, Sparkles, Users, CalendarDays } from "lucide-react";
import { Logo } from "@/components/Logo";
import { parseNotes, type CommuteMode, type ParsedNotes, type Weights } from "@/lib/api";
import { loadCities, searchCities, type CityEntry } from "@/lib/cities";
import { CURRENCIES, SYMBOLS, fromTHB, toTHB } from "@/lib/currency";
import {
  AMENITY_OPTIONS,
  MAX_COMMUTE_OPTIONS,
  MODE_OPTIONS,
  NEARBY_OPTIONS,
  TYPE_OPTIONS,
  VIBE_OPTIONS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChipSelect } from "./ChipSelect";
import { WeightSliders, WEIGHT_CAP } from "./WeightSliders";

export interface IntakeValues {
  weights: Weights;
  budget: number;
  currency: string;
  checkIn: string; // ISO date or ""
  checkOut: string;
  occupancy: number;
  notes: string;
  commuteDays: number;
  maxCommute: number;
  mode: CommuteMode;
  valueOfTime: number; // 0 = off
  city: string;
  destination: string;
  nearby: string[];
  vibe: string;
  types: string[];
  amenities: string[];
}

export function defaultIntake(): IntakeValues {
  return {
    weights: { cost: 8, location: 8, living: 4 },
    budget: 20000,
    currency: "THB",
    checkIn: "",
    checkOut: "",
    occupancy: 1,
    notes: "",
    commuteDays: 5,
    maxCommute: 40,
    mode: "car",
    valueOfTime: 0,
    city: "Bangkok",
    destination: "",
    nearby: ["gym", "supermarket", "transit"],
    vibe: "",
    types: ["condo", "hostel", "hotel"],
    amenities: ["wifi", "desk"],
  };
}

const FEATURED_CITIES = ["Bangkok", "Tokyo", "Seoul", "Singapore"];

/** Does any part of the stay fall in Bangkok's Sep–Oct rainy/flood window? */
function staySpansRainySeason(checkIn: string, checkOut: string): boolean {
  if (!checkIn || !checkOut) return false;
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  if (!(a < b)) return false;
  const d = new Date(a);
  while (d <= b) {
    const m = d.getMonth() + 1;
    if (m === 9 || m === 10) return true;
    d.setMonth(d.getMonth() + 1, 1);
  }
  return false;
}

function stayMonths(checkIn: string, checkOut: string): number | null {
  if (!checkIn || !checkOut) return null;
  const days = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000;
  return days > 0 ? Math.round((days / 30.4) * 10) / 10 : null;
}

const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-muted mb-2";
const fieldCls = "sf-field";

export function Intake({
  initial,
  onSubmit,
}: {
  initial: IntakeValues;
  onSubmit: (v: IntakeValues) => void;
}) {
  const [v, setV] = useState<IntakeValues>(initial);
  const update = (patch: Partial<IntakeValues>) => setV((p) => ({ ...p, ...patch }));

  // Budget is edited through a string draft so the field can be emptied while
  // retyping. Binding the number directly re-clamps "" to 1 on every keystroke,
  // which made the first digit impossible to replace.
  const [budgetText, setBudgetText] = useState(String(initial.budget));
  const onBudgetType = (raw: string) => {
    setBudgetText(raw);
    const n = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(n) && n >= 1) {
      update({ budget: n });
    }
  };
  const onBudgetBlur = () => {
    // leaving the field empty/invalid falls back to the last good value
    setBudgetText(String(v.budget));
  };

  // City type-ahead (reuses the waitlist's world-city directory)
  const [allCities, setAllCities] = useState<CityEntry[]>([]);
  const [cityResults, setCityResults] = useState<CityEntry[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const cityBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    loadCities()
      .then((list) => {
        if (active) setAllCities(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (cityBoxRef.current && !cityBoxRef.current.contains(e.target as Node)) setCityOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const onCityType = (val: string) => {
    update({ city: val });
    setCityResults(val.trim().length >= 2 ? searchCities(allCities, val, 6) : []);
    setCityOpen(true);
  };
  const pickCity = (name: string) => {
    update({ city: name });
    setCityResults([]);
    setCityOpen(false);
  };

  // Live "here's what we understood" preview for the free-text note (debounced).
  const [parsed, setParsed] = useState<ParsedNotes | null>(null);
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNotesChange = (text: string) => {
    update({ notes: text });
    if (parseTimer.current) clearTimeout(parseTimer.current);
    if (!text.trim()) {
      setParsed(null);
      return;
    }
    parseTimer.current = setTimeout(() => {
      parseNotes(text)
        .then(setParsed)
        .catch(() => setParsed(null));
    }, 600);
  };

  const changeCurrency = (cur: string) => {
    // keep the budget the same real value, re-expressed in the new currency
    const converted = Math.max(1, Math.round(fromTHB(toTHB(v.budget, v.currency), cur)));
    update({ currency: cur, budget: converted });
    setBudgetText(String(converted));
  };

  const total = v.weights.cost + v.weights.location + v.weights.living;
  const over = total > WEIGHT_CAP;
  const timeOn = v.valueOfTime > 0;
  const months = stayMonths(v.checkIn, v.checkOut);
  const rainy = staySpansRainySeason(v.checkIn, v.checkOut);
  const todayIso = new Date().toISOString().slice(0, 10);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (over) return;
    onSubmit(v);
  };

  return (
    <form onSubmit={submit} className="max-w-xl mx-auto px-5 py-8 animate-sift-fade">
      {/* header */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-lowest border-2 border-line shadow-[0_4px_14px_-8px_rgba(44,22,14,0.35)] text-muted text-xs font-bold mb-4">
          <Logo size={26} />
          SiftPlace filter
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Filter &amp; rank
        </h1>
        <p className="mt-2 text-sm text-muted max-w-md mx-auto font-medium">
          Set what matters and we re-rank every listing by its{" "}
          <span className="text-ink font-bold">true monthly cost</span> — rent plus what your
          commute actually costs in fares and time — not rent alone.
        </p>
      </div>

      {/* weights */}
      <section className="sf-well p-5 mb-5">
        <h2 className="text-base font-bold text-ink mb-1">What matters most?</h2>
        <p className="text-xs text-muted mb-5 font-medium">
          Spread up to {WEIGHT_CAP} points. More on one means less for the rest — that trade-off is
          what matches you.
        </p>
        <WeightSliders weights={v.weights} onChange={(w) => update({ weights: w })} />
      </section>

      {/* practical */}
      <section className="sf-well p-5 mb-5 space-y-5">
        {/* city */}
        <div ref={cityBoxRef} className="relative">
          <label className={labelCls}>Which city are you moving to?</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-muted">
              <Search className="h-4 w-4" />
            </span>
            <input
              className={cn(fieldCls, "pl-10")}
              value={v.city}
              placeholder="e.g. Bangkok, Tokyo, Lisbon"
              onChange={(e) => onCityType(e.target.value)}
              onFocus={() => {
                if (v.city.trim().length >= 2) setCityOpen(true);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {FEATURED_CITIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pickCity(c)}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-bold border-2 transition cursor-pointer",
                  v.city === c
                    ? "bg-primary/25 border-primary-dim text-ink"
                    : "bg-lowest border-line text-muted hover:bg-surface-c",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          {cityOpen && cityResults.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-lowest border border-line rounded-2xl overflow-hidden shadow-[0_10px_30px_-12px_rgba(120,89,0,0.28)] max-h-52 overflow-y-auto">
              {cityResults.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => pickCity(c.city)}
                  className="w-full px-3 py-2.5 text-left text-xs text-ink font-semibold hover:bg-surface-c flex items-center gap-2 border-b border-line last:border-0 cursor-pointer"
                >
                  <span>{c.flag}</span>
                  <span className="truncate">{c.city}</span>
                  <span className="text-muted truncate">· {c.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* destination */}
        <div>
          <label className={labelCls}>Where do you commute to?</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-muted">
              <MapPin className="h-4 w-4" />
            </span>
            <input
              className={cn(fieldCls, "pl-10")}
              value={v.destination}
              placeholder="Campus or office (e.g. Chulalongkorn University)"
              onChange={(e) => update({ destination: e.target.value })}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted font-medium">
            Your daily destination — we geocode it and weigh the real commute. Leave blank to search
            the city centre.
          </p>
        </div>

        {/* dates */}
        <div>
          <label className={labelCls}>
            <CalendarDays className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            When are you staying?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="date"
                className={fieldCls}
                value={v.checkIn}
                min={todayIso}
                aria-label="Check-in date"
                onChange={(e) => update({ checkIn: e.target.value })}
              />
              <p className="mt-1 text-[10px] text-muted font-bold uppercase tracking-wide text-center">Check-in</p>
            </div>
            <div>
              <input
                type="date"
                className={fieldCls}
                value={v.checkOut}
                min={v.checkIn || todayIso}
                aria-label="Check-out date"
                onChange={(e) => update({ checkOut: e.target.value })}
              />
              <p className="mt-1 text-[10px] text-muted font-bold uppercase tracking-wide text-center">Check-out</p>
            </div>
          </div>
          {months != null && (
            <p className="mt-1.5 text-[11px] text-muted font-medium">
              ≈ <span className="font-bold text-ink">{months} months</span> — we'll prefer places
              that take stays this long.
            </p>
          )}
          {rainy && (
            <p className="mt-1.5 text-[11px] font-semibold text-warn bg-warn-soft rounded-xl px-3 py-2">
              🌧️ Your stay overlaps Sep–Oct — Bangkok's rainy / flood season. Check each area's
              flood risk on the results.
            </p>
          )}
        </div>

        {/* budget + currency + occupancy */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Budget /month</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                step="any"
                inputMode="numeric"
                className={cn(fieldCls, "min-w-0")}
                value={budgetText}
                onChange={(e) => onBudgetType(e.target.value)}
                onBlur={onBudgetBlur}
              />
              <select
                aria-label="Budget currency"
                className={cn(fieldCls, "w-auto shrink-0 px-3 cursor-pointer")}
                value={v.currency}
                onChange={(e) => changeCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {SYMBOLS[c]} {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>
              <Users className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              People staying
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Fewer people"
                onClick={() => update({ occupancy: Math.max(1, v.occupancy - 1) })}
                className="h-11 w-11 shrink-0 rounded-full border-2 border-line bg-lowest text-ink font-bold text-lg hover:bg-surface-c cursor-pointer"
              >
                −
              </button>
              <span className="flex-1 text-center text-lg font-bold text-ink">{v.occupancy}</span>
              <button
                type="button"
                aria-label="More people"
                onClick={() => update({ occupancy: Math.min(8, v.occupancy + 1) })}
                className="h-11 w-11 shrink-0 rounded-full border-2 border-line bg-lowest text-ink font-bold text-lg hover:bg-surface-c cursor-pointer"
              >
                +
              </button>
            </div>
            {v.occupancy > 2 && (
              <p className="mt-1 text-[11px] text-muted font-medium">
                Groups of {v.occupancy} need real space — dorm-style places rank lower.
              </p>
            )}
          </div>
        </div>

        {/* commute days */}
        <div>
          <label className={labelCls}>Days commuting /week</label>
          <input
            type="number"
            min={0}
            max={7}
            className={fieldCls}
            value={v.commuteDays}
            onChange={(e) => update({ commuteDays: Math.max(0, Math.min(7, Number(e.target.value))) })}
          />
        </div>

        {/* max commute */}
        <div>
          <label className={labelCls}>Longest commute you'd accept</label>
          <div className="grid grid-cols-4 gap-2">
            {MAX_COMMUTE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => update({ maxCommute: o.value })}
                className={cn(
                  "py-2 rounded-full text-xs font-bold border-2 transition cursor-pointer",
                  v.maxCommute === o.value
                    ? "bg-primary/25 border-primary-dim text-ink"
                    : "bg-lowest border-line text-muted hover:bg-surface-c",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* mode */}
        <div>
          <label className={labelCls}>How will you commute?</label>
          <div className="grid grid-cols-2 gap-3">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => update({ mode: m.value })}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition cursor-pointer",
                  v.mode === m.value
                    ? "bg-primary/20 border-primary-dim"
                    : "bg-lowest border-line hover:bg-surface-c",
                )}
              >
                <span className="text-2xl">{m.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{m.label}</span>
                  <span className="block text-[11px] text-muted font-medium">{m.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* value of time */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Value your time?{" "}
              <span className="normal-case font-medium text-muted/70">(optional)</span>
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={timeOn}
              onClick={() => update({ valueOfTime: timeOn ? 0 : 150 })}
              className={cn(
                "relative h-6 w-11 rounded-full transition cursor-pointer",
                timeOn ? "bg-primary-dim" : "bg-surface-high",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-lowest shadow transition-all",
                  timeOn ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
          </div>
          {timeOn && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted font-bold">฿</span>
              <input
                type="number"
                min={0}
                step={10}
                className={cn(fieldCls, "max-w-28")}
                value={v.valueOfTime}
                onChange={(e) => update({ valueOfTime: Math.max(0, Number(e.target.value)) })}
              />
              <span className="text-xs text-muted font-medium">per hour of commuting</span>
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-muted font-medium">
            We'll add a "true cost incl. time" so ranking weighs hours, not just baht.
          </p>
        </div>
      </section>

      {/* preferences */}
      <section className="sf-well p-5 mb-5 space-y-5">
        <div>
          <label className={labelCls}>What do you want nearby?</label>
          <ChipSelect
            multiple
            options={NEARBY_OPTIONS}
            value={v.nearby}
            onChange={(n) => update({ nearby: n })}
          />
        </div>
        <div>
          <label className={labelCls}>Street vibe</label>
          <ChipSelect
            options={VIBE_OPTIONS}
            value={v.vibe}
            onChange={(val) => update({ vibe: val })}
          />
        </div>
        <div>
          <label className={labelCls}>Place type</label>
          <ChipSelect
            multiple
            options={TYPE_OPTIONS}
            value={v.types}
            onChange={(t) => update({ types: t })}
          />
        </div>
        <div>
          <label className={labelCls}>Must-have amenities</label>
          <ChipSelect
            multiple
            options={AMENITY_OPTIONS}
            value={v.amenities}
            onChange={(a) => update({ amenities: a })}
          />
        </div>

        {/* free-text NLP */}
        <div>
          <label className={labelCls}>
            <Sparkles className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            Anything else? <span className="normal-case font-medium text-muted/70">(optional)</span>
          </label>
          <textarea
            className={cn(fieldCls, "rounded-3xl min-h-24 resize-y")}
            value={v.notes}
            placeholder='Tell us in your own words — "quiet street, pet friendly, near a Muay Thai gym, I hate long commutes…"'
            onChange={(e) => onNotesChange(e.target.value)}
          />
          {parsed && parsed.detected.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] text-muted font-bold mb-1.5">
                Got it — we detected{parsed.engine.includes("model") ? " (AI)" : ""}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {parsed.detected.map((d) => (
                  <span
                    key={d}
                    className="px-2.5 py-1 rounded-full bg-ok-soft text-ok text-[11px] font-bold"
                  >
                    ✓ {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <button
        type="submit"
        disabled={over}
        className="sf-cta w-full flex items-center justify-center gap-2 py-3.5 text-base cursor-pointer"
      >
        {over ? (
          "Ease your priorities to 20 or less"
        ) : (
          <>
            Apply filters <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
