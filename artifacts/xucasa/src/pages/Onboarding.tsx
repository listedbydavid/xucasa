import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import SpotlightTour from "@/components/tours/SpotlightTour";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { resolveUserDestination } from "@/shared/routing";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Home, Briefcase, Compass, ArrowRight, ArrowLeft,
  Loader2, MapPin, DollarSign, BedDouble, Bath, Clock, Users,
  Building, FileText, Hash, CheckCircle2, AlertCircle, ShieldCheck,
  X, Sparkles, Building2, Phone, Globe,
} from "lucide-react";

type AgentVerifyResult = {
  verified: boolean;
  mlsInfo?: { memberName?: string; officeName?: string; memberEmail?: string };
  error?: string;
};

type Intent = "buyer" | "homeowner" | "agent" | "explorer" | "lender";
type Step = "intent" | "buyer" | "homeowner" | "agent" | "lender";

const INTENT_CARDS: { id: Intent; title: string; desc: string; icon: typeof Search; color: string }[] = [
  { id: "buyer", title: "I'm looking to buy", desc: "Find your dream home in San Diego", icon: Search, color: "text-blue-500 bg-blue-500/10" },
  { id: "homeowner", title: "I own a home", desc: "Track your home's value and explore selling", icon: Home, color: "text-green-500 bg-green-500/10" },
  { id: "agent", title: "I'm a real estate agent", desc: "Manage listings and connect with clients", icon: Briefcase, color: "text-purple-500 bg-purple-500/10" },
  { id: "lender", title: "I'm a lender", desc: "Connect with buyers and agents as a mortgage professional", icon: Building2, color: "text-indigo-500 bg-indigo-500/10" },
  { id: "explorer", title: "Just exploring", desc: "Browse homes and learn about the market", icon: Compass, color: "text-amber-500 bg-amber-500/10" },
];

const LENDER_SPECIALTIES = ["FHA", "VA", "Jumbo", "Conventional", "USDA", "Reverse Mortgage"];
const TOTAL_LENDER_STEPS = 3;

const CITY_SUGGESTIONS = ["San Diego", "La Jolla", "Chula Vista", "Encinitas", "Carlsbad", "Oceanside", "El Cajon", "Santee", "Escondido", "Coronado"];
const HOME_TYPE_OPTIONS = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Mobile", "Land"];
const TIMELINE_OPTIONS = ["ASAP", "1–3 months", "3–6 months", "6–12 months", "Just browsing"];
const MUST_HAVE_SUGGESTIONS = ["pool", "garage", "ocean view", "single story", "large lot", "updated kitchen", "solar", "ADU", "no HOA", "good schools", "mountain view", "new construction"];
const TOTAL_BUYER_STEPS = 5; // Steps 2..6 in the spec → indexed 1..5 here.

function normalizeTimeline(input: string): string {
  if (!input) return "";
  if (input === "Just browsing") return "just looking";
  return input.replace(/–/g, "-").trim().toLowerCase();
}

export default function Onboarding() {
  usePageMeta({ title: 'Get Started', noIndex: true });
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("intent");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(false);

  // Buyer wizard state — Steps 2-6 in the spec
  const [buyerStep, setBuyerStep] = useState<number>(1);
  const [preferredCities, setPreferredCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [homeTypes, setHomeTypes] = useState<string[]>([]);
  const [minBeds, setMinBeds] = useState<number | undefined>();
  const [maxBeds, setMaxBeds] = useState<number | undefined>();
  const [preApprovalAmount, setPreApprovalAmount] = useState<string>("");
  const [timeline, setTimeline] = useState("");
  const [mustHaves, setMustHaves] = useState<string[]>([]);
  const [mustHaveInput, setMustHaveInput] = useState("");

  const [address, setAddress] = useState("");
  const [homeBeds, setHomeBeds] = useState<number | undefined>();
  const [homeBaths, setHomeBaths] = useState<number | undefined>();
  const [sqft, setSqft] = useState<number | undefined>();
  const [yearBuilt, setYearBuilt] = useState<number | undefined>();
  const [sellingIntent, setSellingIntent] = useState("");

  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("CA");
  const [brokerageName, setBrokerageName] = useState("");
  const [mlsId, setMlsId] = useState("");
  const [association, setAssociation] = useState("");

  // Lender wizard state
  const [lenderStep, setLenderStep] = useState<number>(1);
  const [lenderCompanyName, setLenderCompanyName] = useState("");
  const [lenderNmls, setLenderNmls] = useState("");
  const [lenderLicenseState, setLenderLicenseState] = useState("");
  const [lenderSpecialties, setLenderSpecialties] = useState<string[]>([]);
  const [lenderBio, setLenderBio] = useState("");
  const [lenderPhone, setLenderPhone] = useState("");
  const [lenderWebsite, setLenderWebsite] = useState("");

  const searchParams = new URLSearchParams(window.location.search);
  const reentry = searchParams.get("reentry") === "1";
  const presetIntent = searchParams.get("intent") as Intent | null;

  if (user?.onboardingCompleted && !reentry) {
    setLocation(resolveUserDestination(user));
    return null;
  }

  useEffect(() => {
    if (reentry && presetIntent && ["buyer", "homeowner", "agent"].includes(presetIntent) && step === "intent") {
      setStep(presetIntent as Step);
    }
  }, [reentry, presetIntent]);

  const handleIntentSelect = async (selected: Intent) => {
    setIntent(selected);
    setLoading(true);
    try {
      await apiRequest("POST", "/api/onboarding/intent", { intent: selected });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      if (selected === "explorer") {
        window.location.href = "/swipe";
        return;
      }
      if (selected === "buyer") setBuyerStep(1);
      setStep(selected as Step);
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBuyerSubmit = async () => {
    setLoading(true);
    try {
      const payload: any = {
        preferredCities,
        homeTypes,
        moveInTimeline: normalizeTimeline(timeline),
        mustHaves,
      };
      if (minBeds !== undefined) payload.minBeds = minBeds;
      if (maxBeds !== undefined) payload.maxBeds = maxBeds;
      const cleanBudget = preApprovalAmount.replace(/[^0-9]/g, "");
      if (cleanBudget) payload.preApprovalAmount = parseInt(cleanBudget, 10);

      const res = await apiRequest("POST", "/api/onboarding/buyer", payload);
      const body = await res.json().catch(() => ({}));
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Honor server-provided destination so routing logic stays single-sourced.
      const dest = body?.destination && typeof body.destination === "string" ? body.destination : "/swipe";
      window.location.href = dest;
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Buyer wizard helpers
  const addCity = (city?: string) => {
    const v = (city ?? cityInput).trim();
    if (v && !preferredCities.includes(v)) setPreferredCities([...preferredCities, v]);
    if (!city) setCityInput("");
  };
  const toggleHomeType = (t: string) => {
    setHomeTypes(homeTypes.includes(t) ? homeTypes.filter(x => x !== t) : [...homeTypes, t]);
  };
  const selectBeds = (n: number) => {
    if (minBeds === undefined) { setMinBeds(n); return; }
    if (n === minBeds) { setMinBeds(undefined); setMaxBeds(undefined); return; }
    if (n > minBeds) { setMaxBeds(n === maxBeds ? undefined : n); return; }
    // n < minBeds: reset to single value
    setMinBeds(n); setMaxBeds(undefined);
  };
  const isBedActive = (n: number) => {
    if (minBeds === undefined) return false;
    if (maxBeds === undefined) return n === minBeds;
    return n >= minBeds && n <= maxBeds;
  };
  const formatBudget = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    return digits ? Number(digits).toLocaleString() : "";
  };
  const addMustHave = (m?: string) => {
    const val = (m ?? mustHaveInput).trim().toLowerCase();
    if (val && !mustHaves.includes(val)) setMustHaves([...mustHaves, val]);
    if (!m) setMustHaveInput("");
  };
  const toggleMustHave = (m: string) => {
    setMustHaves(mustHaves.includes(m) ? mustHaves.filter(x => x !== m) : [...mustHaves, m]);
  };

  // Step navigation
  const nextStep = () => setBuyerStep(s => Math.min(s + 1, TOTAL_BUYER_STEPS));
  const prevStep = () => {
    if (buyerStep === 1) { setStep("intent"); return; }
    setBuyerStep(s => s - 1);
  };
  const canProceedStep1 = preferredCities.length > 0;
  const canProceedStep2 = homeTypes.length > 0;
  const canProceedStep4 = !!timeline;

  const handleHomeownerSubmit = async () => {
    if (!address.trim()) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/onboarding/homeowner", {
        address, beds: homeBeds, baths: homeBaths, sqft, yearBuilt, sellingIntent,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/home-report";
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const [agentVerifyResult, setAgentVerifyResult] = useState<AgentVerifyResult | null>(null);

  const handleAgentSubmit = async () => {
    if (!licenseNumber.trim()) return;
    setLoading(true);
    setAgentVerifyResult(null);
    try {
      const res = await apiRequest("POST", "/api/onboarding/agent", {
        licenseNumber: licenseNumber.trim(), licenseState, brokerageName, mlsId, association,
      });
      const data: AgentVerifyResult = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setAgentVerifyResult(data);
    } catch (err: any) {
      setAgentVerifyResult({
        verified: false,
        error: err?.message || "Verification request failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLenderSubmit = async () => {
    if (!lenderCompanyName.trim()) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/onboarding/lender", {
        companyName: lenderCompanyName.trim(),
        nmls: lenderNmls.trim() || undefined,
        licenseState: lenderLicenseState.trim() || undefined,
        specialties: lenderSpecialties,
        bio: lenderBio.trim() || undefined,
        phone: lenderPhone.trim() || undefined,
        website: lenderWebsite.trim() || "",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome aboard!", description: "Your lender profile is set up." });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Could not save", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleLenderSpecialty = (s: string) => {
    setLenderSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const inputClass = "w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-onboarding-title">
            {step === "intent" && `Welcome${user?.firstName ? `, ${user.firstName}` : ""}!`}
            {step === "buyer" && "Tell us about your home search"}
            {step === "homeowner" && "Tell us about your home"}
            {step === "agent" && "Set up your agent profile"}
            {step === "lender" && "Set up your lender profile"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {step === "intent" && "What brings you to xucasa?"}
            {step === "buyer" && "We'll match you with the right homes"}
            {step === "homeowner" && "We'll help you track your home's value"}
            {step === "agent" && "Get verified to manage listings"}
            {step === "lender" && "Connect with buyers and agents"}
          </p>
        </div>

        <SpotlightTour pageKey="onboarding" isAuthenticated={isAuthenticated} />
        {step === "intent" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="intent-grid" data-tour="onboarding-intent">
            {INTENT_CARDS.map(card => (
              <button
                key={card.id}
                onClick={() => handleIntentSelect(card.id)}
                disabled={loading}
                data-testid={`intent-card-${card.id}`}
                className="bg-card border-2 border-border rounded-2xl p-6 text-left hover:border-primary/50 hover:shadow-md transition-all disabled:opacity-50 group"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.desc}</p>
              </button>
            ))}
            {loading && (
              <div className="col-span-full flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}

        {step === "buyer" && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6" data-testid="buyer-wizard" data-tour="onboarding-form">
            {/* Progress bar */}
            <div data-testid="buyer-progress">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Step {buyerStep + 1} of {TOTAL_BUYER_STEPS + 1}</span>
                <span className="text-xs text-muted-foreground">{Math.round(((buyerStep) / TOTAL_BUYER_STEPS) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${(buyerStep / TOTAL_BUYER_STEPS) * 100}%` }}
                />
              </div>
            </div>

            {/* Step 1 (spec Step 2): Where are you looking? */}
            {buyerStep === 1 && (
              <div className="space-y-4" data-testid="buyer-step-cities">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-500" /> Where are you looking to buy?
                  </h2>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                  {preferredCities.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium" data-testid={`tag-city-${i}`}>
                      {c}
                      <button onClick={() => setPreferredCities(preferredCities.filter((_, j) => j !== i))} className="hover:bg-primary/20 rounded-full p-0.5" aria-label={`Remove ${c}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={cityInput}
                  onChange={e => setCityInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCity(); }
                  }}
                  placeholder="Type a city, press Enter to add"
                  className={inputClass}
                  data-testid="input-city"
                />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Popular in San Diego County:</p>
                  <div className="flex flex-wrap gap-2">
                    {CITY_SUGGESTIONS.filter(c => !preferredCities.includes(c)).map(city => (
                      <button
                        key={city}
                        onClick={() => addCity(city)}
                        data-testid={`suggest-city-${city.replace(/\s+/g, "-")}`}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                      >
                        + {city}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { setPreferredCities([]); nextStep(); }}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                  data-testid="button-skip-cities"
                >
                  I'm flexible on location →
                </button>
              </div>
            )}

            {/* Step 2 (spec Step 3): What type of home? */}
            {buyerStep === 2 && (
              <div className="space-y-4" data-testid="buyer-step-hometypes">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-500" /> What type of home are you looking for?
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {HOME_TYPE_OPTIONS.map(t => (
                    <label
                      key={t}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                        homeTypes.includes(t) ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                      data-testid={`hometype-${t.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      <input
                        type="checkbox"
                        checked={homeTypes.includes(t)}
                        onChange={() => toggleHomeType(t)}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                      <span className="text-sm font-semibold text-foreground">{t}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => { setHomeTypes([]); nextStep(); }}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                  data-testid="button-skip-hometypes"
                >
                  Open to anything →
                </button>
              </div>
            )}

            {/* Step 3 (spec Step 4): Bedrooms & budget */}
            {buyerStep === 3 && (
              <div className="space-y-5" data-testid="buyer-step-beds-budget">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-indigo-500" /> How many bedrooms and what's your budget?
                </h2>
                <div>
                  <label className="text-sm font-bold text-foreground mb-2 block">Bedrooms (tap to select range)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => selectBeds(n)}
                        data-testid={`button-beds-${n}`}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                          isBedActive(n) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {n}{n === 5 ? "+" : ""}
                      </button>
                    ))}
                  </div>
                  {minBeds !== undefined && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {maxBeds !== undefined ? `${minBeds} – ${maxBeds === 5 ? "5+" : maxBeds} beds` : `${minBeds}${minBeds === 5 ? "+" : ""} beds`}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground mb-2 block">Pre-approval budget</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground font-semibold">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={preApprovalAmount}
                      onChange={e => setPreApprovalAmount(formatBudget(e.target.value))}
                      placeholder="750,000"
                      className={`${inputClass} pl-8`}
                      data-testid="input-preapproval"
                    />
                  </div>
                </div>
                <button
                  onClick={() => { setMinBeds(undefined); setMaxBeds(undefined); setPreApprovalAmount(""); nextStep(); }}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                  data-testid="button-skip-beds-budget"
                >
                  Not sure yet →
                </button>
              </div>
            )}

            {/* Step 4 (spec Step 5): Timeline */}
            {buyerStep === 4 && (
              <div className="space-y-4" data-testid="buyer-step-timeline">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" /> When are you looking to move?
                </h2>
                <div className="grid grid-cols-1 gap-2">
                  {TIMELINE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setTimeline(opt)}
                      data-testid={`timeline-${opt}`}
                      className={`px-4 py-3 rounded-xl text-sm font-bold border-2 transition-colors text-left ${
                        timeline === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/30"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5 (spec Step 6): Must-haves */}
            {buyerStep === 5 && (
              <div className="space-y-4" data-testid="buyer-step-musthaves">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" /> Any must-haves?
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">These help us find your perfect match</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MUST_HAVE_SUGGESTIONS.map(m => {
                    const active = mustHaves.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => toggleMustHave(m)}
                        data-testid={`musthave-${m.replace(/\s+/g, "-")}`}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                          active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {active ? "✓ " : ""}{m}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Anything else? Add your own:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mustHaveInput}
                      onChange={e => setMustHaveInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addMustHave(); } }}
                      placeholder="e.g. solar panels"
                      className={inputClass}
                      data-testid="input-musthave"
                    />
                  </div>
                  {mustHaves.filter(m => !MUST_HAVE_SUGGESTIONS.includes(m)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {mustHaves.filter(m => !MUST_HAVE_SUGGESTIONS.includes(m)).map((m, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium" data-testid={`tag-musthave-custom-${i}`}>
                          {m}
                          <button onClick={() => setMustHaves(mustHaves.filter(x => x !== m))} className="hover:bg-primary/20 rounded-full p-0.5" aria-label={`Remove ${m}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setMustHaves([]); handleBuyerSubmit(); }}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                  data-testid="button-skip-musthaves"
                >
                  Skip for now →
                </button>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex gap-3 pt-2 border-t border-border">
              <button
                onClick={prevStep}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
                data-testid="button-back-buyer-step"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              {buyerStep < TOTAL_BUYER_STEPS ? (
                <button
                  onClick={nextStep}
                  disabled={
                    (buyerStep === 1 && !canProceedStep1) ||
                    (buyerStep === 2 && !canProceedStep2) ||
                    (buyerStep === 4 && !canProceedStep4)
                  }
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                  data-testid="button-next-buyer-step"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleBuyerSubmit}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                  data-testid="button-buyer-submit"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Start Browsing
                </button>
              )}
            </div>
          </div>
        )}

        {step === "homeowner" && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5" data-testid="homeowner-wizard" data-tour="onboarding-form">
            <div>
              <label className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-500" /> Home Address *
              </label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="123 Main St, San Diego, CA"
                className={inputClass}
                data-testid="input-home-address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-foreground mb-1 block">Beds</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={homeBeds ?? ""}
                  onChange={e => setHomeBeds(e.target.value ? Number(e.target.value) : undefined)}
                  className={inputClass}
                  data-testid="input-home-beds"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-foreground mb-1 block">Baths</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={homeBaths ?? ""}
                  onChange={e => setHomeBaths(e.target.value ? Number(e.target.value) : undefined)}
                  className={inputClass}
                  data-testid="input-home-baths"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-foreground mb-1 block">Sqft</label>
                <input
                  type="number"
                  min={100}
                  value={sqft ?? ""}
                  onChange={e => setSqft(e.target.value ? Number(e.target.value) : undefined)}
                  className={inputClass}
                  data-testid="input-home-sqft"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-foreground mb-1 block">Year Built</label>
                <input
                  type="number"
                  min={1800}
                  max={2030}
                  value={yearBuilt ?? ""}
                  onChange={e => setYearBuilt(e.target.value ? Number(e.target.value) : undefined)}
                  className={inputClass}
                  data-testid="input-home-year"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-foreground mb-2 block">Selling Intent</label>
              <div className="flex flex-wrap gap-2">
                {["Thinking about it", "Ready to sell", "Just tracking value", "Renting it out"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSellingIntent(sellingIntent === opt ? "" : opt)}
                    data-testid={`selling-${opt}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                      sellingIntent === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("intent")}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
                data-testid="button-back-intent"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleHomeownerSubmit}
                disabled={loading || !address.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                data-testid="button-homeowner-submit"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                See My Home Report
              </button>
            </div>
          </div>
        )}

        {step === "agent" && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5" data-testid="agent-wizard" data-tour="onboarding-form">
            <div>
              <label className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-500" /> License Number *
              </label>
              <input
                value={licenseNumber}
                onChange={e => setLicenseNumber(e.target.value)}
                placeholder="e.g. 01234567"
                className={inputClass}
                data-testid="input-license-number"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-foreground mb-1 block">State</label>
                <select
                  value={licenseState}
                  onChange={e => setLicenseState(e.target.value)}
                  className={inputClass}
                  data-testid="select-license-state"
                >
                  <option value="CA">California</option>
                  <option value="AZ">Arizona</option>
                  <option value="NV">Nevada</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-muted-foreground" /> MLS ID
                </label>
                <input
                  value={mlsId}
                  onChange={e => setMlsId(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                  data-testid="input-mls-id"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" /> Brokerage
              </label>
              <input
                value={brokerageName}
                onChange={e => setBrokerageName(e.target.value)}
                placeholder="Your brokerage name"
                className={inputClass}
                data-testid="input-brokerage"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-foreground mb-1 block">Association</label>
              <input
                value={association}
                onChange={e => setAssociation(e.target.value)}
                placeholder="e.g. SDAR, CAR"
                className={inputClass}
                data-testid="input-association"
              />
            </div>

            {agentVerifyResult && (
              <div
                className={`rounded-xl p-4 border ${
                  agentVerifyResult.verified
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                }`}
                data-testid={agentVerifyResult.verified ? "agent-verify-success" : "agent-verify-failure"}
              >
                {agentVerifyResult.verified ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-green-700 dark:text-green-400">License Verified!</p>
                      {agentVerifyResult.mlsInfo?.memberName && (
                        <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                          Matched: {agentVerifyResult.mlsInfo.memberName}
                          {agentVerifyResult.mlsInfo.officeName && ` — ${agentVerifyResult.mlsInfo.officeName}`}
                        </p>
                      )}
                      <p className="text-xs text-green-700 dark:text-green-400 mt-2">
                        You're now a verified agent and can access the Agent Dashboard.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-amber-700 dark:text-amber-400">Could not verify license</p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        {agentVerifyResult.error || "Your license was not found in the MLS database."}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                        Double-check the license number and state, then try again.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("intent")}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
                data-testid="button-back-intent"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              {agentVerifyResult?.verified ? (
                <button
                  onClick={() => { window.location.href = "/agent"; }}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
                  data-testid="button-continue-agent-dashboard"
                >
                  <ArrowRight className="w-4 h-4" />
                  Continue to Agent Dashboard
                </button>
              ) : (
                <button
                  onClick={handleAgentSubmit}
                  disabled={loading || !licenseNumber.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                  data-testid="button-agent-submit"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {agentVerifyResult ? "Try Again" : "Submit for Verification"}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "lender" && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5" data-testid="lender-wizard" data-tour="onboarding-form">
            <div data-testid="lender-progress">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Step {lenderStep} of {TOTAL_LENDER_STEPS}</span>
                <span className="text-xs text-muted-foreground">{Math.round((lenderStep / TOTAL_LENDER_STEPS) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${(lenderStep / TOTAL_LENDER_STEPS) * 100}%` }} />
              </div>
            </div>

            {lenderStep === 1 && (
              <div className="space-y-4" data-testid="lender-step-company">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-500" /> Tell us about your company
                </h2>
                <div>
                  <label className="text-sm font-bold text-foreground mb-1 block">Company name *</label>
                  <input
                    value={lenderCompanyName}
                    onChange={e => setLenderCompanyName(e.target.value)}
                    placeholder="ABC Mortgage"
                    className={inputClass}
                    data-testid="input-lender-company"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground" /> NMLS number
                  </label>
                  <input
                    value={lenderNmls}
                    onChange={e => setLenderNmls(e.target.value)}
                    placeholder="NMLS #123456"
                    className={inputClass}
                    data-testid="input-lender-nmls"
                  />
                </div>
              </div>
            )}

            {lenderStep === 2 && (
              <div className="space-y-4" data-testid="lender-step-license">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-500" /> Your license and specialties
                </h2>
                <div>
                  <label className="text-sm font-bold text-foreground mb-1 block">License state</label>
                  <input
                    value={lenderLicenseState}
                    onChange={e => setLenderLicenseState(e.target.value)}
                    placeholder="CA"
                    className={inputClass}
                    data-testid="input-lender-license-state"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground mb-2 block">Specialties</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LENDER_SPECIALTIES.map(s => {
                      const active = lenderSpecialties.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleLenderSpecialty(s)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm transition-colors ${
                            active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                          }`}
                          data-testid={`button-lender-specialty-${s.replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          {active && <CheckCircle2 className="w-4 h-4" />}
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLenderStep(3)}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                  data-testid="button-lender-skip-step-2"
                >
                  Skip for now →
                </button>
              </div>
            )}

            {lenderStep === 3 && (
              <div className="space-y-4" data-testid="lender-step-contact">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" /> How buyers can reach you
                </h2>
                <div>
                  <label className="text-sm font-bold text-foreground mb-1 block">Bio</label>
                  <textarea
                    value={lenderBio}
                    onChange={e => setLenderBio(e.target.value)}
                    placeholder="Tell buyers and agents about your experience..."
                    rows={3}
                    className={inputClass}
                    data-testid="input-lender-bio"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" /> Phone
                  </label>
                  <input
                    value={lenderPhone}
                    onChange={e => setLenderPhone(e.target.value)}
                    placeholder="(555) 555-5555"
                    className={inputClass}
                    data-testid="input-lender-phone"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" /> Website
                  </label>
                  <input
                    value={lenderWebsite}
                    onChange={e => setLenderWebsite(e.target.value)}
                    placeholder="https://yourcompany.com"
                    className={inputClass}
                    data-testid="input-lender-website"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  if (lenderStep === 1) { setStep("intent"); return; }
                  setLenderStep(s => Math.max(s - 1, 1));
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
                data-testid="button-lender-back"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              {lenderStep < TOTAL_LENDER_STEPS ? (
                <button
                  onClick={() => setLenderStep(s => Math.min(s + 1, TOTAL_LENDER_STEPS))}
                  disabled={lenderStep === 1 && !lenderCompanyName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                  data-testid="button-lender-next"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleLenderSubmit}
                  disabled={loading || !lenderCompanyName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                  data-testid="button-lender-submit"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Finish
                </button>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can always change these later from your dashboard.
        </p>
      </div>
    </div>
  );
}
