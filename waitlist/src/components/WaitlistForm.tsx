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
  const [step, setStep] = useState<"email" | "uni" | "city" | "prefs" | "success">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  
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

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;

    setIsLoading(true);
    // Simulate API request to capture email first
    await new Promise((resolve) => setTimeout(resolve, 1200));
    
    const regId = Math.random().toString(36).substring(2, 9).toUpperCase();
    setRegistrationId(regId);

    // Initial email capture guestimate
    const uniInfo = getUniversityFromEmail(email);
    
    // Save email to Supabase
    const { error } = await supabase
      .from('waitlist')
      .insert([{ email: email, university: uniInfo.name }])

    if (error) {
      console.error('Supabase error:', error)
    }

    // Seed defaults in search
    setUniSearch(uniInfo.name);
    handleUniSearchChange(uniInfo.name);

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

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API request to save survey answers
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Determine final university details
    let finalUniName = "";
    let finalUniFlag = "🌐";

    if (selectedUni === "Other") {
      finalUniName = customUni.trim() || "Other University";
      finalUniFlag = customCountryFlag.trim() || "🌐";
    } else {
      finalUniName = selectedUni;
      finalUniFlag = customCountryFlag;
    }

    // Update lead in localStorage with survey answers
    const currentList = JSON.parse(localStorage.getItem("siftplace_waitlist") || "[]");
    const updatedList = currentList.map((item: any) => {
      if (item.id === registrationId) {
        return {
          ...item,
          universityName: finalUniName,
          universityFlag: finalUniFlag,
          survey,
        };
      }
      return item;
    });
    localStorage.setItem("siftplace_waitlist", JSON.stringify(updatedList));
    await supabase.from('waitlist_signups').insert({ <div styleName={styles.registrationID}></div> })

    setIsLoading(false);
    setStep("success");
  };

  const skipSurvey = () => {
    setStep("success");
  };

  const queuePosition = JSON.parse(localStorage.getItem("siftplace_waitlist") || "[]").length;

  return (
    <div className="w-full max-w-md mx-auto bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
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
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
                <Users className="h-3.5 w-3.5" />
                <span>{queuePosition} students in priority queue</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2">
                Join SiftPlace Priority Queue
              </h3>
              <p className="text-sm text-white/50">
                Stop guessing. Find a home in Bangkok or other sprawling cities that fits your commute and budget.
              </p>

              {/* Pilot Launch Progress Bar */}
              <div className="mt-5 text-left space-y-1.5">
                <div className="flex justify-between text-[10px] text-white/40 font-medium">
                  <span>Progress to Bangkok Pilot Launch</span>
                  <span className="text-indigo-300 font-semibold">{queuePosition} / 200 students</span>
                </div>
                <div className="w-full bg-white/[0.05] rounded-full h-2 overflow-hidden border border-white/[0.03]">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((queuePosition / 200) * 100, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 h-full rounded-full"
                  />
                </div>
              </div>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-white/30">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="Enter your university or personal email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/80 transition duration-200 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !validateEmail(email)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-500 to-rose-500 hover:from-indigo-600 hover:to-rose-600 text-white font-medium rounded-xl text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
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
              <span className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Step 1 of 3</span>
              <h3 className="text-lg font-semibold text-white mb-1">
                Which university are you from?
              </h3>
              <p className="text-xs text-white/50">
                Type 2+ letters to search top global exchange sending universities.
              </p>
            </div>

            <form onSubmit={handleUniSubmit} className="space-y-4">
              {selectedUni ? (
                /* Selected university state */
                <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">{customCountryFlag}</span>
                    <span className="text-sm font-medium text-white truncate">
                      {selectedUni === "Other" ? customUni : selectedUni}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUni("");
                      setCustomUni("");
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                /* Search input and combobox */
                <div className="space-y-2 relative">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-white/30">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search university name (e.g. Munich, Singapore, LSE...)"
                      value={uniSearch}
                      onChange={(e) => handleUniSearchChange(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs"
                    />
                    {isSearching && (
                      <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                      </span>
                    )}
                  </div>

                  {/* Search results list */}
                  {uniSearch.trim().length >= 2 && (
                    <div className="bg-[#0b0b0b] border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl max-h-[180px] overflow-y-auto z-50 text-left">
                      {uniResults.length > 0 ? (
                        uniResults.map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => selectPresetUniversity(item.name, item.flag)}
                            className="w-full py-2.5 px-3 hover:bg-white/[0.05] text-white/80 text-left text-xs transition border-b border-white/[0.03] last:border-0 cursor-pointer flex items-center gap-2 truncate"
                          >
                            <span>{item.flag}</span>
                            <span className="truncate">{item.name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="py-3 px-4 text-xs text-white/40 text-center">
                          No match found.
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={selectCustomUniversity}
                        className="w-full py-2.5 px-3 bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-300 text-left text-xs font-semibold flex items-center gap-2 cursor-pointer border-t border-white/[0.05]"
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
                    className="w-full py-2.5 px-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                  />
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] text-white/40 font-medium">Select your country flag:</label>
                    <select
                      value={customCountryFlag}
                      onChange={(e) => setCustomCountryFlag(e.target.value)}
                      className="w-full py-2 px-3 bg-[#0d0d0d] border border-white/[0.1] rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
                  className="flex-1 py-2.5 border border-white/[0.1] hover:bg-white/[0.04] text-white/60 text-xs font-medium rounded-xl transition duration-200 cursor-pointer"
                >
                  Skip Questions
                </button>
                <button
                  type="submit"
                  disabled={!selectedUni || (selectedUni === "Other" && !customUni)}
                  className="flex-1 py-2.5 bg-white text-black hover:bg-white/90 text-xs font-semibold rounded-xl transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
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
              <span className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Step 2 of 3</span>
              <h3 className="text-lg font-semibold text-white mb-1">
                Which city are you heading to?
              </h3>
              <p className="text-xs text-white/50">
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
                    className={`py-2.5 px-3 text-left text-xs rounded-xl border transition-all cursor-pointer ${
                      survey.city === cityOpt.label
                        ? "bg-indigo-500/25 border-indigo-500 text-white font-medium"
                        : "bg-white/[0.02] border-white/[0.08] text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    {cityOpt.flag} {cityOpt.city}
                  </button>
                ))}
              </div>

              {/* Selected city or full world-city search */}
              {selectedCity && survey.city === selectedCity.label ? (
                <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">{selectedCity.flag}</span>
                    <span className="text-sm font-medium text-white truncate">{selectedCity.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedCity}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2 relative">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-white/30">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Or search any city worldwide (e.g. Berlin, Osaka...)"
                      value={citySearch}
                      onChange={(e) => handleCitySearchChange(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs"
                    />
                    {citiesLoading && (
                      <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                      </span>
                    )}
                  </div>

                  {citySearch.trim().length >= 2 && (
                    <div className="bg-[#0b0b0b] border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl max-h-[180px] overflow-y-auto z-50 text-left">
                      {cityResults.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => selectCity(item.label, item.flag)}
                          className="w-full py-2.5 px-3 hover:bg-white/[0.05] text-white/80 text-left text-xs transition border-b border-white/[0.03] last:border-0 cursor-pointer flex items-center gap-2 truncate"
                        >
                          <span>{item.flag}</span>
                          <span className="truncate">{item.city}</span>
                          <span className="text-white/30 truncate">· {item.country}</span>
                        </button>
                      ))}
                      {cityResults.length === 0 && (
                        <div className="py-3 px-4 text-xs text-white/40 text-center">
                          {citiesLoading ? "Loading world cities…" : "No match found."}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => selectCity(citySearch.trim(), "🌐")}
                        className="w-full py-2.5 px-3 bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-300 text-left text-xs font-semibold flex items-center gap-2 cursor-pointer border-t border-white/[0.05]"
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
                  className="flex-1 py-2.5 border border-white/[0.1] hover:bg-white/[0.04] text-white/60 text-xs font-medium rounded-xl transition duration-200 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!survey.city}
                  className="flex-1 py-2.5 bg-white text-black hover:bg-white/90 text-xs font-semibold rounded-xl transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
              <span className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Step 3 of 3</span>
              <h3 className="text-lg font-semibold text-white mb-1">
                Your Housing Preferences
              </h3>
              <p className="text-xs text-white/50">
                Help SiftPlace customize your local commute and search criteria.
              </p>
            </div>

            <form onSubmit={handleSurveySubmit} className="space-y-4 text-left">
              {/* Question 3: Pain Point */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-white/70 block">
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
                        className={`w-full py-2.5 px-3 flex items-center gap-2.5 text-left text-xs rounded-xl border transition-all cursor-pointer ${
                          active
                            ? "bg-rose-500/25 border-rose-500 text-white font-medium"
                            : "bg-white/[0.02] border-white/[0.08] text-white/60 hover:bg-white/[0.04]"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-white/40 flex-shrink-0" />
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
                    className={`w-full py-2.5 px-3 flex items-center gap-2.5 text-left text-xs rounded-xl border transition-all cursor-pointer ${
                      isOtherPain
                        ? "bg-rose-500/25 border-rose-500 text-white font-medium"
                        : "bg-white/[0.02] border-white/[0.08] text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    <HelpCircle className="h-4 w-4 text-white/40 flex-shrink-0" />
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
                      className="w-full py-2.5 px-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs"
                    />
                  )}
                </div>
              </div>

              {/* Question 4: Study Desk */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-white/70 block">
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
                      className={`py-2 text-center text-xs rounded-xl border transition-all cursor-pointer ${
                        survey.deskNeeded === opt.label
                          ? "bg-violet-500/25 border-violet-500 text-white font-medium"
                          : "bg-white/[0.02] border-white/[0.08] text-white/60 hover:bg-white/[0.04]"
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
                  className="flex-1 py-2.5 border border-white/[0.1] hover:bg-white/[0.04] text-white/60 text-xs font-medium rounded-xl transition duration-200 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !survey.painPoint || !survey.deskNeeded}
                  className="flex-1 py-2.5 bg-white text-black hover:bg-white/90 text-xs font-semibold rounded-xl transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
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
            <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            
            <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2">
              You're in the Queue!
            </h3>
            
            <div className="my-6 inline-block bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-3.5">
              <span className="text-xs uppercase tracking-widest text-white/40 block mb-0.5">
                Your Queue Position
              </span>
              <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-rose-300">
                #{queuePosition}
              </span>
            </div>

            <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto leading-relaxed">
              We'll send launch notifications and early housing recommendations directly to <span className="text-white font-medium">{email}</span>.
            </p>

            <div className="pt-2 border-t border-white/[0.06]">
              <span className="text-xs text-white/30 block mb-3">Want to skip the queue?</span>
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
