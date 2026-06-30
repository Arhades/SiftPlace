import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sparkles, Search, MapPin, ArrowRight } from "lucide-react";
import type { CommuteMode, Weights } from "@/lib/api";
import { loadCities, searchCities, type CityEntry } from "@/lib/cities";
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

const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-white/45 mb-2";
const fieldCls =
  "w-full px-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/60 text-sm";

export function Intake({
  initial,
  onSubmit,
}: {
  initial: IntakeValues;
  onSubmit: (v: IntakeValues) => void;
}) {
  const [v, setV] = useState<IntakeValues>(initial);
  const update = (patch: Partial<IntakeValues>) => setV((p) => ({ ...p, ...patch }));

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

  const total = v.weights.cost + v.weights.location + v.weights.living;
  const over = total > WEIGHT_CAP;
  const timeOn = v.valueOfTime > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (over) return;
    onSubmit(v);
  };

  return (
    <form onSubmit={submit} className="max-w-xl mx-auto px-5 py-8 animate-sift-fade">
      {/* header */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4">
          <Sparkles className="h-3.5 w-3.5" /> SiftPlace
        </span>
        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
          Find your place, anywhere
        </h1>
        <p className="mt-2 text-sm text-white/45 max-w-md mx-auto">
          Tell us what matters. We rank real listings by their{" "}
          <span className="text-white/70">true monthly cost</span> — rent plus the Grab/Bolt or
          motorbike fare it takes to commute — not rent alone.
        </p>
      </div>

      {/* weights */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-5">
        <h2 className="text-sm font-bold text-white mb-1">What matters most?</h2>
        <p className="text-xs text-white/40 mb-5">
          Spread up to {WEIGHT_CAP} points. More on one means less for the rest — that trade-off is
          what matches you.
        </p>
        <WeightSliders weights={v.weights} onChange={(w) => update({ weights: w })} />
      </section>

      {/* practical */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-5 space-y-5">
        {/* city */}
        <div ref={cityBoxRef} className="relative">
          <label className={labelCls}>Which city are you moving to?</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/30">
              <Search className="h-4 w-4" />
            </span>
            <input
              className={cn(fieldCls, "pl-9")}
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
                  "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer",
                  v.city === c
                    ? "bg-indigo-500/25 border-indigo-500 text-white"
                    : "bg-white/[0.02] border-white/[0.08] text-white/55 hover:bg-white/[0.04]",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          {cityOpen && cityResults.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0b0b0b] border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl max-h-52 overflow-y-auto">
              {cityResults.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => pickCity(c.city)}
                  className="w-full px-3 py-2.5 text-left text-xs text-white/80 hover:bg-white/[0.05] flex items-center gap-2 border-b border-white/[0.03] last:border-0 cursor-pointer"
                >
                  <span>{c.flag}</span>
                  <span className="truncate">{c.city}</span>
                  <span className="text-white/30 truncate">· {c.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* destination */}
        <div>
          <label className={labelCls}>Where do you commute to?</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/30">
              <MapPin className="h-4 w-4" />
            </span>
            <input
              className={cn(fieldCls, "pl-9")}
              value={v.destination}
              placeholder="Campus or office (e.g. Chulalongkorn University)"
              onChange={(e) => update({ destination: e.target.value })}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-white/35">
            Your daily destination — we geocode it and weigh the real commute. Leave blank to search
            the city centre.
          </p>
        </div>

        {/* budget + days */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Budget /month (฿)</label>
            <input
              type="number"
              min={1000}
              step={500}
              className={fieldCls}
              value={v.budget}
              onChange={(e) => update({ budget: Number(e.target.value) })}
            />
          </div>
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
                  "py-2 rounded-xl text-xs font-medium border transition cursor-pointer",
                  v.maxCommute === o.value
                    ? "bg-indigo-500/25 border-indigo-500 text-white"
                    : "bg-white/[0.02] border-white/[0.08] text-white/55 hover:bg-white/[0.04]",
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
                  "flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer",
                  v.mode === m.value
                    ? "bg-indigo-500/20 border-indigo-500"
                    : "bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04]",
                )}
              >
                <span className="text-2xl">{m.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{m.label}</span>
                  <span className="block text-[11px] text-white/45">{m.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* value of time */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Value your time?{" "}
              <span className="normal-case font-normal text-white/30">(optional)</span>
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={timeOn}
              onClick={() => update({ valueOfTime: timeOn ? 0 : 150 })}
              className={cn(
                "relative h-6 w-11 rounded-full transition cursor-pointer",
                timeOn ? "bg-indigo-500" : "bg-white/[0.12]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                  timeOn ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
          </div>
          {timeOn && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-white/50">฿</span>
              <input
                type="number"
                min={0}
                step={10}
                className={cn(fieldCls, "max-w-28")}
                value={v.valueOfTime}
                onChange={(e) => update({ valueOfTime: Math.max(0, Number(e.target.value)) })}
              />
              <span className="text-xs text-white/50">per hour of commuting</span>
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-white/35">
            We'll add a "true cost incl. time" so ranking weighs hours, not just baht.
          </p>
        </div>
      </section>

      {/* preferences */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-5 space-y-5">
        <div>
          <label className={labelCls}>What do you want nearby?</label>
          <ChipSelect multiple options={NEARBY_OPTIONS} value={v.nearby} onChange={(n) => update({ nearby: n })} />
        </div>
        <div>
          <label className={labelCls}>Street vibe</label>
          <ChipSelect options={VIBE_OPTIONS} value={v.vibe} onChange={(val) => update({ vibe: val })} />
        </div>
        <div>
          <label className={labelCls}>Place type</label>
          <ChipSelect multiple options={TYPE_OPTIONS} value={v.types} onChange={(t) => update({ types: t })} />
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
      </section>

      <button
        type="submit"
        disabled={over}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-rose-500 hover:from-indigo-600 hover:to-rose-600 text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/20 active:scale-[0.99]"
      >
        {over ? (
          "Ease your priorities to 20 or less"
        ) : (
          <>
            Find my best matches <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
