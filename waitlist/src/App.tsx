import { useEffect, useState } from "react";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import { WaitlistForm } from "@/components/WaitlistForm";
import { AnimatePresence } from "framer-motion";
import { Users, GraduationCap, MapPin, Sparkles, Database, Download, X, HelpCircle, ArrowRight, ShieldCheck, DollarSign } from "lucide-react";

function App() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  // Founders Portal security states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminError, setAdminError] = useState("");

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple, secure founders access key
    if (adminPasswordInput === "123456") {
      setIsAdminAuthenticated(true);
      setAdminError("");
      setAdminPasswordInput("");
    } else {
      setAdminError("Invalid Access Code. Please try again.");
    }
  };

  useEffect(() => {
    // Initialize storage if not present
    if (!localStorage.getItem("siftplace_waitlist")) {
      localStorage.setItem("siftplace_waitlist", JSON.stringify([]));
    }
    
    // Set initial registrations state
    setRegistrations(JSON.parse(localStorage.getItem("siftplace_waitlist") || "[]"));

    // Set up a local interval to poll storage changes so the leaderboard refreshes in real-time
    const interval = setInterval(() => {
      const current = JSON.parse(localStorage.getItem("siftplace_waitlist") || "[]");
      setRegistrations(current);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const getLeaderboardData = () => {
    const counts: Record<string, { count: number; flag: string }> = {};
    
    registrations.forEach((reg) => {
      if (reg.universityName) {
        if (!counts[reg.universityName]) {
          counts[reg.universityName] = { count: 0, flag: reg.universityFlag || "🌐" };
        }
        counts[reg.universityName].count += 1;
      }
    });

    return Object.entries(counts)
      .map(([name, info]) => ({
        name,
        flag: info.flag,
        count: info.count,
      }))
      .sort((a, b) => b.count - a.count)
      .map((item, index) => ({
        rank: index + 1,
        name: item.name,
        flag: item.flag,
        count: item.count,
        trend: index === 0 ? "Hot 🔥" : index < 3 ? "Rising 📈" : "Stable 💤",
        progress: Math.min((item.count / 10) * 100, 100),
      }));
  };

  const leaderboard = getLeaderboardData();

  // Export local registrations to CSV
  const exportToCSV = () => {
    if (registrations.length === 0) return;

    const headers = ["ID", "Email", "University", "Flag", "Destination City", "Pain Point", "Desk Required", "Timestamp"];
    const rows = registrations.map(reg => [
      reg.id || "",
      reg.email || "",
      reg.universityName || "",
      reg.universityFlag || "",
      reg.survey?.city || "",
      reg.survey?.painPoint || "",
      reg.survey?.deskNeeded || "",
      reg.timestamp || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `siftplace_waitlist_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearQueue = () => {
    if (window.confirm("Are you sure you want to clear all registrations? This cannot be undone.")) {
      localStorage.setItem("siftplace_waitlist", JSON.stringify([]));
      setRegistrations([]);
    }
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
    <main className="min-h-screen bg-[#030303] text-white flex flex-col relative scroll-smooth">
      {/* SiftPlace Floating Navbar */}
      <header className="fixed top-4 left-4 right-4 z-50 max-w-7xl mx-auto flex items-center justify-between px-6 py-3 bg-white/[0.02] backdrop-blur-md border border-white/[0.08] rounded-full">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            SiftPlace
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-xs text-white/50 font-medium">
          <a href="#how-it-works" className="hover:text-white transition duration-200">How it Works</a>
          <a href="#features" className="hover:text-white transition duration-200">Features</a>
          <a href="#free-forever" className="hover:text-white transition duration-200">Pricing</a>
          <a href="#faq" className="hover:text-white transition duration-200">FAQ</a>
        </nav>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
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
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                <GraduationCap className="h-4 w-4 text-indigo-400" />
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
                    className="px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05] text-[10px] sm:text-xs text-white/60 font-medium tracking-wide shadow-sm"
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
      <section id="how-it-works" className="py-24 bg-[#030303] border-t border-white/[0.05] relative z-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold block mb-2">The Process</span>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-4">How SiftPlace Works</h2>
            <p className="text-sm text-white/40">Our decision-layer algorithm handles the research so you avoid housing regrets.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {[
              { step: "01", title: "Set Your Weights", desc: "Select budget limits and assign values to commute distance, noise safety, and room workstation specifications." },
              { step: "02", title: "Calculate Real Cost", desc: "Our engine processes neighborhood walkability indices, flood variables, and exact transit routing commute math." },
              { step: "03", title: "Book Hand-Verified Stays", desc: "Receive a hand-verified 'Top 3' recommendation matching your exchange length with protected deposits." }
            ].map((item, index) => (
              <div key={item.step} className="bg-white/[0.01] border border-white/[0.06] rounded-2xl p-8 relative flex flex-col hover:border-white/[0.1] transition duration-300">
                <span className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500/40 to-rose-500/40 mb-4">{item.step}</span>
                <h3 className="font-semibold text-lg text-white mb-2">{item.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 translate-x-1/2 -translate-y-1/2 z-10 text-white/10">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Section Overlay (Brief UX context) */}
      <section id="features" className="py-24 bg-[#030303] border-t border-white/[0.05] relative z-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[10px] text-rose-400 uppercase tracking-widest font-semibold block mb-2">Capabilities</span>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-4">
              Smart Decision Engine Features
            </h2>
            <p className="text-sm text-white/40">
              Unlike traditional booking platforms that optimize purely for listings, SiftPlace audits the details students care about.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/[0.01] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.1] transition duration-300">
              <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 mb-4">
                <MapPin className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-white">True Commute Match</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Calculates true monthly costs by analyzing walkability, BTS/MRT routes, and motorbike taxi costs rather than pure physical distance.
              </p>
            </div>

            <div className="bg-white/[0.01] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.1] transition duration-300">
              <div className="h-10 w-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-400 mb-4">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-white">Hyper-Local Neighborhood Tags</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Filters rentals based on real student metrics like flooding risk, proximity to safe walking routes, local 7-Elevens, and street food.
              </p>
            </div>

            <div className="bg-white/[0.01] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.1] transition duration-300">
              <div className="h-10 w-10 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-400 mb-4">
                <GraduationCap className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-white">Study-Ready Audits</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                We verify features student listing sites omit, checking room layouts for dedicated study desks, natural lighting, and reliable Wi-Fi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Pricing */}
      <section id="free-forever" className="py-24 bg-[#030303] border-t border-white/[0.05] relative z-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-gradient-to-tr from-indigo-500/5 via-white/[0.01] to-rose-500/5 border border-white/[0.08] rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-4 border border-emerald-500/10">
              <DollarSign className="h-6 w-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-4">SiftPlace is 100% Free for Students</h2>
            <p className="text-sm text-white/50 max-w-xl mx-auto leading-relaxed mb-6">
              We charge students $0. No markups, no platform fees. We earn a small referral commission directly from serviced apartments and monthly rentals when you sign a lease. This aligns our goals: we only succeed when we find you a safe, verified home.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-white/40">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Landlord-paid commission</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> No student booking markup</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Best Price Guarantee</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section: FAQ */}
      <section id="faq" className="py-24 bg-[#030303] border-t border-white/[0.05] relative z-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[10px] text-violet-400 uppercase tracking-widest font-semibold block mb-2">Q&A</span>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-4">Frequently Asked Questions</h2>
            <p className="text-sm text-white/40">Everything exchange students need to know before moving.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="bg-white/[0.01] border border-white/[0.06] rounded-xl overflow-hidden transition duration-300"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full py-4 px-6 flex items-center justify-between text-left font-medium text-white hover:text-white/80 transition duration-200 text-sm cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <HelpCircle className={`h-4 w-4 text-white/35 transition-transform duration-300 ${openFaq === index ? "rotate-180 text-indigo-400" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === index && (
                    <div className="px-6 pb-4 text-xs text-white/50 leading-relaxed border-t border-white/[0.03] pt-3">
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
      <section className="py-16 bg-[#030303] border-t border-white/[0.05] relative z-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-semibold uppercase tracking-wider mb-3">
              🔥 Cohort Competition
            </span>
            <h2 className="text-2xl font-bold text-white tracking-tight mb-3">
              Top Exchange University Cohorts
            </h2>
            <p className="text-xs text-white/40 leading-relaxed">
              The university with the most signups this month gets priority access to student discounts. Share with your buddies to push your school up!
            </p>
          </div>

          <div className="bg-white/[0.01] border border-white/[0.06] rounded-2xl p-6 sm:p-8 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
            {leaderboard.length === 0 ? (
              <p className="text-center text-white/40 text-xs py-8 font-light italic">No university cohorts registered yet. Be the first from your school to join the queue!</p>
            ) : (
              leaderboard.map((uni) => (
                <div 
                  key={uni.rank} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.03] hover:border-white/[0.08] transition duration-200"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-6 w-6 rounded-md flex items-center justify-center font-bold text-xs ${
                      uni.rank === 1 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                      uni.rank === 2 ? "bg-slate-400/20 text-slate-300 border border-slate-400/30" :
                      uni.rank === 3 ? "bg-amber-700/20 text-amber-600 border border-amber-700/30" :
                      "bg-white/5 text-white/40"
                    }`}>
                      {uni.rank}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white">{uni.name}</span>
                        <span className="text-sm" role="img" aria-label="flag">{uni.flag}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    <div className="w-24 bg-white/5 rounded-full h-1 overflow-hidden hidden md:block">
                      <div className="bg-indigo-500 h-full" style={{ width: `${uni.progress}%` }} />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/5 font-medium">
                      {uni.trend}
                    </span>
                    <span className="text-sm font-bold text-white whitespace-nowrap">
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
      <footer className="py-12 border-t border-white/[0.05] bg-[#030303] text-center text-xs text-white/30 relative z-20 flex flex-col items-center gap-4">
        <p>&copy; {new Date().getFullYear()} SiftPlace. Built for exchange students by exchange students.</p>
        
        {/* Founders Access Portal Trigger */}
        <button
          onClick={() => setShowAdmin(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-[10px] text-white/40 hover:text-white/60 rounded-md transition duration-200 cursor-pointer"
        >
          <Database className="h-3 w-3" />
          Co-Founders Portal
        </button>
      </footer>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdmin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            {!isAdminAuthenticated ? (
              /* Access Code Challenge Screen */
              <div className="bg-[#0b0b0b] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 flex flex-col shadow-[0_24px_50px_rgba(0,0,0,0.8)] relative">
                <button
                  onClick={() => {
                    setShowAdmin(false);
                    setAdminError("");
                    setAdminPasswordInput("");
                  }}
                  className="absolute top-4 right-4 text-white/35 hover:text-white/60 transition p-1 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
                
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-full text-indigo-400 mb-4 border border-indigo-500/10">
                    <Database className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg text-white mb-2">Co-Founders Portal</h3>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Enter the founders access code to view and export the current waitlist registrations.
                  </p>
                </div>
                
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      required
                      autoFocus
                      placeholder="Access Code"
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-center text-sm"
                    />
                    {adminError && (
                      <p className="text-rose-500 text-[10px] mt-1.5 text-center font-medium">
                        {adminError}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-white text-black hover:bg-white/90 text-xs font-semibold rounded-xl transition duration-200 cursor-pointer shadow-lg active:scale-[0.98]"
                  >
                    Unlock Access
                  </button>
                </form>
              </div>
            ) : (
              /* Authenticated Founders Dashboard */
              <div className="bg-[#0b0b0b] border border-white/[0.1] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-[0_24px_50px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-400" />
                    <h3 className="font-semibold text-lg text-white">SiftPlace Founders Portal</h3>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-medium font-mono">
                      Authenticated
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowAdmin(false);
                      setIsAdminAuthenticated(false);
                      setAdminError("");
                    }}
                    className="text-white/35 hover:text-white/60 transition p-1 cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 bg-white/[0.01] border-b border-white/[0.05] flex items-center justify-between text-xs">
                  <span className="text-white/50">
                    Total Registrations: <strong className="text-white">{registrations.length}</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={exportToCSV}
                      disabled={registrations.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold rounded-lg transition duration-200 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                    <button
                      onClick={clearQueue}
                      disabled={registrations.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition duration-200 cursor-pointer"
                    >
                      Clear Queue
                    </button>
                  </div>
                </div>

                {/* Data Table */}
                <div className="flex-1 overflow-x-auto overflow-y-auto p-6 max-h-[50vh]">
                  {registrations.length === 0 ? (
                    <div className="text-center py-16 text-white/30 italic text-sm">
                      No sign-ups recorded yet. Test the waitlist form to see data appear here in real-time.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.08] text-white/50">
                          <th className="pb-3 font-semibold pr-4">Email</th>
                          <th className="pb-3 font-semibold pr-4">University</th>
                          <th className="pb-3 font-semibold pr-4">Destination</th>
                          <th className="pb-3 font-semibold pr-4">Anxiety / Pain Point</th>
                          <th className="pb-3 font-semibold pr-4 text-center">Desk?</th>
                          <th className="pb-3 font-semibold text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {registrations.map((reg) => (
                          <tr key={reg.id} className="text-white/80 hover:bg-white/[0.01]">
                            <td className="py-3 font-medium pr-4 select-all text-indigo-300">{reg.email}</td>
                            <td className="py-3 pr-4">
                              <span className="mr-1.5">{reg.universityFlag}</span>
                              {reg.universityName}
                            </td>
                            <td className="py-3 pr-4 text-white/60">{reg.survey?.city || <span className="text-white/20 italic">Skipped</span>}</td>
                            <td className="py-3 pr-4 text-white/60">{reg.survey?.painPoint || <span className="text-white/20 italic">Skipped</span>}</td>
                            <td className="py-3 pr-4 text-center text-white/60">{reg.survey?.deskNeeded || <span className="text-white/20 italic">Skipped</span>}</td>
                            <td className="py-3 text-right text-white/40 whitespace-nowrap">
                              {reg.timestamp ? new Date(reg.timestamp).toLocaleString() : "N/A"}
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
