import { supabase } from '../lib/supabaseClient'
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, Mail, Building, Clock, Shield, Users, Search, HelpCircle, MapPin } from "lucide-react";
import { getUniversityFromEmail } from "@/lib/utils";
import { UNIVERSITY_PRESETS, loadUniversities, searchUniversities, type UniversityPreset } from "@/lib/universities";
import { loadCities, searchCities, type CityEntry } from "@/lib/cities";

interface SurveyData {
  city: string;
  painPoint: string;
  deskNeeded: string;
}

// One-tap quick picks shown above the full searchable world-city directory.
const FEATURED_CITIES = [
  { city: "Bangkok", flag: "🇹🇭", label: "Bangkok, Thailand" },
  { city: "Tokyo", flag: "🇯🇵", label: "Tokyo, Japan" },
  { city: "Seoul", flag: "🇰🇷", label: "Seoul, Republic of Korea" },
  { city: "Singapore", flag: "🇸🇬", label: "Singapore, Singapore" },
];

const COUNTRIES = [
  { name: "United States", code: "US", flag: "🇺🇸" },
  { name: "United Kingdom", code: "GB", flag: "🇬🇧" },
  { name: "Singapore", code: "SG", flag: "🇸🇬" },
  { name: "Thailand", code: "TH", flag: "🇹🇭" },
  { name: "Germany", code: "DE", flag: "🇩🇪" },
  { name: "France", code: "FR", flag: "🇫🇷" },
  { name: "Japan", code: "JP", flag: "🇯🇵" },
  { name: "South Korea", code: "KR", flag: "🇰🇷" },
  { name: "Australia", code: "AU", flag: "🇦🇺" },
  { name: "Canada", code: "CA", flag: "🇨🇦" },
  { name: "Hong Kong", code: "HK", flag: "🇭🇰" },
  { name: "Switzerland", code: "CH", flag: "🇨🇭" },
  { name: "Netherlands", code: "NL", flag: "🇳🇱" },
  { name: "Italy", code: "IT", flag: "🇮🇹" },
  { name: "Spain", code: "ES", flag: "🇪🇸" },
  { name: "Sweden", code: "SE", flag: "🇸🇪" },
  { name: "Denmark", code: "DK", flag: "🇩🇰" },
  { name: "China", code: "CN", flag: "🇨🇳" },
  { name: "Taiwan", code: "TW", flag: "🇹🇼" },
  { name: "India", code: "IN", flag: "🇮🇳" },
  { name: "Vietnam", code: "VN", flag: "🇻🇳" },
  { name: "Indonesia", code: "ID", flag: "🇮🇩" },
  { name: "Malaysia", code: "MY", flag: "🇲🇾" },
  { name: "Other / International", code: "OTHER", flag: "🌐" }
].sort((a, b) => a.name.localeCompare(b.name));

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [step, setStep] = useState<"email" | "uni" | "city" | "prefs" | "success">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);

  // Global signup counts pulled from Supabase (shared across all visitors, live)
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [joinedPosition, setJoinedPosition] = useState(0);
  
  // University search and custom entry states
  const [selectedUni, setSelectedUni] = useState("");
  const [uniSearch, setUniSearch] = useState("");
  const [uniResults, setUniResults] = useState<UniversityPreset[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [customUni, setCustomUni] = useState("");
  const [customCountryFlag, setCustomCountryFlag] = useState("🌐");

  // Cached global directories (fetched once, then filtered locally for instant search)
  const [allUnis, setAllUnis] = useState<UniversityPreset[]>([]);
  const [allCities, setAllCities] = useState<CityEntry[]>([]);

  // City search states
  const [citySearch, setCitySearch] = useState("");
  const [cityResults, setCityResults] = useState<CityEntry[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<{ label: string; flag: string } | null>(null);

  // Step 3 "Other" pain point states
  const [isOtherPain, setIsOtherPain] = useState(false);
  const [customPain, setCustomPain] = useState("");

  const [survey, setSurvey] = useState<SurveyData>({
    city: "",
    painPoint: "",
    deskNeeded: "",
  });

  // Warm the global directories once so the search boxes respond instantly.
  // Universities first (needed on step 1), then cities (needed on step 2).
  useEffect(() => {
    let active = true;
    loadUniversities()
      .then((list) => { if (active) setAllUnis(list); })
      .catch((err) => console.warn("University directory load failed, using presets:", err));

    setCitiesLoading(true);
    loadCities()
      .then((list) => { if (active) setAllCities(list); })
      .catch((err) => console.warn("City directory load failed:", err))
      .finally(() => { if (active) setCitiesLoading(false); });

    return () => { active = false; };
  }, []);

  // Re-run the active university query once the full directory finishes loading.
  useEffect(() => {
    if (allUnis.length && uniSearch.trim().length >= 2) {
      setUniResults(searchUniversities(allUnis, uniSearch, 8));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUnis]);

  // Re-run the active city query once the full directory finishes loading.
  useEffect(() => {
    if (allCities.length && citySearch.trim().length >= 2) {
      setCityResults(searchCities(allCities, citySearch, 8));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCities]);

  // Keep the live signup counter (header + progress bar) in sync with Supabase.
  const refreshCount = async () => {
    const { data, error } = await supabase.rpc("get_waitlist_count");
    if (!error && data != null) setWaitlistCount(Number(data));
  };
  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 5000);
    return () => clearInterval(t);
  }, []);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    // Store one canonical form so "A@x.com" and "a@x.com" are treated as the same person.
    const normalizedEmail = email.trim().toLowerCase();
    const uniInfo = getUniversityFromEmail(normalizedEmail);
    // Only trust the email-domain guess when it maps to a known school (real flag).
    // Generic providers (gmail, etc.) return a placeholder like "Gmail Uni" + 🌐 —
    // we don't store or pre-fill those.
    const recognizedUni = uniInfo.flag !== "🌐";

    // Insert into Supabase. A UNIQUE constraint on the email column enforces
    // de-duplication at the database level (race-proof), returning Postgres
    // error 23505 on a repeat — we surface that as a friendly message.
    // The id is generated client-side so we can attach survey answers later
    // without needing read access to the (privacy-protected) table.
    const newId = crypto.randomUUID();
    const { error } = await supabase
      .from("waitlist")
      .insert([{
        id: newId,
        email: normalizedEmail,
        university: recognizedUni ? uniInfo.name : null,
        university_flag: recognizedUni ? uniInfo.flag : null,
      }]);

    if (error) {
      setIsLoading(false);
      if (error.code === "23505") {
        setEmailError("This email is already registered on the waitlist.");
      } else {
        console.error("Supabase error:", error);
        setEmailError("Something went wrong saving your spot. Please try again.");
      }
      return;
    }

    setRowId(newId);

    // Pull the live total so the success screen shows a real global position.
    const { data: countData } = await supabase.rpc("get_waitlist_count");
    const total = countData != null ? Number(countData) : waitlistCount + 1;
    setWaitlistCount(total);
    setJoinedPosition(total);

    // Pre-fill the university search only when we recognised the school.
    if (recognizedUni) {
      setUniSearch(uniInfo.name);
      handleUniSearchChange(uniInfo.name);
    }

    setIsLoading(false);
    setStep("uni");
  };

  // Instant local lookup against the cached global directory. While the full
  // directory is still downloading, fall back to the bundled presets so the box
  // is never blocked on the network.
  const handleUniSearchChange = (val: string) => {
    setUniSearch(val);
    if (val.trim().length < 2) {
      setUniResults([]);
      return;
    }
    const source = allUnis.length ? allUnis : UNIVERSITY_PRESETS;
    setIsSearching(allUnis.length === 0);
    setUniResults(searchUniversities(source, val, 8));
  };

  const selectPresetUniversity = (name: string, flag: string) => {
    setSelectedUni(name);
    setCustomCountryFlag(flag);
    setUniResults([]);
    setUniSearch("");
  };

  const selectCustomUniversity = () => {
    setSelectedUni("Other");
    setCustomUni("");
    setCustomCountryFlag("🌐");
    setUniResults([]);
    setUniSearch("");
  };

  const handleUniSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUni) return;
    setStep("city");
  };

  // Instant local search across the cached world-city directory.
  const handleCitySearchChange = (val: string) => {
    setCitySearch(val);
    if (val.trim().length < 2) {
      setCityResults([]);
      return;
    }
    setCityResults(searchCities(allCities, val, 8));
  };

  const selectCity = (label: string, flag: string) => {
    setSelectedCity({ label, flag });
    setSurvey((s) => ({ ...s, city: label }));
    setCityResults([]);
    setCitySearch("");
  };

  const clearSelectedCity = () => {
    setSelectedCity(null);
    setSurvey((s) => ({ ...s, city: "" }));
  };

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey.city) return;
    setStep("prefs");
  };

  // Resolve the final university name + flag from the selection state.
  const resolveUniversity = () => {
    if (selectedUni === "Other") {
      return {
        name: customUni.trim() || "Other University",
        flag: customCountryFlag.trim() || "🌐",
      };
    }
    return { name: selectedUni, flag: customCountryFlag };
  };

  // Attach the chosen university + survey answers to the existing Supabase row.
  // Uses a security-definer RPC so we never need broad update access to the table.
  const persistSurvey = async (overrides?: Partial<SurveyData>) => {
    if (!rowId) return;
    const uni = resolveUniversity();
    const answers = { ...survey, ...overrides };
    const { error } = await supabase.rpc("submit_survey", {
      p_id: rowId,
      p_university: uni.name,
      p_university_flag: uni.flag,
      p_city: answers.city,
      p_pain_point: answers.painPoint,
      p_desk_needed: answers.deskNeeded,
    });
    if (error) console.error("Failed to save survey answers:", error);
  };

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await persistSurvey();
    setIsLoading(false);
    setStep("success");
  };

  // Skipping still saves the university the student already picked (if any).
  const skipSurvey = async () => {
    if (rowId && selectedUni) {
      await persistSurvey({ city: "", painPoint: "", deskNeeded: "" });
    }
    setStep("success");
  };

  return (
    <div className="w-full max-w-md mx-auto bg-lowest border-2 border-line rounded-[28px] p-6 sm:p-8 shadow-[0_10px_30px_-12px_rgba(120,89,0,0.28)]">
      <AnimatePresence mode="wait">
        {step === "email" && (
          <motion.div
            key="email-step"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/30 text-secondary-dim text-xs font-bold mb-3">
                <Users className="h-3.5 w-3.5" />
                <span>{waitlistCount} students in priority queue</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-ink mb-2">
                Join SiftPlace Priority Queue
              </h3>
              <p className="text-sm text-muted font-medium">
                Stop guessing. Find a home in Bangkok or other sprawling cities that fits your commute and budget.
              </p>

              {/* Pilot Launch Progress Bar */}
              <div className="mt-5 text-left space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted font-bold">
                  <span>Progress to Bangkok Pilot Launch</span>
                  <span className="text-secondary-dim font-bold">{waitlistCount} / 200 students</span>
                </div>
                <div className="w-full bg-surface-high rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((waitlistCount / 200) * 100, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="bg-gradient-to-r from-primary via-primary-dim to-secondary h-full rounded-full"
                  />
                </div>
              </div>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="Enter your university or personal email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  disabled={isLoading}
                  className={`sf-field pl-11 py-3.5 ${emailError ? "border-error focus:border-error" : ""}`}
                />
              </div>

              {emailError && (
                <p className="text-error text-xs text-center font-bold -mt-1">
                  {emailError}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || !validateEmail(email)}
                className="sf-cta w-full flex items-center justify-center gap-2 py-3.5 px-4 text-base"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Securing your spot...
                  </>
                ) : (
                  <>
                    Get Early Access
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {step === "uni" && (
          <motion.div
            key="uni-step"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-center mb-5">
              <span className="text-[10px] text-muted uppercase tracking-widest font-bold block mb-1">Step 1 of 3</span>
              <h3 className="text-lg font-bold text-ink mb-1">
                Which university are you from?
              </h3>
              <p className="text-xs text-muted font-medium">
                Type 2+ letters to search top global exchange sending universities.
              </p>
            </div>

            <form onSubmit={handleUniSubmit} className="space-y-4">
              {selectedUni ? (
                /* Selected university state */
                <div className="p-4 bg-surface-low border border-line rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">{customCountryFlag}</span>
                    <span className="text-sm font-bold text-ink truncate">
                      {selectedUni === "Other" ? customUni : selectedUni}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUni("");
                      setCustomUni("");
                    }}
                    className="text-xs text-secondary hover:text-secondary-dim font-bold cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                /* Search input and combobox */
                <div className="space-y-2 relative">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search university name (e.g. Munich, Singapore, LSE...)"
                      value={uniSearch}
                      onChange={(e) => handleUniSearchChange(e.target.value)}
                      className="sf-field pl-10 pr-10"
                    />
                    {isSearching && (
                      <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                      </span>
                    )}
                  </div>

                  {/* Search results list */}
                  {uniSearch.trim().length >= 2 && (
                    <div className="bg-lowest border border-line rounded-2xl overflow-hidden shadow-[0_10px_30px_-12px_rgba(120,89,0,0.28)] max-h-[180px] overflow-y-auto z-50 text-left">
                      {uniResults.length > 0 ? (
                        uniResults.map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => selectPresetUniversity(item.name, item.flag)}
                            className="w-full py-2.5 px-3 hover:bg-surface-c text-ink text-left text-xs transition border-b border-line last:border-0 cursor-pointer flex items-center gap-2 truncate font-semibold"
                          >
                            <span>{item.flag}</span>
                            <span className="truncate">{item.name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="py-3 px-4 text-xs text-muted text-center">
                          No match found.
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={selectCustomUniversity}
                        className="w-full py-2.5 px-3 bg-secondary/10 hover:bg-secondary/15 text-secondary-dim text-left text-xs font-bold flex items-center gap-2 cursor-pointer border-t border-line"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Can't find it? Enter manually
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Other manual input toggle */}
              {selectedUni === "Other" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    placeholder="Enter your university name (e.g. Yale University)"
                    value={customUni}
                    onChange={(e) => setCustomUni(e.target.value)}
                    required={selectedUni === "Other"}
                    className="sf-field"
                  />
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] text-muted font-bold">Select your country flag:</label>
                    <select
                      value={customCountryFlag}
                      onChange={(e) => setCustomCountryFlag(e.target.value)}
                      className="sf-field cursor-pointer"
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.flag}>
                          {country.flag} {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={skipSurvey}
                  className="flex-1 py-3 border-2 border-line hover:bg-surface-c text-muted text-xs font-bold rounded-2xl transition duration-200 cursor-pointer"
                >
                  Skip Questions
                </button>
                <button
                  type="submit"
                  disabled={!selectedUni || (selectedUni === "Other" && !customUni)}
                  className="sf-cta flex-1 py-3 text-xs flex items-center justify-center gap-1.5"
                >
                  Next Step
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === "city" && (
          <motion.div
            key="city-step"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-center mb-5">
              <span className="text-[10px] text-muted uppercase tracking-widest font-bold block mb-1">Step 2 of 3</span>
              <h3 className="text-lg font-bold text-ink mb-1">
                Which city are you heading to?
              </h3>
              <p className="text-xs text-muted font-medium">
                Pick a launch city, or search any city in the world.
              </p>
            </div>

            <form onSubmit={handleCitySubmit} className="space-y-4">
              {/* Quick-pick launch cities */}
              <div className="grid grid-cols-2 gap-2">
                {FEATURED_CITIES.map((cityOpt) => (
                  <button
                    key={cityOpt.label}
                    type="button"
                    onClick={() => selectCity(cityOpt.label, cityOpt.flag)}
                    className={`py-2.5 px-3 text-left text-xs rounded-2xl border-2 transition-all cursor-pointer font-bold ${
                      survey.city === cityOpt.label
                        ? "bg-primary/25 border-primary-dim text-ink"
                        : "bg-surface-low border-line text-muted hover:bg-surface-c"
                    }`}
                  >
                    {cityOpt.flag} {cityOpt.city}
                  </button>
                ))}
              </div>

              {/* Selected city or full world-city search */}
              {selectedCity && survey.city === selectedCity.label ? (
                <div className="p-4 bg-surface-low border border-line rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">{selectedCity.flag}</span>
                    <span className="text-sm font-bold text-ink truncate">{selectedCity.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedCity}
                    className="text-xs text-secondary hover:text-secondary-dim font-bold cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2 relative">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Or search any city worldwide (e.g. Berlin, Osaka...)"
                      value={citySearch}
                      onChange={(e) => handleCitySearchChange(e.target.value)}
                      className="sf-field pl-10 pr-10"
                    />
                    {citiesLoading && (
                      <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                      </span>
                    )}
                  </div>

                  {citySearch.trim().length >= 2 && (
                    <div className="bg-lowest border border-line rounded-2xl overflow-hidden shadow-[0_10px_30px_-12px_rgba(120,89,0,0.28)] max-h-[180px] overflow-y-auto z-50 text-left">
                      {cityResults.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => selectCity(item.label, item.flag)}
                          className="w-full py-2.5 px-3 hover:bg-surface-c text-ink text-left text-xs transition border-b border-line last:border-0 cursor-pointer flex items-center gap-2 truncate font-semibold"
                        >
                          <span>{item.flag}</span>
                          <span className="truncate">{item.city}</span>
                          <span className="text-muted truncate">· {item.country}</span>
                        </button>
                      ))}
                      {cityResults.length === 0 && (
                        <div className="py-3 px-4 text-xs text-muted text-center">
                          {citiesLoading ? "Loading world cities…" : "No match found."}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => selectCity(citySearch.trim(), "🌐")}
                        className="w-full py-2.5 px-3 bg-secondary/10 hover:bg-secondary/15 text-secondary-dim text-left text-xs font-bold flex items-center gap-2 cursor-pointer border-t border-line"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Use "{citySearch.trim()}"
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("uni")}
                  className="flex-1 py-3 border-2 border-line hover:bg-surface-c text-muted text-xs font-bold rounded-2xl transition duration-200 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!survey.city}
                  className="sf-cta flex-1 py-3 text-xs"
                >
                  Next Step
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === "prefs" && (
          <motion.div
            key="prefs-step"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-center mb-5">
              <span className="text-[10px] text-muted uppercase tracking-widest font-bold block mb-1">Step 3 of 3</span>
              <h3 className="text-lg font-bold text-ink mb-1">
                Your Housing Preferences
              </h3>
              <p className="text-xs text-muted font-medium">
                Help SiftPlace customize your local commute and search criteria.
              </p>
            </div>

            <form onSubmit={handleSurveySubmit} className="space-y-4 text-left">
              {/* Question 3: Pain Point */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-ink block">
                  3. What is your biggest accommodation anxiety?
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: "lease", label: "Finding short-term (3-6 month) leases", icon: Clock },
                    { id: "commute", label: "Commute costs and traffic time", icon: Building },
                    { id: "safety", label: "Flooding, neighborhood safety, scams", icon: Shield },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = !isOtherPain && survey.painPoint === opt.label;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setIsOtherPain(false);
                          setSurvey({ ...survey, painPoint: opt.label });
                        }}
                        className={`w-full py-2.5 px-3 flex items-center gap-2.5 text-left text-xs rounded-2xl border-2 transition-all cursor-pointer font-bold ${
                          active
                            ? "bg-secondary/20 border-secondary text-ink"
                            : "bg-surface-low border-line text-muted hover:bg-surface-c"
                        }`}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-secondary" : "text-muted"}`} />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}

                  {/* Other (free text) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtherPain(true);
                      setSurvey({ ...survey, painPoint: customPain.trim() });
                    }}
                    className={`w-full py-2.5 px-3 flex items-center gap-2.5 text-left text-xs rounded-2xl border-2 transition-all cursor-pointer font-bold ${
                      isOtherPain
                        ? "bg-secondary/20 border-secondary text-ink"
                        : "bg-surface-low border-line text-muted hover:bg-surface-c"
                    }`}
                  >
                    <HelpCircle className={`h-4 w-4 flex-shrink-0 ${isOtherPain ? "text-secondary" : "text-muted"}`} />
                    <span>Other</span>
                  </button>

                  {isOtherPain && (
                    <motion.input
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      type="text"
                      autoFocus
                      placeholder="Tell us your biggest worry..."
                      value={customPain}
                      onChange={(e) => {
                        setCustomPain(e.target.value);
                        setSurvey({ ...survey, painPoint: e.target.value.trim() });
                      }}
                      className="sf-field"
                    />
                  )}
                </div>
              </div>

              {/* Question 4: Study Desk */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-ink block">
                  4. Do you need a study desk/workspace in your room?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "yes", label: "Essential" },
                    { id: "maybe", label: "Nice to have" },
                    { id: "no", label: "Unimportant" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSurvey({ ...survey, deskNeeded: opt.label })}
                      className={`py-2.5 text-center text-xs rounded-2xl border-2 transition-all cursor-pointer font-bold ${
                        survey.deskNeeded === opt.label
                          ? "bg-tertiary-c border-tertiary text-tertiary"
                          : "bg-surface-low border-line text-muted hover:bg-surface-c"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("city")}
                  className="flex-1 py-3 border-2 border-line hover:bg-surface-c text-muted text-xs font-bold rounded-2xl transition duration-200 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !survey.painPoint || !survey.deskNeeded}
                  className="sf-cta flex-1 py-3 text-xs flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Complete"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success-step"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center py-4"
          >
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full sf-avatar mb-4">
              <CheckCircle2 className="h-8 w-8 text-secondary-dim" />
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-ink mb-2">
              You're in the Queue!
            </h3>

            <div className="my-6 inline-block bg-surface-low border border-line rounded-2xl px-5 py-3.5">
              <span className="text-xs uppercase tracking-widest text-muted font-bold block mb-0.5">
                Your Queue Position
              </span>
              <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-dim to-secondary">
                #{joinedPosition}
              </span>
            </div>

            <p className="text-sm text-muted mb-6 max-w-xs mx-auto leading-relaxed font-medium">
              We'll send launch notifications and early housing recommendations directly to <span className="text-ink font-bold">{email}</span>.
            </p>

            <div className="pt-2 border-t border-line">
              <span className="text-xs text-muted block mb-3">Want to skip the queue?</span>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}&mini=true&title=${encodeURIComponent("Joining SiftPlace waitlist - the smart housing matcher for international students!")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 w-full bg-[#0077b5] hover:bg-[#006297] text-white text-xs font-semibold rounded-xl transition duration-200 cursor-pointer shadow-md shadow-[#0077b5]/15"
              >
                Share on LinkedIn to Skip Ahead
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
