import { useEffect, useState } from "react";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Mascot } from "@/components/Mascot";
import { AnimatePresence } from "framer-motion";
import { Users, GraduationCap, MapPin, Sparkles, Database, Download, X, HelpCircle, ArrowRight, ShieldCheck, DollarSign, Mail, Lock, LogOut, Loader2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

function App() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Solar Friend theme toggle — warm light by default, warm dark on demand.
  const [dark, setDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "";
  }, [dark]);

  // Founders Portal auth (Supabase Auth — password is verified server-side, never shipped to the browser)
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Live waitlist rows pulled from Supabase (only readable by authenticated founders via RLS)
  const [dbRegistrations, setDbRegistrations] = useState<any[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  // Track the founder's auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchRegistrations = async () => {
    setDbLoading(true);
    const { data, error } = await supabase
      .from("waitlist")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load waitlist:", error);
    } else {
      setDbRegistrations(data || []);
    }
    setDbLoading(false);
  };

  // Load live data whenever an authenticated founder opens the portal
  useEffect(() => {
    if (session && showAdmin) {
      fetchRegistrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, showAdmin]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    if (error) {
      setAuthError("Invalid credentials. Please try again.");
    } else {
      setAuthPassword("");
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowAdmin(false);
  };

  // Live university leaderboard, aggregated globally in Supabase via a
  // security-definer RPC (returns counts only — never exposes emails).
  // Polled every few seconds so the board updates in near real-time.
  const fetchLeaderboard = async () => {
    const { data, error } = await supabase.rpc("get_leaderboard");
    if (error) {
      console.error("Failed to load leaderboard:", error);
      return;
    }
    const mapped = (data || []).map((row: any, index: number) => ({
      rank: index + 1,
      name: row.university,
      flag: row.university_flag || "🌐",
      count: Number(row.count),
      trend: index === 0 ? "Hot 🔥" : index < 3 ? "Rising 📈" : "Stable 💤",
      progress: Math.min((Number(row.count) / 10) * 100, 100),
    }));
    setLeaderboard(mapped);
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 4000);
    return () => clearInterval(interval);
  }, []);

  // Export the live Supabase waitlist to CSV
  const exportToCSV = () => {
    if (dbRegistrations.length === 0) return;

    const headers = ["ID", "Email", "University", "Destination City", "Pain Point", "Desk", "Joined"];
    const rows = dbRegistrations.map(reg => [
      reg.id || "",
      reg.email || "",
      reg.university || "",
      reg.city || "",
      reg.pain_point || "",
      reg.desk_needed || "",
      reg.created_at || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `siftplace_waitlist_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const faqs = [
    {
      q: "Is SiftPlace really free? How do you make money?",
      a: "Yes, SiftPlace is 100% free for students. We make money by partnering directly with verified serviced apartments and monthly rentals in Bangkok. When you book a matched stay, landlords pay us a referral commission. You get the exact same (or cheaper) rate with zero markup fees."
    },
    {
      q: "Are 3-6 month lease contracts legal in Bangkok?",
      a: "Yes! While standard condominiums legally require a 1-year lease, serviced apartments and monthly apartments are legally structured for short-term stays. SiftPlace specifically aggregates this fragmented monthly inventory."
    },
    {
      q: "How do you calculate the commute costs?",
      a: "Our engine uses routing data from OpenStreetMap. We combine daily commute frequency, distance to your university, and transit options (BTS SkyTrain, MRT Subway, motorbike taxi stands) to calculate your true monthly transit cost, which is added to your rent estimate."
    },
    {
      q: "Is my deposit safe from scams?",
      a: "SiftPlace only lists hand-verified buildings. We physically audit properties to ensure they match our photos and provide a localized scam-prevention pack to help you safely wire your deposit."
    }
  ];

  return (
    <main className="min-h-screen bg-surface text-ink flex flex-col relative scroll-smooth">
      {/* SiftPlace Floating Navbar */}
      <header className="fixed top-4 left-4 right-4 z-50 max-w-7xl mx-auto flex items-center justify-between pl-3 pr-3 py-2.5 bg-lowest/85 backdrop-blur-md border-2 border-line rounded-full shadow-[0_10px_30px_-12px_rgba(120,89,0,0.28)]">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-8 w-8 rounded-full sf-avatar flex-shrink-0">
            <Mascot size={20} />
          </span>
          <span className="font-bold text-lg tracking-tight text-primary-dim">
            SiftPlace
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-xs text-muted font-bold">
          <a href="#how-it-works" className="hover:text-ink transition duration-200">How it Works</a>
          <a href="#features" className="hover:text-ink transition duration-200">Features</a>
          <a href="#demo" className="hover:text-ink transition duration-200">Demo</a>
          <a href="#free-forever" className="hover:text-ink transition duration-200">Pricing</a>
          <a href="#faq" className="hover:text-ink transition duration-200">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle dark mode"
            className="h-9 w-9 rounded-full bg-surface-c text-ink text-base flex items-center justify-center transition active:scale-90 cursor-pointer"
          >
            {dark ? "☀️" : "🌙"}
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/30 text-secondary-dim text-xs font-bold">
            <Sparkles className="h-3 w-3" />
            Beta Pilot
          </span>
        </div>
      </header>

      {/* Hero Section Container */}
      <div className="flex-1 flex flex-col justify-center pt-20">
        <HeroGeometric
          badge="SiftPlace Waitlist"
          title1="SiftPlace"
          title2="Smart Housing Matcher"
          description="Finding accommodation in an unfamiliar city is stressful. SiftPlace matches international students & interns with verified mid-term stays based on true commute costs, walkability scores, and room specifications. Starting with our Bangkok pilot."
        >
          <div className="w-full flex flex-col items-center gap-8 mt-4">
            {/* The Main Waitlist Input Form */}
            <WaitlistForm />

            {/* Social Proof Cohorts Banner */}
            <div className="flex flex-col items-center gap-3 max-w-lg text-center mt-2 px-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <GraduationCap className="h-4 w-4 text-secondary" />
                <span>Join Students Heading To</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Chulalongkorn",
                  "Thammasat",
                  "Mahidol",
                  "NUS",
                  "LMU Munich",
                  "Waseda",
                  "LSE",
                  "Sydney Uni",
                ].map((uni) => (
                  <span
                    key={uni}
                    className="px-2.5 py-1 rounded-full bg-lowest border border-line text-[10px] sm:text-xs text-muted font-bold tracking-wide shadow-sm"
                  >
                    {uni}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </HeroGeometric>
      </div>

      {/* Section: How It Works */}
      <section id="how-it-works" className="py-24 bg-surface-low border-t border-line relative z-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[10px] text-secondary uppercase tracking-widest font-bold block mb-2">The Process</span>
            <h2 className="text-3xl font-bold text-ink tracking-tight mb-4">How SiftPlace Works</h2>
            <p className="text-sm text-muted">Our decision-layer algorithm handles the research so you avoid housing regrets.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {[
              { step: "01", title: "Set Your Weights", desc: "Select budget limits and assign values to commute distance, noise safety, and room workstation specifications." },
              { step: "02", title: "Calculate Real Cost", desc: "Our engine processes neighborhood walkability indices, flood variables, and exact transit routing commute math." },
              { step: "03", title: "Book Hand-Verified Stays", desc: "Receive a hand-verified 'Top 3' recommendation matching your exchange length with protected deposits." }
            ].map((item, index) => (
              <div key={item.step} className="bg-lowest border border-line rounded-3xl p-8 relative flex flex-col shadow-[0_4px_14px_-8px_rgba(44,22,14,0.35)] hover:-translate-y-1 transition duration-300">
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-dim to-secondary mb-4">{item.step}</span>
                <h3 className="font-bold text-lg text-ink mb-2">{item.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 translate-x-1/2 -translate-y-1/2 z-10 text-primary-dim/40">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Section Overlay (Brief UX context) */}
      <section id="features" className="py-24 bg-surface border-t border-line relative z-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[10px] text-primary-dim uppercase tracking-widest font-bold block mb-2">Capabilities</span>
            <h2 className="text-3xl font-bold text-ink tracking-tight mb-4">
              Smart Decision Engine Features
            </h2>
            <p className="text-sm text-muted">
              Unlike traditional booking platforms that optimize purely for listings, SiftPlace audits the details students care about.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-lowest border border-line rounded-3xl p-6 shadow-[0_4px_14px_-8px_rgba(44,22,14,0.35)] hover:-translate-y-1 transition duration-300">
              <div className="h-11 w-11 bg-primary/15 rounded-2xl flex items-center justify-center text-primary-dim mb-4">
                <MapPin className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-ink">True Commute Match</h3>
              <p className="text-xs text-muted leading-relaxed">
                Calculates true monthly costs by analyzing walkability, BTS/MRT routes, and motorbike taxi costs rather than pure physical distance.
              </p>
            </div>

            <div className="bg-lowest border border-line rounded-3xl p-6 shadow-[0_4px_14px_-8px_rgba(44,22,14,0.35)] hover:-translate-y-1 transition duration-300">
              <div className="h-11 w-11 bg-secondary/12 rounded-2xl flex items-center justify-center text-secondary mb-4">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-ink">Hyper-Local Neighborhood Tags</h3>
              <p className="text-xs text-muted leading-relaxed">
                Filters rentals based on real student metrics like flooding risk, proximity to safe walking routes, local 7-Elevens, and street food.
              </p>
            </div>

            <div className="bg-lowest border border-line rounded-3xl p-6 shadow-[0_4px_14px_-8px_rgba(44,22,14,0.35)] hover:-translate-y-1 transition duration-300">
              <div className="h-11 w-11 bg-tertiary-c rounded-2xl flex items-center justify-center text-tertiary mb-4">
                <GraduationCap className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-ink">Study-Ready Audits</h3>
              <p className="text-xs text-muted leading-relaxed">
                We verify features student listing sites omit, checking room layouts for dedicated study desks, natural lighting, and reliable Wi-Fi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Pricing */}
      <section id="free-forever" className="py-24 bg-surface-low border-t border-line relative z-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-gradient-to-tr from-primary/10 via-lowest to-secondary/10 border border-line rounded-[32px] p-8 sm:p-12 text-center relative overflow-hidden shadow-[0_10px_30px_-12px_rgba(120,89,0,0.28)]">
            <div className="inline-flex items-center justify-center p-3 bg-ok-soft rounded-full text-ok mb-4 border border-ok/20">
              <DollarSign className="h-6 w-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-4">SiftPlace is 100% Free for Students</h2>
            <p className="text-sm text-muted max-w-xl mx-auto leading-relaxed mb-6">
              We charge students $0. No markups, no platform fees. We earn a small referral commission directly from serviced apartments and monthly rentals when you sign a lease. This aligns our goals: we only succeed when we find you a safe, verified home.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted font-semibold">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-ok" /> Landlord-paid commission</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-ok" /> No student booking markup</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-ok" /> Best Price Guarantee</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Product Demo */}
      <section id="demo" className="py-24 bg-surface border-t border-line relative z-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-gradient-to-tr from-primary/10 via-lowest to-secondary/10 border border-line rounded-[32px] p-8 sm:p-12 text-center relative overflow-hidden shadow-[0_10px_30px_-12px_rgba(120,89,0,0.28)]">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full sf-avatar mb-4">
              <Mascot size={30} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-4">
              Curious about our product? Here is a simple demo!
            </h2>
            <p className="text-sm text-muted max-w-xl mx-auto leading-relaxed mb-8">
              Take our interactive prototype for a spin — set your priorities and watch SiftPlace match you to the right place to live.
            </p>
            <a
              href="/prototype.html"
              target="_blank"
              rel="noopener noreferrer"
              className="sf-cta inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Try the Live Demo
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Section: FAQ */}
      <section id="faq" className="py-24 bg-surface-low border-t border-line relative z-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[10px] text-tertiary uppercase tracking-widest font-bold block mb-2">Q&A</span>
            <h2 className="text-3xl font-bold text-ink tracking-tight mb-4">Frequently Asked Questions</h2>
            <p className="text-sm text-muted">Everything exchange students need to know before moving.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-lowest border border-line rounded-2xl overflow-hidden transition duration-300 shadow-[0_4px_14px_-8px_rgba(44,22,14,0.35)]"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full py-4 px-6 flex items-center justify-between text-left font-bold text-ink hover:text-secondary transition duration-200 text-sm cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <HelpCircle className={`h-4 w-4 text-muted transition-transform duration-300 ${openFaq === index ? "rotate-180 text-secondary" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === index && (
                    <div className="px-6 pb-4 text-xs text-muted leading-relaxed border-t border-line pt-3 font-medium">
                      {faq.a}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SiftPlace Exchange Leaderboard */}
      <section className="py-16 bg-surface border-t border-line relative z-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary/10 border border-secondary/30 text-secondary-dim text-[10px] font-bold uppercase tracking-wider mb-3">
              🔥 Cohort Competition
            </span>
            <h2 className="text-2xl font-bold text-ink tracking-tight mb-3">
              Top Exchange University Cohorts
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              The university with the most signups this month gets priority access to student discounts. Share with your buddies to push your school up!
            </p>
          </div>

          <div className="bg-lowest border border-line rounded-3xl p-6 sm:p-8 space-y-4 shadow-[0_10px_30px_-12px_rgba(120,89,0,0.28)]">
            {leaderboard.length === 0 ? (
              <p className="text-center text-muted text-xs py-8 font-medium italic">No university cohorts registered yet. Be the first from your school to join the queue!</p>
            ) : (
              leaderboard.map((uni) => (
                <div
                  key={uni.rank}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-low hover:bg-surface-c border border-line transition duration-200"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      uni.rank === 1 ? "bg-primary/20 text-primary-dim border border-primary/40" :
                      uni.rank === 2 ? "bg-muted/15 text-muted border border-muted/30" :
                      uni.rank === 3 ? "bg-secondary/15 text-secondary-dim border border-secondary/30" :
                      "bg-surface-c text-muted"
                    }`}>
                      {uni.rank}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-ink">{uni.name}</span>
                        <span className="text-sm" role="img" aria-label="flag">{uni.flag}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    <div className="w-24 bg-surface-high rounded-full h-1.5 overflow-hidden hidden md:block">
                      <div className="bg-secondary h-full rounded-full" style={{ width: `${uni.progress}%` }} />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-c text-muted border border-line font-bold">
                      {uni.trend}
                    </span>
                    <span className="text-sm font-bold text-ink whitespace-nowrap">
                      {uni.count} Joined
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* SiftPlace Footer */}
      <footer className="py-12 border-t border-line bg-surface-low text-center text-xs text-muted relative z-20 flex flex-col items-center gap-4">
        <p>&copy; {new Date().getFullYear()} SiftPlace. Built for exchange students by exchange students.</p>

        {/* Founders Access Portal Trigger */}
        <button
          onClick={() => setShowAdmin(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-lowest hover:bg-surface-c border border-line text-[10px] text-muted hover:text-ink rounded-lg transition duration-200 cursor-pointer"
        >
          <Database className="h-3 w-3" />
          Co-Founders Portal
        </button>
      </footer>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdmin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2c160e]/50 backdrop-blur-sm">
            {!session ? (
              /* Founder Sign-In Screen (Supabase Auth) */
              <div className="bg-lowest border-2 border-line rounded-3xl w-full max-w-md p-6 flex flex-col shadow-[0_24px_60px_-12px_rgba(60,30,10,0.5)] relative">
                <button
                  onClick={() => {
                    setShowAdmin(false);
                    setAuthError("");
                    setAuthPassword("");
                  }}
                  className="absolute top-4 right-4 text-muted hover:text-ink transition p-1 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center p-3 bg-primary/15 rounded-full text-primary-dim mb-4 border border-primary/20">
                    <Database className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-lg text-ink mb-2">Co-Founders Portal</h3>
                  <p className="text-xs text-muted leading-relaxed">
                    Sign in with your founder account to view and export the live waitlist.
                  </p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="Founder email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="sf-field pl-10"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="sf-field pl-10"
                    />
                  </div>
                  {authError && (
                    <p className="text-error text-[11px] text-center font-bold">
                      {authError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="sf-cta w-full py-3 text-sm flex items-center justify-center gap-1.5"
                  >
                    {authLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Authenticated Founders Dashboard */
              <div className="bg-lowest border-2 border-line rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-[0_24px_60px_-12px_rgba(60,30,10,0.5)] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary-dim" />
                    <h3 className="font-bold text-lg text-ink">SiftPlace Founders Portal</h3>
                    <span className="px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-[10px] text-primary-dim font-bold truncate max-w-[160px]">
                      {session.user.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-muted hover:text-ink border border-line hover:bg-surface-c rounded-lg transition cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                    <button
                      onClick={() => setShowAdmin(false)}
                      className="text-muted hover:text-ink transition p-1 cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 bg-surface-low border-b border-line flex items-center justify-between text-xs">
                  <span className="text-muted">
                    Total Registrations: <strong className="text-ink">{dbRegistrations.length}</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={fetchRegistrations}
                      disabled={dbLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-c hover:bg-surface-high border border-line text-ink disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition duration-200 cursor-pointer font-bold"
                    >
                      {dbLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Refresh
                    </button>
                    <button
                      onClick={exportToCSV}
                      disabled={dbRegistrations.length === 0}
                      className="sf-cta inline-flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Data Table */}
                <div className="flex-1 overflow-x-auto overflow-y-auto p-6 max-h-[50vh]">
                  {dbLoading && dbRegistrations.length === 0 ? (
                    <div className="text-center py-16 text-muted italic text-sm flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading waitlist...
                    </div>
                  ) : dbRegistrations.length === 0 ? (
                    <div className="text-center py-16 text-muted italic text-sm">
                      No sign-ups recorded yet. Test the waitlist form to see data appear here.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-line text-muted">
                          <th className="pb-3 font-bold pr-4">Email</th>
                          <th className="pb-3 font-bold pr-4">University</th>
                          <th className="pb-3 font-bold pr-4">Destination</th>
                          <th className="pb-3 font-bold pr-4">Pain Point</th>
                          <th className="pb-3 font-bold pr-4 text-center">Desk?</th>
                          <th className="pb-3 font-bold text-right">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {dbRegistrations.map((reg) => (
                          <tr key={reg.id} className="text-ink hover:bg-surface-low">
                            <td className="py-3 font-bold pr-4 select-all text-secondary-dim">{reg.email}</td>
                            <td className="py-3 pr-4 text-muted">{reg.university || <span className="text-muted/60 italic">—</span>}</td>
                            <td className="py-3 pr-4 text-muted">{reg.city || <span className="text-muted/60 italic">Skipped</span>}</td>
                            <td className="py-3 pr-4 text-muted">{reg.pain_point || <span className="text-muted/60 italic">Skipped</span>}</td>
                            <td className="py-3 pr-4 text-center text-muted">{reg.desk_needed || <span className="text-muted/60 italic">Skipped</span>}</td>
                            <td className="py-3 text-right text-muted whitespace-nowrap">
                              {reg.created_at ? new Date(reg.created_at).toLocaleString() : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default App;
