import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { resolveUserDestination } from "@shared/routing";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Home, Briefcase, Compass, ArrowRight, ArrowLeft,
  Loader2, MapPin, DollarSign, BedDouble, Bath, Clock, Users,
  Building, FileText, Hash, CheckCircle2, AlertCircle, ShieldCheck,
} from "lucide-react";

type AgentVerifyResult = {
  verified: boolean;
  mlsInfo?: { memberName?: string; officeName?: string; memberEmail?: string };
  error?: string;
};

type Intent = "buyer" | "homeowner" | "agent" | "explorer";
type Step = "intent" | "buyer" | "homeowner" | "agent";

const INTENT_CARDS: { id: Intent; title: string; desc: string; icon: typeof Search; color: string }[] = [
  { id: "buyer", title: "I'm looking to buy", desc: "Find your dream home in San Diego", icon: Search, color: "text-blue-500 bg-blue-500/10" },
  { id: "homeowner", title: "I own a home", desc: "Track your home's value and explore selling", icon: Home, color: "text-green-500 bg-green-500/10" },
  { id: "agent", title: "I'm a real estate agent", desc: "Manage listings and connect with clients", icon: Briefcase, color: "text-purple-500 bg-purple-500/10" },
  { id: "explorer", title: "Just exploring", desc: "Browse homes and learn about the market", icon: Compass, color: "text-amber-500 bg-amber-500/10" },
];

const BUDGET_OPTIONS = ["Under $500K", "$500K–$750K", "$750K–$1M", "$1M–$1.5M", "$1.5M–$2M", "$2M+"];
const AREA_OPTIONS = ["Downtown", "La Jolla", "Pacific Beach", "North Park", "Hillcrest", "Coronado", "Chula Vista", "Encinitas", "Carlsbad", "Oceanside"];
const TIMELINE_OPTIONS = ["ASAP", "1–3 months", "3–6 months", "6–12 months", "Just browsing"];

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("intent");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(false);

  const [budget, setBudget] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [beds, setBeds] = useState<number | undefined>();
  const [baths, setBaths] = useState<number | undefined>();
  const [timeline, setTimeline] = useState("");
  const [hasAgent, setHasAgent] = useState(false);

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
      await apiRequest("POST", "/api/onboarding/buyer", { budget, areas, beds, baths, timeline, hasAgent });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/swipe";
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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

  const toggleArea = (area: string) => {
    setAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
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
          </h1>
          <p className="text-muted-foreground mt-2">
            {step === "intent" && "What brings you to xucasa?"}
            {step === "buyer" && "We'll match you with the right homes"}
            {step === "homeowner" && "We'll help you track your home's value"}
            {step === "agent" && "Get verified to manage listings"}
          </p>
        </div>

        {step === "intent" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="intent-grid">
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
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6" data-testid="buyer-wizard">
            <div>
              <label className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" /> Budget
              </label>
              <div className="flex flex-wrap gap-2">
                {BUDGET_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setBudget(budget === opt ? "" : opt)}
                    data-testid={`budget-${opt}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                      budget === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" /> Preferred Areas
              </label>
              <div className="flex flex-wrap gap-2">
                {AREA_OPTIONS.map(area => (
                  <button
                    key={area}
                    onClick={() => toggleArea(area)}
                    data-testid={`area-${area}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                      areas.includes(area) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-indigo-500" /> Beds
                </label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setBeds(beds === n ? undefined : n)}
                      data-testid={`beds-${n}`}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                        beds === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {n}{n === 5 ? "+" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                  <Bath className="w-4 h-4 text-cyan-500" /> Baths
                </label>
                <div className="flex gap-1">
                  {[1,2,3,4].map(n => (
                    <button
                      key={n}
                      onClick={() => setBaths(baths === n ? undefined : n)}
                      data-testid={`baths-${n}`}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                        baths === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {n}{n === 4 ? "+" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" /> Timeline
              </label>
              <div className="flex flex-wrap gap-2">
                {TIMELINE_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setTimeline(timeline === opt ? "" : opt)}
                    data-testid={`timeline-${opt}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                      timeline === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAgent}
                onChange={e => setHasAgent(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
                data-testid="input-has-agent"
              />
              <span className="text-sm text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" /> I already have a real estate agent
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("intent")}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
                data-testid="button-back-intent"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleBuyerSubmit}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                data-testid="button-buyer-submit"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Start Browsing
              </button>
            </div>
          </div>
        )}

        {step === "homeowner" && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5" data-testid="homeowner-wizard">
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
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5" data-testid="agent-wizard">
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

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can always change these later from your dashboard.
        </p>
      </div>
    </div>
  );
}
