import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  ShieldCheck, 
  DollarSign, 
  ChevronDown, 
  ArrowRight,
  Clock,
  Car,
  Info
} from "lucide-react";
import { Logo } from "./Logo";
import BlurTextAnimation from "./BlurTextAnimation";

interface LandingProps {
  onGuest: () => void;
  onLogin: () => void;
  dark: boolean;
  setDark: (d: boolean) => void;
}

export default function Landing({ onGuest, onLogin, dark, setDark }: LandingProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"commute" | "flood" | "vibe">("commute");
  const [commuteDays, setCommuteDays] = useState(5);

  const faqs = [
    {
      q: "Is SiftPlace really free? How do you make money?",
      a: "Yes, SiftPlace is 100% free for students. We partner directly with verified serviced apartments and monthly rentals in Bangkok. When you book a matched stay, landlords pay us a referral commission. You get the exact same (or cheaper) rate with zero markup fees."
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

  // Container variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 100, damping: 15 }
    }
  };

  return (
    <div className="min-h-screen bg-surface text-ink relative font-sans overflow-x-hidden selection:bg-primary/30 select-none pb-24">
      {/* background glow */}
      <div className="fixed inset-0 -z-10 bg-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.12] via-transparent to-secondary/[0.08]" />
      </div>

      {/* Floating Header */}
      <header className="fixed top-4 left-4 right-4 z-50 max-w-5xl mx-auto flex items-center justify-between px-5 py-3 bg-lowest/85 backdrop-blur-md border-2 border-line rounded-full shadow-sm">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <span className="font-bold text-lg tracking-tight text-primary-dim">SiftPlace</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDark(!dark)}
            aria-label="Toggle dark mode"
            className="h-9 w-9 rounded-full bg-surface-c text-ink text-base flex items-center justify-center transition hover:bg-surface-high active:scale-95 cursor-pointer"
          >
            {dark ? "☀️" : "🌙"}
          </button>
          
          <button
            onClick={onLogin}
            className="px-4 py-1.5 text-xs font-bold rounded-full border-2 border-line bg-lowest text-ink hover:bg-surface-c transition cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section 
        className="max-w-4xl mx-auto px-6 pt-32 pb-16 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        {/* Animated Headline using BlurTextAnimation */}
        <motion.div variants={itemVariants} className="mb-6">
          <BlurTextAnimation 
            text="Find your perfect exchange home in Bangkok."
            fontSize="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight"
            animationDelay={200}
          />
          <p className="text-muted text-base sm:text-lg max-w-xl mx-auto mt-4 font-medium">
            Stop sorting by rent alone. SiftPlace ranks listings by <span className="text-secondary-dim font-bold">True Cost</span> (rent + commute fare) to prevent the hidden travel time penalty.
          </p>
        </motion.div>

        {/* Call to Actions */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
          <button
            onClick={onGuest}
            className="sf-cta flex items-center justify-center gap-2 px-8 py-4 text-base cursor-pointer w-full sm:w-auto"
          >
            <span>Start Browsing as Guest</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          
          <button
            onClick={onLogin}
            className="sf-cta-ghost flex items-center justify-center gap-2 px-8 py-4 text-base cursor-pointer w-full sm:w-auto"
          >
            <span>Login to Sync Saves</span>
          </button>
        </motion.div>

        <motion.p variants={itemVariants} className="text-xs text-muted mt-4 font-semibold">
          ⚡ Free for students • No sign-up required to search
        </motion.p>
      </motion.section>

      {/* Interactive Visualizer Section (Wow factor) */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h3 className="text-center font-bold text-xl sm:text-2xl mb-8">
          The "Rent vs. Commute" Trade-off: Visualized
        </h3>

        {/* Dynamic Commute Slider */}
        <div className="max-w-md mx-auto mb-10 bg-lowest border border-line rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-xs sm:text-sm font-bold">
            <span className="text-ink">Adjust Commute Frequency:</span>
            <span className="text-secondary-dim bg-surface-c rounded-lg px-2.5 py-1">{commuteDays} days/week</span>
          </div>
          <input
            type="range"
            min={1}
            max={7}
            value={commuteDays}
            onChange={(e) => setCommuteDays(Number(e.target.value))}
            className="sift-slider"
            style={{ "--pct": ((commuteDays - 1) / 6) * 100 } as React.CSSProperties}
            aria-label="Commute frequency slider"
          />
          <div className="flex justify-between text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted mt-0.5">
            <span>Rarely (1 day)</span>
            <span>Every day (7 days)</span>
          </div>
        </div>

        {(() => {
          const fareA = Math.round((3400 / 5) * commuteDays);
          const fareB = Math.round((700 / 5) * commuteDays);
          const totalA = 11000 + fareA;
          const totalB = 15000 + fareB;
          const hoursA = Math.round((70 * commuteDays * 4.3) / 60);
          const hoursB = Math.round((15 * commuteDays * 4.3) / 60);
          const gap = Math.abs(totalB - totalA);
          const hoursSaved = Math.round(((70 - 15) * commuteDays * 4.3) / 60);

          return (
            <>
              <div className="grid md:grid-cols-2 gap-8 items-stretch">
                {/* Card A: Cheaper & Far */}
                <div className="sf-well relative overflow-hidden flex flex-col justify-between p-6">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-warn bg-warn-soft px-2 py-0.5 rounded-md">Cheaper but Far</span>
                        <h4 className="font-bold text-lg mt-1">Ari Studio Loft</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted block">Base Rent</span>
                        <span className="font-bold text-xl text-ink">฿11,000/mo</span>
                      </div>
                    </div>

                    {/* Visual Bars */}
                    <div className="space-y-4 my-6">
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>Rent Component</span>
                          <span>฿11,000</span>
                        </div>
                        <div className="h-3 rounded-full bg-surface-c overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(11000 / 16000) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="h-full bg-primary-dim"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>Estimated Daily Grab / Moto Fares</span>
                          <span className="text-warn font-semibold">+ ฿{fareA.toLocaleString()}/mo</span>
                        </div>
                        <div className="h-3 rounded-full bg-surface-c overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(fareA / 16000) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="h-full bg-secondary"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line pt-4 flex justify-between items-center bg-lowest/40 -mx-6 -mb-6 p-6 rounded-b-2xl">
                    <div>
                      <span className="text-xs text-muted block">True Monthly Outlay</span>
                      <span className="font-bold text-2xl text-ink">฿{totalA.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-warn font-bold text-xs bg-warn-soft px-3 py-1.5 rounded-full">
                      <Clock className="h-3.5 w-3.5" />
                      <span>70 min commute/day ({hoursA} hrs/mo)</span>
                    </div>
                  </div>
                </div>

                {/* Card B: Closer but Expensive */}
                <div className="sf-well relative overflow-hidden flex flex-col justify-between p-6">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-ok bg-ok-soft px-2 py-0.5 rounded-md">Pricier but Near</span>
                        <h4 className="font-bold text-lg mt-1">Asok Smart Condo</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted block">Base Rent</span>
                        <span className="font-bold text-xl text-ink">฿15,000/mo</span>
                      </div>
                    </div>

                    {/* Visual Bars */}
                    <div className="space-y-4 my-6">
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>Rent Component</span>
                          <span>฿15,000</span>
                        </div>
                        <div className="h-3 rounded-full bg-surface-c overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(15000 / 16000) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="h-full bg-primary-dim"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>Estimated Daily Grab / Moto Fares</span>
                          <span className="text-ok font-semibold">+ ฿{fareB.toLocaleString()}/mo</span>
                        </div>
                        <div className="h-3 rounded-full bg-surface-c overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(fareB / 16000) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="h-full bg-ok"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line pt-4 flex justify-between items-center bg-lowest/40 -mx-6 -mb-6 p-6 rounded-b-2xl">
                    <div>
                      <span className="text-xs text-muted block">True Monthly Outlay</span>
                      <span className="font-bold text-2xl text-ink">฿{totalB.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-ok font-bold text-xs bg-ok-soft px-3 py-1.5 rounded-full">
                      <Clock className="h-3.5 w-3.5" />
                      <span>15 min commute/day ({hoursB} hrs/mo)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-lowest border border-line rounded-2xl p-4 mt-6 flex flex-col sm:flex-row items-center gap-3">
                <Info className="h-5 w-5 text-secondary flex-shrink-0" />
                <p className="text-xs font-medium text-muted text-center sm:text-left leading-relaxed">
                  The Ari Studio seems ฿4,000 cheaper by rent. But once travel fare is factored in, the true gap is only <span className="font-bold text-ink">฿{gap.toLocaleString()}/mo</span>. 
                  Is saving ฿{gap.toLocaleString()} worth losing <span className="font-bold text-ink">{hoursSaved} full hours</span> to Bangkok traffic every single month? SiftPlace surfaces these choices instantly.
                </p>
              </div>
            </>
          );
        })()}
      </section>

      {/* Feature Demo Showcase (Tabs for interactive exploration) */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <span className="text-xs uppercase tracking-widest text-primary-dim font-bold">Smart Filters</span>
          <h3 className="font-bold text-2xl sm:text-3xl mt-1">Audit what matters to students</h3>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-line mb-6">
          {[
            { id: "commute", label: "Commute Math" },
            { id: "flood", label: "Flood Risks" },
            { id: "vibe", label: "Street Vibes" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-sm font-bold transition border-b-2 cursor-pointer ${
                activeTab === tab.id 
                  ? "border-secondary text-secondary-dim font-black" 
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[280px] md:min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "commute" && (
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3">
                    <h4 className="font-black text-lg text-ink">Commute Value Calculator</h4>
                    <p className="text-xs text-muted leading-relaxed">
                      Enter your university or internship campus coordinates. Our engine plots the exact motor taxi, BTS, MRT, or Grab fares dynamically using local Bangkok rates.
                    </p>
                    <div className="flex items-center gap-2 text-xs font-bold text-secondary-dim">
                      <Car className="h-4 w-4" />
                      <span>Configure your mode & value of time</span>
                    </div>
                  </div>
                  <div className="bg-lowest border border-line rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="text-xs font-bold text-muted uppercase">Commute Config</div>
                    <div className="p-3 bg-surface rounded-xl flex items-center justify-between">
                      <span className="text-xs font-semibold">Days commuting/week</span>
                      <span className="font-bold text-sm bg-primary px-2 py-0.5 rounded">5 days</span>
                    </div>
                    <div className="p-3 bg-surface rounded-xl flex items-center justify-between">
                      <span className="text-xs font-semibold">Preferred Mode</span>
                      <span className="font-bold text-sm bg-primary px-2 py-0.5 rounded">Motorbike Taxi</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "flood" && (
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3">
                    <h4 className="font-black text-lg text-ink">Meteorological Safety Check</h4>
                    <p className="text-xs text-muted leading-relaxed">
                      Bangkok street flooding is unpredictable during monsoon months. SiftPlace maps climatology averages, local street elevation data, and risk parameters to alert you.
                    </p>
                    <div className="flex items-center gap-2 text-xs font-bold text-ok">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Avoid flooded routes automatically</span>
                    </div>
                  </div>
                  <div className="bg-lowest border border-line rounded-2xl p-5 shadow-sm text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn font-black text-lg mb-2">🌧️</div>
                    <h5 className="font-bold text-sm">Monsoon Season Warning</h5>
                    <p className="text-[11px] text-muted mt-1">
                      Sep - Oct stays trigger alerts for low-elevation streets in Huai Khwang and Ramkhamhaeng.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "vibe" && (
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3">
                    <h4 className="font-black text-lg text-ink">Quiet vs. Lively Matching</h4>
                    <p className="text-xs text-muted leading-relaxed">
                      Need a quiet study block? Or looking for vibrant nightlife and street food markets right at your door? Weighted matching customizes suggestions.
                    </p>
                    <div className="flex items-center gap-2 text-xs font-bold text-primary-dim">
                      <Sparkles className="h-4 w-4" />
                      <span>Custom safety & environment vibes</span>
                    </div>
                  </div>
                  <div className="bg-lowest border border-line rounded-2xl p-5 shadow-sm flex flex-wrap gap-2 justify-center">
                    {["☕ Quiet study space", "🍜 Street Food Haven", "🚇 Skytrain walkable", "🏋️ Pool & Gym", "🔒 Gated Security"].map((chip) => (
                      <span key={chip} className="px-3 py-1.5 rounded-full border border-line bg-surface text-xs font-bold text-muted">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Pricing / Trust Card */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-gradient-to-tr from-primary/10 via-lowest to-secondary/10 border border-line rounded-[32px] p-8 text-center relative overflow-hidden shadow-sm">
          <div className="inline-flex items-center justify-center p-3 bg-ok-soft rounded-full text-ok mb-4 border border-ok/20">
            <DollarSign className="h-6 w-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight mb-2">Free for Students & Interns</h2>
          <p className="text-xs text-muted max-w-lg mx-auto leading-relaxed mb-6 font-medium">
            We charge zero platform markup fees. SiftPlace is paid direct commissions by verified properties when you sign a mid-term rental agreement. 
            You secure local rates with built-in scam and deposit protections.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-[11px] text-muted font-bold">
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-ok" /> No extra markups</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-ok" /> Landlord verified properties</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-ok" /> Local exchange student support</span>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h3 className="font-bold text-xl sm:text-2xl text-center mb-8">Frequently Asked Questions</h3>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className="bg-lowest border border-line rounded-2xl overflow-hidden transition shadow-sm"
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full py-4 px-6 flex items-center justify-between text-left font-bold text-ink hover:text-secondary transition text-sm cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-300 ${openFaq === index ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {openFaq === index && (
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-4 text-xs text-muted leading-relaxed border-t border-line pt-3 font-medium">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* Primary CTA Block */}
      <section className="max-w-lg mx-auto text-center px-6 py-16">
        <h3 className="font-black text-2xl mb-2">Ready to find your place?</h3>
        <p className="text-xs text-muted mb-8 font-medium">Skip the spreadsheets. Explore matches rated by true travel costs.</p>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={onGuest}
            className="sf-cta w-full py-4 text-base cursor-pointer"
          >
            Start Browsing as Guest
          </button>
          
          <button
            onClick={onLogin}
            className="sf-cta-ghost w-full py-4 text-base cursor-pointer"
          >
            Sign In with Email or Google
          </button>
        </div>
      </section>
    </div>
  );
}
