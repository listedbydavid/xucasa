import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Home, DollarSign, TrendingUp, Building2, Shield,
  Landmark, Droplets, GraduationCap, TreePine, Bus, ShoppingCart,
  ChevronDown, ChevronUp, Save, Plus, ArrowRight, BarChart3,
  Ruler, Calendar, Percent, CreditCard, PiggyBank, Calculator,
  Info, Loader2, AlertTriangle, CheckCircle, Layers,
} from "lucide-react";

interface ValuationData {
  estimatedLow: number;
  estimatedMid: number;
  estimatedHigh: number;
  pricePerSqft: number;
  compsCount: number;
  comps: Array<{ id: number; title: string; price: number; beds: number; sqft: number; location: string; distanceMiles: number }>;
}

interface PublicRecordsData {
  neighborhoodStats: { medianIncome: number; medianHomeValue: number; totalPopulation: number; ownerOccupiedPct: number } | null;
  floodInfo: { zone: string; sfha: boolean; description: string } | null;
  nearbyPlaces: { schools: any[]; parks: any[]; hospitals: any[]; transit: any[]; groceries: any[] } | null;
}

interface ZoningData {
  landUse: { primaryType: string; label: string; breakdown: Array<{ type: string; label: string; count: number }> } | null;
  buildingContext: { typicalLevels: number | null; maxLevels: number | null; buildings: any[] } | null;
  elevation: { meters: number; feet: number } | null;
  developmentActivity: { construction: any[]; historic: any[] } | null;
}

interface UserHome {
  id: number;
  nickname: string;
  addressStreetNumber: string | null;
  addressStreetName: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  lat: string | null;
  lng: string | null;
  beds: number | null;
  baths: string | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  homeType: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  principalBalance: number | null;
  appraisedValue: number | null;
  interestRate: string | null;
  loanTerm: number | null;
  monthlyPayment: number | null;
  loanType: string | null;
  estimatedValue: number | null;
  imageUrl: string | null;
}

function formatCurrency(val: number | null | undefined): string {
  if (!val) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatNumber(val: number | null | undefined): string {
  if (!val) return "0";
  return new Intl.NumberFormat("en-US").format(val);
}

function SectionCard({ title, icon: Icon, children, defaultOpen = true, testId }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; testId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden" data-testid={testId}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 md:p-6 text-left"
        data-testid={`${testId}-toggle`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-display font-bold text-foreground">{title}</h2>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 md:px-6 pb-5 md:pb-6 pt-0">{children}</div>}
    </div>
  );
}

function StatBox({ label, value, icon: Icon, sub }: { label: string; value: string; icon: any; sub?: string }) {
  return (
    <div className="bg-muted/50 rounded-xl p-4 text-center">
      <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function HomeReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [address, setAddress] = useState({ street: "", city: "", state: "", zip: "" });
  const [details, setDetails] = useState({ beds: 3, baths: "2", sqft: 1800, lotSize: 5000, yearBuilt: 2000, homeType: "SFH" });
  const [loan, setLoan] = useState({ principalBalance: 0, appraisedValue: 0, interestRate: 0, loanTerm: 30, monthlyPayment: 0, loanType: "fixed", purchasePrice: 0, purchaseDate: "" });
  const [reportGenerated, setReportGenerated] = useState(false);
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);

  const { data: savedHomes } = useQuery<UserHome[]>({
    queryKey: ["/api/my-homes"],
    enabled: isAuthenticated,
  });

  const valuationQuery = useQuery<ValuationData>({
    queryKey: ["/api/valuation", details.beds, details.sqft, geocoded?.lat, geocoded?.lng],
    queryFn: async () => {
      if (!geocoded) throw new Error("No location");
      const res = await fetch(`/api/valuation?beds=${details.beds}&sqft=${details.sqft}&lat=${geocoded.lat}&lng=${geocoded.lng}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: reportGenerated && !!geocoded,
  });

  const publicRecordsQuery = useQuery<PublicRecordsData>({
    queryKey: ["/api/home-report/public-records", address.street, address.city, address.state, address.zip],
    queryFn: async () => {
      const params = new URLSearchParams({
        streetNumber: address.street.split(" ")[0] || "",
        streetName: address.street.split(" ").slice(1).join(" ") || "",
        city: address.city, state: address.state, zip: address.zip,
      });
      const res = await fetch(`/api/home-report/public-records?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: reportGenerated && !!address.city,
  });

  const zoningQuery = useQuery<ZoningData>({
    queryKey: ["/api/home-report/zoning", geocoded?.lat, geocoded?.lng],
    queryFn: async () => {
      if (!geocoded) throw new Error("No location");
      const params = new URLSearchParams({
        streetNumber: address.street.split(" ")[0] || "",
        streetName: address.street.split(" ").slice(1).join(" ") || "",
        city: address.city, state: address.state, zip: address.zip,
        lat: String(geocoded.lat), lng: String(geocoded.lng),
      });
      const res = await fetch(`/api/home-report/zoning?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: reportGenerated && !!geocoded,
  });

  const saveHomeMutation = useMutation({
    mutationFn: async (data: any) => {
      if (selectedHomeId) {
        return apiRequest("PATCH", `/api/my-homes/${selectedHomeId}`, data);
      }
      return apiRequest("POST", "/api/my-homes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-homes"] });
      toast({ title: "Home saved", description: "Your home details have been saved to your account." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save home details.", variant: "destructive" });
    },
  });

  const generateReport = useCallback(async () => {
    if (!address.street || !address.city || !address.state) {
      toast({ title: "Missing address", description: "Please enter a complete address.", variant: "destructive" });
      return;
    }

    try {
      const params = new URLSearchParams({
        streetNumber: address.street.split(" ")[0] || "",
        streetName: address.street.split(" ").slice(1).join(" ") || "",
        city: address.city, state: address.state, zip: address.zip,
      });
      const geoRes = await fetch(`/api/home-report/geocode?${params}`);
      const geoData = await geoRes.json();
      if (geoData.lat && geoData.lng) {
        setGeocoded({ lat: geoData.lat, lng: geoData.lng });
      } else {
        toast({ title: "Could not locate address", description: "Please check the address and try again.", variant: "destructive" });
        return;
      }
    } catch {
      toast({ title: "Geocoding failed", description: "Unable to locate that address.", variant: "destructive" });
      return;
    }

    setReportGenerated(true);
  }, [address, toast]);

  const loadSavedHome = useCallback((home: UserHome) => {
    setSelectedHomeId(home.id);
    const streetParts = [home.addressStreetNumber, home.addressStreetName].filter(Boolean).join(" ");
    setAddress({
      street: streetParts,
      city: home.addressCity || "",
      state: home.addressState || "",
      zip: home.addressZip || "",
    });
    setDetails({
      beds: home.beds || 3,
      baths: home.baths || "2",
      sqft: home.sqft || 1800,
      lotSize: home.lotSize || 5000,
      yearBuilt: home.yearBuilt || 2000,
      homeType: home.homeType || "SFH",
    });
    setLoan({
      principalBalance: home.principalBalance || 0,
      appraisedValue: home.appraisedValue || 0,
      interestRate: home.interestRate ? parseFloat(home.interestRate) : 0,
      loanTerm: home.loanTerm || 30,
      monthlyPayment: home.monthlyPayment || 0,
      loanType: home.loanType || "fixed",
      purchasePrice: home.purchasePrice || 0,
      purchaseDate: home.purchaseDate || "",
    });
    if (home.lat && home.lng) {
      setGeocoded({ lat: parseFloat(home.lat), lng: parseFloat(home.lng) });
      setReportGenerated(true);
    }
  }, []);

  const handleSaveHome = () => {
    const data: any = {
      nickname: `${address.street}, ${address.city}`,
      addressStreetNumber: address.street.split(" ")[0] || "",
      addressStreetName: address.street.split(" ").slice(1).join(" ") || "",
      addressCity: address.city,
      addressState: address.state,
      addressZip: address.zip,
      beds: details.beds,
      baths: details.baths,
      sqft: details.sqft,
      lotSize: details.lotSize,
      yearBuilt: details.yearBuilt,
      homeType: details.homeType,
      ...loan,
      estimatedValue: valuationQuery.data?.estimatedMid || null,
    };
    saveHomeMutation.mutate(data);
  };

  const estimatedValue = valuationQuery.data?.estimatedMid || loan.appraisedValue || 0;
  const equity = estimatedValue - (loan.principalBalance || 0);
  const equityPercent = estimatedValue > 0 ? Math.round((equity / estimatedValue) * 100) : 0;
  const ltv = estimatedValue > 0 ? Math.round(((loan.principalBalance || 0) / estimatedValue) * 100) : 0;

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 text-sm";
  const labelClass = "block text-sm font-medium text-foreground mb-1";

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-gradient-to-b from-primary/5 to-background border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2" data-testid="text-report-title">
            Home Report
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Get a complete picture of your property — valuation, equity, zoning, neighborhood data, and more.
          </p>

          {isAuthenticated && savedHomes && savedHomes.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-muted-foreground mb-2">Load a saved home:</p>
              <div className="flex flex-wrap gap-2">
                {savedHomes.map((h) => (
                  <button
                    key={h.id}
                    data-testid={`button-load-home-${h.id}`}
                    onClick={() => loadSavedHome(h)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      selectedHomeId === h.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-foreground hover:border-primary/30"
                    }`}
                  >
                    {h.nickname}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Street Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    data-testid="input-report-street"
                    type="text"
                    placeholder="123 Main St"
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input
                  data-testid="input-report-city"
                  type="text"
                  placeholder="San Diego"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>State</label>
                  <input
                    data-testid="input-report-state"
                    type="text"
                    placeholder="CA"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>ZIP</label>
                  <input
                    data-testid="input-report-zip"
                    type="text"
                    placeholder="92101"
                    value={address.zip}
                    onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Property Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Beds</label>
                  <input data-testid="input-report-beds" type="number" value={details.beds} onChange={(e) => setDetails({ ...details, beds: parseInt(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Baths</label>
                  <input data-testid="input-report-baths" type="text" value={details.baths} onChange={(e) => setDetails({ ...details, baths: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Sq Ft</label>
                  <input data-testid="input-report-sqft" type="number" value={details.sqft} onChange={(e) => setDetails({ ...details, sqft: parseInt(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Lot Size</label>
                  <input data-testid="input-report-lot" type="number" value={details.lotSize} onChange={(e) => setDetails({ ...details, lotSize: parseInt(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Year Built</label>
                  <input data-testid="input-report-year" type="number" value={details.yearBuilt} onChange={(e) => setDetails({ ...details, yearBuilt: parseInt(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select data-testid="select-report-type" value={details.homeType} onChange={(e) => setDetails({ ...details, homeType: e.target.value })} className={inputClass}>
                    <option value="SFH">Single Family</option>
                    <option value="Condo">Condo</option>
                    <option value="Townhome">Townhome</option>
                    <option value="Multi-Family">Multi-Family</option>
                    <option value="Land">Land</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              data-testid="button-generate-report"
              onClick={generateReport}
              className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              Generate Home Report
            </button>
          </div>
        </div>
      </div>

      {reportGenerated && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {isAuthenticated && (
            <div className="flex justify-end">
              <button
                data-testid="button-save-home"
                onClick={handleSaveHome}
                disabled={saveHomeMutation.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {saveHomeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {selectedHomeId ? "Update Home" : "Save to My Homes"}
              </button>
            </div>
          )}

          <SectionCard title="Property Valuation" icon={TrendingUp} testId="section-valuation">
            {valuationQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Calculating estimate...</span>
              </div>
            ) : valuationQuery.data ? (
              <div className="space-y-6">
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-1">Estimated Market Value</p>
                  <p className="text-4xl md:text-5xl font-display font-bold text-primary" data-testid="text-estimated-value">
                    {formatCurrency(valuationQuery.data.estimatedMid)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Range: {formatCurrency(valuationQuery.data.estimatedLow)} — {formatCurrency(valuationQuery.data.estimatedHigh)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on {valuationQuery.data.compsCount} comparable sales at {formatCurrency(valuationQuery.data.pricePerSqft)}/sq ft
                  </p>
                </div>

                {valuationQuery.data.comps.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">Comparable Sales</p>
                    <div className="space-y-2">
                      {valuationQuery.data.comps.slice(0, 5).map((comp, i) => (
                        <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg p-3 text-sm" data-testid={`comp-${i}`}>
                          <div>
                            <p className="font-medium text-foreground">{comp.title}</p>
                            <p className="text-xs text-muted-foreground">{comp.beds}bd / {formatNumber(comp.sqft)} sqft / {comp.distanceMiles.toFixed(1)} mi</p>
                          </div>
                          <p className="font-bold text-foreground">{formatCurrency(comp.price)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Comparable Sales" value={String(valuationQuery.data.compsCount)} icon={BarChart3} />
                  <StatBox label="Price / Sq Ft" value={formatCurrency(valuationQuery.data.pricePerSqft)} icon={Ruler} />
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Unable to calculate valuation for this address.</p>
            )}
          </SectionCard>

          <SectionCard title="Equity & Loan Details" icon={PiggyBank} testId="section-equity">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Estimated Value</p>
                    <p className="text-2xl font-display font-bold text-foreground" data-testid="text-equity-value">{formatCurrency(estimatedValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Loan Balance</p>
                    <p className="text-2xl font-display font-bold text-foreground" data-testid="text-equity-balance">{formatCurrency(loan.principalBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Your Equity</p>
                    <p className={`text-2xl font-display font-bold ${equity >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`} data-testid="text-equity-amount">
                      {formatCurrency(equity)}
                    </p>
                  </div>
                </div>

                {estimatedValue > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Equity: {equityPercent}%</span>
                      <span>LTV: {ltv}%</span>
                    </div>
                    <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, equityPercent))}%` }}
                        data-testid="bar-equity"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-3">Loan Details</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> Principal Balance</label>
                    <input
                      data-testid="input-loan-balance"
                      type="number"
                      value={loan.principalBalance || ""}
                      onChange={(e) => setLoan({ ...loan, principalBalance: parseInt(e.target.value) || 0 })}
                      placeholder="350,000"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Appraised Value</label>
                    <input
                      data-testid="input-loan-appraised"
                      type="number"
                      value={loan.appraisedValue || ""}
                      onChange={(e) => setLoan({ ...loan, appraisedValue: parseInt(e.target.value) || 0 })}
                      placeholder="500,000"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="w-3 h-3" /> Interest Rate (%)</label>
                    <input
                      data-testid="input-loan-rate"
                      type="number"
                      step="0.125"
                      value={loan.interestRate || ""}
                      onChange={(e) => setLoan({ ...loan, interestRate: parseFloat(e.target.value) || 0 })}
                      placeholder="6.5"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Loan Term (years)</label>
                    <select
                      data-testid="select-loan-term"
                      value={loan.loanTerm}
                      onChange={(e) => setLoan({ ...loan, loanTerm: parseInt(e.target.value) })}
                      className={inputClass}
                    >
                      <option value={15}>15 years</option>
                      <option value={20}>20 years</option>
                      <option value={30}>30 years</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Monthly Payment</label>
                    <input
                      data-testid="input-loan-payment"
                      type="number"
                      value={loan.monthlyPayment || ""}
                      onChange={(e) => setLoan({ ...loan, monthlyPayment: parseInt(e.target.value) || 0 })}
                      placeholder="2,500"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Landmark className="w-3 h-3" /> Loan Type</label>
                    <select
                      data-testid="select-loan-type"
                      value={loan.loanType}
                      onChange={(e) => setLoan({ ...loan, loanType: e.target.value })}
                      className={inputClass}
                    >
                      <option value="fixed">Fixed Rate</option>
                      <option value="adjustable">Adjustable Rate (ARM)</option>
                      <option value="fha">FHA</option>
                      <option value="va">VA</option>
                      <option value="jumbo">Jumbo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-3">Purchase Info</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Purchase Price</label>
                    <input
                      data-testid="input-purchase-price"
                      type="number"
                      value={loan.purchasePrice || ""}
                      onChange={(e) => setLoan({ ...loan, purchasePrice: parseInt(e.target.value) || 0 })}
                      placeholder="450,000"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Purchase Date</label>
                    <input
                      data-testid="input-purchase-date"
                      type="date"
                      value={loan.purchaseDate}
                      onChange={(e) => setLoan({ ...loan, purchaseDate: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
                {loan.purchasePrice > 0 && estimatedValue > 0 && (
                  <div className="mt-3 bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-foreground">
                      Appreciation since purchase:{" "}
                      <span className={estimatedValue > loan.purchasePrice ? "text-green-600 dark:text-green-400 font-bold" : "text-destructive font-bold"}>
                        {formatCurrency(estimatedValue - loan.purchasePrice)} ({((estimatedValue - loan.purchasePrice) / loan.purchasePrice * 100).toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Zoning & Building Potential" icon={Layers} testId="section-zoning">
            {zoningQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Fetching zoning data...</span>
              </div>
            ) : zoningQuery.data ? (
              <div className="space-y-6">
                {zoningQuery.data.landUse && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Land Use Classification</p>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="font-bold text-foreground text-lg" data-testid="text-land-use">{zoningQuery.data.landUse.label}</p>
                      {zoningQuery.data.landUse.breakdown.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {zoningQuery.data.landUse.breakdown.map((item) => {
                            const total = zoningQuery.data!.landUse!.breakdown.reduce((s, b) => s + b.count, 0);
                            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                            return (
                              <div key={item.type} className="flex items-center gap-2">
                                <div className="w-full max-w-[200px] h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{item.label} ({pct}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {zoningQuery.data.buildingContext && (zoningQuery.data.buildingContext.typicalLevels || zoningQuery.data.buildingContext.maxLevels || zoningQuery.data.elevation) && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Building Context</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {zoningQuery.data.buildingContext.typicalLevels && (
                        <StatBox label="Typical Stories" value={String(zoningQuery.data.buildingContext.typicalLevels)} icon={Building2} />
                      )}
                      {zoningQuery.data.buildingContext.maxLevels && (
                        <StatBox label="Max Stories Nearby" value={String(zoningQuery.data.buildingContext.maxLevels)} icon={Building2} />
                      )}
                      {zoningQuery.data.elevation && (
                        <StatBox label="Elevation" value={`${zoningQuery.data.elevation.feet} ft`} icon={TrendingUp} />
                      )}
                    </div>
                  </div>
                )}

                {details.lotSize >= 5000 && details.homeType === "SFH" && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">ADU Potential</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          With a {formatNumber(details.lotSize)} sq ft lot and a single-family zoning designation, this property may qualify for an Accessory Dwelling Unit (ADU) under California state law (AB 68 / SB 13). ADUs can add significant rental income and property value.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {zoningQuery.data.developmentActivity && zoningQuery.data.developmentActivity.construction.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Nearby Development Activity</p>
                    <div className="space-y-2">
                      {zoningQuery.data.developmentActivity.construction.map((site: any, i: number) => (
                        <div key={i} className="bg-muted/50 rounded-lg p-3 text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          <span className="text-foreground">
                            {site.type || "Construction"} — {site.levels || "?"} stories {site.height ? `(${site.height}m)` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Zoning data unavailable for this location.</p>
            )}
          </SectionCard>

          <SectionCard title="Neighborhood Insights" icon={MapPin} defaultOpen={true} testId="section-neighborhood">
            {publicRecordsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading neighborhood data...</span>
              </div>
            ) : publicRecordsQuery.data ? (
              <div className="space-y-6">
                {publicRecordsQuery.data.neighborhoodStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatBox label="Median Income" value={formatCurrency(publicRecordsQuery.data.neighborhoodStats.medianIncome)} icon={DollarSign} />
                    <StatBox label="Median Home Value" value={formatCurrency(publicRecordsQuery.data.neighborhoodStats.medianHomeValue)} icon={Home} />
                    <StatBox label="Population" value={formatNumber(publicRecordsQuery.data.neighborhoodStats.totalPopulation)} icon={Building2} />
                    <StatBox label="Owner Occupied" value={`${publicRecordsQuery.data.neighborhoodStats.ownerOccupiedPct}%`} icon={Home} />
                  </div>
                )}

                {publicRecordsQuery.data.floodInfo && (
                  <div className={`rounded-lg p-4 flex items-start gap-3 ${
                    publicRecordsQuery.data.floodInfo.sfha
                      ? "bg-destructive/10 border border-destructive/20"
                      : "bg-green-500/10 border border-green-500/20"
                  }`}>
                    <Droplets className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                      publicRecordsQuery.data.floodInfo.sfha ? "text-destructive" : "text-green-600 dark:text-green-400"
                    }`} />
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        Flood Zone: {publicRecordsQuery.data.floodInfo.zone}
                        {publicRecordsQuery.data.floodInfo.sfha && " (Special Flood Hazard Area)"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{publicRecordsQuery.data.floodInfo.description}</p>
                    </div>
                  </div>
                )}

                {publicRecordsQuery.data.nearbyPlaces && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">Nearby Amenities</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { key: "schools", icon: GraduationCap, label: "Schools" },
                        { key: "parks", icon: TreePine, label: "Parks" },
                        { key: "transit", icon: Bus, label: "Transit" },
                        { key: "groceries", icon: ShoppingCart, label: "Groceries" },
                      ].map(({ key, icon: AmenityIcon, label }) => {
                        const items = (publicRecordsQuery.data?.nearbyPlaces as any)?.[key] || [];
                        if (items.length === 0) return null;
                        return (
                          <div key={key} className="bg-muted/50 rounded-lg p-3" data-testid={`amenity-${key}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <AmenityIcon className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium text-foreground">{label}</span>
                            </div>
                            <ul className="space-y-1">
                              {items.slice(0, 3).map((item: any, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground">
                                  {item.name || item.type || label} — {item.distance ? `${(item.distance / 1000).toFixed(1)} km` : "nearby"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Neighborhood data unavailable for this location.</p>
            )}
          </SectionCard>

          {!isAuthenticated && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center">
              <h3 className="font-display font-bold text-lg text-foreground mb-2">Save your home report</h3>
              <p className="text-muted-foreground text-sm mb-4">Sign in to save your home details, track equity over time, and get personalized insights.</p>
              <button
                data-testid="button-report-signin"
                onClick={() => setLocation("/auth")}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold transition-all active:scale-95"
              >
                Sign In to Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
