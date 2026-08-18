import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import SpotlightTour from "@/components/tours/SpotlightTour";
import { useToast } from "@/hooks/use-toast";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { Autocomplete } from "@react-google-maps/api";
import {
  MapPin, Home, DollarSign, TrendingUp, Building2, Shield,
  Landmark, Droplets, GraduationCap, TreePine, Bus, ShoppingCart,
  ChevronDown, ChevronUp, Save, Plus, ArrowRight, BarChart3,
  Ruler, Calendar, Percent, CreditCard, PiggyBank, Calculator,
  Info, Loader2, AlertTriangle, CheckCircle, Layers,
  Search, Sparkles, Eye, Star, TrendingDown, RefreshCw,
  Banknote, Key, Hammer, Umbrella, Send, HelpCircle,
  BedDouble, Bath, Maximize2, ChevronLeft, ChevronRight, Tag,
} from "lucide-react";
import { ConcessionForm } from "@/components/ConcessionForm";

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

interface NearbyProperty {
  id: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds: number;
  baths: string;
  sqft: number;
  imageUrl: string | null;
  status: string;
}

function formatCurrency(val: number | null | undefined): string {
  if (!val && val !== 0) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatCompact(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

function formatNumber(val: number | null | undefined): string {
  if (!val) return "0";
  return new Intl.NumberFormat("en-US").format(val);
}

function calcMonthlyPayment(principal: number, annualRate: number, termYears: number): number {
  if (!principal || !annualRate || !termYears) return 0;
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calcTotalInterest(principal: number, annualRate: number, termYears: number): number {
  const monthly = calcMonthlyPayment(principal, annualRate, termYears);
  return monthly * termYears * 12 - principal;
}

function calcPaidSoFar(principal: number, annualRate: number, termYears: number, monthsPaid: number) {
  if (!principal || !annualRate || !termYears || !monthsPaid) return { principalPaid: 0, interestPaid: 0 };
  const r = annualRate / 100 / 12;
  const monthly = calcMonthlyPayment(principal, annualRate, termYears);
  let balance = principal;
  let totalInterest = 0;
  let totalPrincipal = 0;
  for (let i = 0; i < monthsPaid && balance > 0; i++) {
    const interestPayment = balance * r;
    const principalPayment = Math.min(monthly - interestPayment, balance);
    totalInterest += interestPayment;
    totalPrincipal += principalPayment;
    balance -= principalPayment;
  }
  return { principalPaid: Math.round(totalPrincipal), interestPaid: Math.round(totalInterest) };
}

function calcExtraPaymentSavings(balance: number, rate: number, termYears: number, extraMonthly: number) {
  if (!balance || !rate || !termYears) return { savedInterest: 0, monthsSaved: 0 };
  const r = rate / 100 / 12;
  const baseMonthly = calcMonthlyPayment(balance, rate, termYears);
  const totalMonths = termYears * 12;
  let normalBalance = balance;
  let normalMonths = 0;
  let normalInterest = 0;
  while (normalBalance > 0 && normalMonths < totalMonths * 2) {
    const intPay = normalBalance * r;
    normalInterest += intPay;
    normalBalance -= Math.min(baseMonthly - intPay, normalBalance);
    normalMonths++;
  }
  let extraBalance = balance;
  let extraMonths = 0;
  let extraInterest = 0;
  while (extraBalance > 0 && extraMonths < totalMonths * 2) {
    const intPay = extraBalance * r;
    extraInterest += intPay;
    extraBalance -= Math.min(baseMonthly + extraMonthly - intPay, extraBalance);
    extraMonths++;
  }
  return {
    savedInterest: Math.round(normalInterest - extraInterest),
    monthsSaved: normalMonths - extraMonths,
  };
}

function ReportCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}

function PreviewCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:border-primary/30 transition-colors" data-testid={`preview-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-semibold text-foreground text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function PieChart({ principal, interest }: { principal: number; interest: number }) {
  const total = principal + interest;
  if (total === 0) return null;
  const principalPct = (principal / total) * 100;
  const interestPct = (interest / total) * 100;
  const principalAngle = (principalPct / 100) * 360;

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#ef4444" strokeWidth="20"
          strokeDasharray={`${interestPct * 2.51} ${251}`} strokeDashoffset="0" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#22c55e" strokeWidth="20"
          strokeDasharray={`${principalPct * 2.51} ${251}`} strokeDashoffset={`${-interestPct * 2.51}`} />
      </svg>
    </div>
  );
}

const FALLBACK_IMG = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop";

export default function HomeReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { isLoaded } = useGoogleMaps();

  const [fullAddress, setFullAddress] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("address") || "";
  });
  const [addressParts, setAddressParts] = useState({ streetNumber: "", streetName: "", city: "", state: "", zip: "" });
  const [details, setDetails] = useState({ beds: 3, baths: "2", sqft: 1800, lotSize: 5000, yearBuilt: 2000, homeType: "SFH" });
  const [loan, setLoan] = useState({ principalBalance: 0, appraisedValue: 0, interestRate: 5.95, loanTerm: 30, monthlyPayment: 0, loanType: "fixed", purchasePrice: 0, purchaseDate: "" });
  const [reportGenerated, setReportGenerated] = useState(false);
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
  const [autoFilled, setAutoFilled] = useState<{ found: boolean; title?: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [autocompleteRef, setAutocompleteRef] = useState<google.maps.places.Autocomplete | null>(null);
  const [loanConfirmed, setLoanConfirmed] = useState(false);
  const [editingLoan, setEditingLoan] = useState(false);
  const [extraPayment, setExtraPayment] = useState(100);
  const [refiYears, setRefiYears] = useState(10);
  const [airbnbFancy, setAirbnbFancy] = useState(50);
  const [contactQuestion, setContactQuestion] = useState("");
  const [soldScrollIdx, setSoldScrollIdx] = useState(0);

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
    queryKey: ["/api/home-report/public-records", addressParts.streetNumber, addressParts.streetName, addressParts.city, addressParts.state, addressParts.zip],
    queryFn: async () => {
      const params = new URLSearchParams({
        streetNumber: addressParts.streetNumber,
        streetName: addressParts.streetName,
        city: addressParts.city, state: addressParts.state, zip: addressParts.zip,
      });
      const res = await fetch(`/api/home-report/public-records?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: reportGenerated && !!addressParts.city,
  });

  const zoningQuery = useQuery<ZoningData>({
    queryKey: ["/api/home-report/zoning", geocoded?.lat, geocoded?.lng],
    queryFn: async () => {
      if (!geocoded) throw new Error("No location");
      const params = new URLSearchParams({
        streetNumber: addressParts.streetNumber,
        streetName: addressParts.streetName,
        city: addressParts.city, state: addressParts.state, zip: addressParts.zip,
        lat: String(geocoded.lat), lng: String(geocoded.lng),
      });
      const res = await fetch(`/api/home-report/zoning?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: reportGenerated && !!geocoded,
  });

  const recentlySoldQuery = useQuery<NearbyProperty[]>({
    queryKey: ["/api/recently-sold", geocoded?.lat, geocoded?.lng],
    queryFn: async () => {
      if (!geocoded) throw new Error("No location");
      const res = await fetch(`/api/recently-sold?lat=${geocoded.lat}&lng=${geocoded.lng}&limit=9`);
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
      toast({ title: "Home saved", description: "Your home details have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    },
  });

  const onAutocompleteLoad = useCallback((ac: google.maps.places.Autocomplete) => {
    setAutocompleteRef(ac);
  }, []);

  const onPlaceChanged = useCallback(async () => {
    if (!autocompleteRef) return;
    const place = autocompleteRef.getPlace();
    if (!place.geometry) return;

    const lat = place.geometry.location?.lat() ?? null;
    const lng = place.geometry.location?.lng() ?? null;
    const components = place.address_components || [];

    const get = (type: string) => components.find(c => c.types.includes(type))?.long_name || "";
    const getShort = (type: string) => components.find(c => c.types.includes(type))?.short_name || "";

    const streetNumber = get("street_number");
    const streetName = get("route");
    const city = get("locality") || get("sublocality") || get("neighborhood");
    const state = getShort("administrative_area_level_1");
    const zip = get("postal_code");

    setFullAddress(place.formatted_address || "");
    setAddressParts({ streetNumber, streetName, city, state, zip });

    if (lat && lng) {
      setGeocoded({ lat, lng });
    }

    if (streetName && city) {
      setLookingUp(true);
      setAutoFilled(null);
      try {
        const params = new URLSearchParams();
        if (streetNumber) params.set("streetNumber", streetNumber);
        params.set("streetName", streetName);
        params.set("city", city);
        if (state) params.set("state", state);
        if (zip) params.set("zip", zip);
        const res = await fetch(`/api/property-lookup?${params}`);
        const data = await res.json();
        if (data.found) {
          const homeTypeMap: Record<string, string> = {
            "SFH": "SFH", "Single Family Residential": "SFH",
            "Condo": "Condo", "Condominium": "Condo",
            "Townhome": "Townhome", "Townhouse": "Townhome",
            "Multi-Family": "Multi-Family", "Residential Income": "Multi-Family",
            "Land": "Land", "Residential": "SFH",
          };
          setDetails(d => ({
            ...d,
            beds: data.beds ?? d.beds,
            baths: data.baths ? String(data.baths) : d.baths,
            sqft: data.sqft ?? d.sqft,
            lotSize: data.lotSize ?? d.lotSize,
            homeType: homeTypeMap[data.propertyType] || d.homeType,
          }));
          setAutoFilled({ found: true, title: data.title });
          toast({ title: "Property found!", description: "We auto-filled details from MLS records." });
        } else {
          setAutoFilled({ found: false });
        }
      } catch {
        setAutoFilled({ found: false });
      } finally {
        setLookingUp(false);
      }
    }
  }, [autocompleteRef, toast]);

  const generateReport = useCallback(async () => {
    if (!addressParts.city || !addressParts.state) {
      if (!fullAddress) {
        toast({ title: "Missing address", description: "Please enter an address.", variant: "destructive" });
        return;
      }
      try {
        const parts = fullAddress.split(",").map(s => s.trim());
        const streetPart = parts[0] || "";
        const streetWords = streetPart.split(" ");
        const streetNumber = streetWords[0] || "";
        const streetName = streetWords.slice(1).join(" ");
        const city = parts[1] || "";
        const stateZip = (parts[2] || "").split(" ");
        const state = stateZip[0] || "CA";
        const zip = stateZip[1] || "";
        setAddressParts({ streetNumber, streetName, city, state, zip });

        const geoParams = new URLSearchParams({ streetNumber, streetName, city, state, zip });
        const geoRes = await fetch(`/api/home-report/geocode?${geoParams}`);
        const geoData = await geoRes.json();
        if (geoData.lat && geoData.lng) {
          setGeocoded({ lat: geoData.lat, lng: geoData.lng });
        } else {
          toast({ title: "Could not locate address", description: "Please check the address.", variant: "destructive" });
          return;
        }
      } catch {
        toast({ title: "Geocoding failed", variant: "destructive" });
        return;
      }
    } else if (!geocoded) {
      try {
        const geoParams = new URLSearchParams({
          streetNumber: addressParts.streetNumber,
          streetName: addressParts.streetName,
          city: addressParts.city,
          state: addressParts.state,
          zip: addressParts.zip,
        });
        const geoRes = await fetch(`/api/home-report/geocode?${geoParams}`);
        const geoData = await geoRes.json();
        if (geoData.lat && geoData.lng) {
          setGeocoded({ lat: geoData.lat, lng: geoData.lng });
        } else {
          toast({ title: "Could not locate address", variant: "destructive" });
          return;
        }
      } catch {
        toast({ title: "Geocoding failed", variant: "destructive" });
        return;
      }
    }

    setReportGenerated(true);
    setLoanConfirmed(false);
    setEditingLoan(false);
  }, [addressParts, geocoded, fullAddress, toast]);

  const loadSavedHome = useCallback((home: UserHome) => {
    setSelectedHomeId(home.id);
    const streetParts = [home.addressStreetNumber, home.addressStreetName].filter(Boolean).join(" ");
    setFullAddress(`${streetParts}, ${home.addressCity || ""}, ${home.addressState || ""} ${home.addressZip || ""}`);
    setAddressParts({
      streetNumber: home.addressStreetNumber || "",
      streetName: home.addressStreetName || "",
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
      interestRate: home.interestRate ? parseFloat(home.interestRate) : 5.95,
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
      nickname: fullAddress || `${addressParts.streetNumber} ${addressParts.streetName}, ${addressParts.city}`,
      addressStreetNumber: addressParts.streetNumber,
      addressStreetName: addressParts.streetName,
      addressCity: addressParts.city,
      addressState: addressParts.state,
      addressZip: addressParts.zip,
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

  const estimatedValue = valuationQuery.data?.estimatedMid || 0;
  const equity = estimatedValue - (loan.principalBalance || 0);

  const monthsSincePurchase = useMemo(() => {
    if (!loan.purchaseDate) return 12;
    const d = new Date(loan.purchaseDate);
    const now = new Date();
    return Math.max(1, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
  }, [loan.purchaseDate]);

  const paidSoFar = useMemo(() => {
    const originalLoan = loan.purchasePrice ? loan.purchasePrice - (loan.purchasePrice - (loan.principalBalance || loan.purchasePrice * 0.8)) : loan.principalBalance || 0;
    return calcPaidSoFar(originalLoan || loan.principalBalance || 400000, loan.interestRate, loan.loanTerm, monthsSincePurchase);
  }, [loan, monthsSincePurchase]);

  const totalInterest = useMemo(() => {
    return calcTotalInterest(loan.principalBalance || 400000, loan.interestRate, loan.loanTerm);
  }, [loan]);

  const extraSavings = useMemo(() => {
    return calcExtraPaymentSavings(loan.principalBalance || 400000, loan.interestRate, loan.loanTerm, extraPayment);
  }, [loan, extraPayment]);

  const currentMonthly = calcMonthlyPayment(loan.principalBalance || 400000, loan.interestRate, loan.loanTerm);

  const refiOptions = useMemo(() => {
    const balance = loan.principalBalance || 400000;
    const currentRate = loan.interestRate || 5.95;
    const currentPayment = calcMonthlyPayment(balance, currentRate, loan.loanTerm);
    const totalCurrentCost = currentPayment * refiYears * 12;

    const rate30 = 6.125;
    const pay30 = calcMonthlyPayment(balance, rate30, 30);
    const total30 = pay30 * refiYears * 12;

    const rate15 = 5.625;
    const pay15 = calcMonthlyPayment(balance, rate15, 15);
    const total15 = pay15 * refiYears * 12;

    const rate5 = 5.625;
    const pay5 = calcMonthlyPayment(balance, rate5, 30);
    const total5 = pay5 * refiYears * 12;

    return [
      {
        name: "30 Year Fixed", rate: rate30, apr: 6.238,
        savings: Math.round(totalCurrentCost - total30),
        paymentDiff: Math.round(pay30 - currentPayment),
        pros: ["Long term savings" as string], cons: ["Payment might go up"],
        risky: false,
      },
      {
        name: "15 Year Fixed", rate: rate15, apr: 5.811,
        savings: Math.round(totalCurrentCost - total15),
        paymentDiff: Math.round(pay15 - currentPayment),
        pros: ["Long term savings"], cons: ["Payment might go up"],
        risky: false,
      },
      {
        name: "5/1 ARM", rate: rate5, apr: 5.735,
        savings: Math.round(totalCurrentCost - total5),
        paymentDiff: Math.round(pay5 - currentPayment),
        pros: ["Payment might go down"], cons: ["Risky after 5 years"],
        risky: true,
      },
    ];
  }, [loan, refiYears]);

  const purchasingPower = useMemo(() => {
    const equityVal = Math.max(0, equity);
    return {
      newHome: Math.round(equityVal * 3.5),
      investment: Math.round(equityVal * 2.3),
      rentAndBuy: Math.round(equityVal * 3),
      sellAndPocket: Math.round(equityVal),
    };
  }, [equity]);

  const airbnbEstimate = useMemo(() => {
    const baseNightly = Math.round((estimatedValue || 800000) / 3000);
    const fancyMultiplier = 0.7 + (airbnbFancy / 100) * 0.6;
    const nightly = Math.round(baseNightly * fancyMultiplier);
    const nightsPerMonth = Math.round(12 + (airbnbFancy / 100) * 8);
    const monthly = nightly * nightsPerMonth;
    return { nightly, nightsPerMonth, monthly };
  }, [estimatedValue, airbnbFancy]);

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 text-sm";
  const darkInputClass = "w-full px-3 py-2.5 rounded-lg border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 text-sm";

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-gradient-to-b from-primary/5 to-background border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2" data-testid="text-report-title">
            Home Report
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Get a complete picture of your property — valuation, equity, loan analysis, and market insights.
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
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Enter your home's address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                {isLoaded ? (
                  <Autocomplete
                    onLoad={onAutocompleteLoad}
                    onPlaceChanged={onPlaceChanged}
                    options={{ componentRestrictions: { country: "us" }, types: ["address"] }}
                  >
                    <input
                      data-testid="input-report-address"
                      type="text"
                      placeholder="Start typing to search your address..."
                      value={fullAddress}
                      onChange={(e) => setFullAddress(e.target.value)}
                      className={`${inputClass} pl-9`}
                    />
                  </Autocomplete>
                ) : (
                  <input
                    data-testid="input-report-address"
                    type="text"
                    placeholder="123 Main St, San Diego, CA 92101"
                    value={fullAddress}
                    onChange={(e) => setFullAddress(e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                )}
              </div>
              {lookingUp && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Looking up property details...
                </div>
              )}
              {autoFilled?.found && (
                <div className="flex items-center gap-2 mt-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg" data-testid="banner-autofill">
                  <CheckCircle className="w-4 h-4" />
                  Property found! Details auto-filled from MLS records.
                </div>
              )}
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

          {!reportGenerated && (
            <div className="mt-8" data-testid="section-preview-examples">
              <p className="text-center text-muted-foreground text-sm font-medium mb-4">Here's what you'll get in your report</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <PreviewCard icon={TrendingUp} title="Home Valuation" description="Estimated market value based on comparable sales" />
                <PreviewCard icon={PiggyBank} title="Equity Analysis" description="Your home equity, loan-to-value, and net worth" />
                <PreviewCard icon={Calculator} title="Loan Breakdown" description="Principal vs interest paid, payment optimization" />
                <PreviewCard icon={RefreshCw} title="Refinance Options" description="Compare 30yr, 15yr, and ARM refinance scenarios" />
                <PreviewCard icon={Banknote} title="Purchasing Power" description="How much you could afford for your next home" />
                <PreviewCard icon={Key} title="Rental Income" description="Estimated Airbnb revenue for your property" />
                <PreviewCard icon={Home} title="Recently Sold" description="Homes recently sold near your address" />
                <PreviewCard icon={MapPin} title="Neighborhood" description="Schools, transit, parks, and flood risk data" />
              </div>
            </div>
          )}
        </div>
      </div>

      {reportGenerated && (
        <div className="bg-background">
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

            {isAuthenticated && selectedHomeId && (
              <ReportCard>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Tag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-lg">Want to post what you're willing to offer?</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Closing cost help, an assumable loan, flexible move-out, or other terms can attract more buyers.
                      To post seller terms on a xucasa listing, ask your verified listing agent (or contact us at{" "}
                      <a href="mailto:hello@xucasa.com" className="text-primary underline">hello@xucasa.com</a>) — we
                      verify ownership before terms go live.
                    </p>
                  </div>
                </div>
              </ReportCard>
            )}

            {/* PROPERTY VALUATION */}
            <ReportCard>
              <SpotlightTour pageKey="home-report" isAuthenticated={isAuthenticated} />
              <div data-tour="home-report-value" className="contents" />
              {valuationQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Calculating estimate...</span>
                </div>
              ) : valuationQuery.data ? (
                <div className="space-y-6" data-testid="section-valuation">
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-1">Estimated Market Value</p>
                    <p className="text-4xl md:text-5xl font-display font-bold text-primary" data-testid="text-estimated-value">
                      {formatCurrency(valuationQuery.data.estimatedMid)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Range: {formatCurrency(valuationQuery.data.estimatedLow)} — {formatCurrency(valuationQuery.data.estimatedHigh)}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Based on {valuationQuery.data.compsCount} comparable sales at {formatCurrency(valuationQuery.data.pricePerSqft)}/sq ft
                    </p>
                  </div>

                  {valuationQuery.data.comps.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground/80 mb-3">Comparable Sales</p>
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
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Unable to calculate valuation for this address.</p>
              )}
            </ReportCard>

            {/* LOAN CONFIRMATION */}
            <ReportCard>
              <div className="text-center" data-testid="section-loan-confirmation">
                <div className="bg-muted rounded-xl p-5 mb-6">
                  <p className="text-foreground/80 font-medium mb-3">Quick check, here are your estimated loan details:</p>
                  <p className="text-muted-foreground">
                    {loan.loanTerm} year loan at <span className="text-foreground font-bold">{loan.interestRate}%</span> for{" "}
                    <span className="text-foreground font-bold">{formatCurrency(loan.principalBalance || 417192)}</span>
                    {loan.purchaseDate && ` from ${new Date(loan.purchaseDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
                  </p>
                </div>

                {!loanConfirmed && !editingLoan && (
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button
                      data-testid="button-loan-confirm"
                      onClick={() => setLoanConfirmed(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      That looks right
                    </button>
                    <button
                      data-testid="button-loan-edit"
                      onClick={() => setEditingLoan(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium"
                    >
                      <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Change these numbers
                    </button>
                  </div>
                )}

                {loanConfirmed && (
                  <p className="text-green-600 dark:text-green-400 text-sm flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Loan details confirmed
                  </p>
                )}

                {editingLoan && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Principal Balance</label>
                        <input data-testid="input-loan-balance" type="number" value={loan.principalBalance || ""} onChange={(e) => setLoan({ ...loan, principalBalance: parseInt(e.target.value) || 0 })} placeholder="350,000" className={darkInputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Interest Rate (%)</label>
                        <input data-testid="input-loan-rate" type="number" step="0.125" value={loan.interestRate || ""} onChange={(e) => setLoan({ ...loan, interestRate: parseFloat(e.target.value) || 0 })} placeholder="5.95" className={darkInputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Loan Term</label>
                        <select data-testid="select-loan-term" value={loan.loanTerm} onChange={(e) => setLoan({ ...loan, loanTerm: parseInt(e.target.value) })} className={darkInputClass}>
                          <option value={15}>15 years</option>
                          <option value={20}>20 years</option>
                          <option value={30}>30 years</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Purchase Price</label>
                        <input data-testid="input-purchase-price" type="number" value={loan.purchasePrice || ""} onChange={(e) => setLoan({ ...loan, purchasePrice: parseInt(e.target.value) || 0 })} placeholder="450,000" className={darkInputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Purchase Date</label>
                        <input data-testid="input-purchase-date" type="date" value={loan.purchaseDate} onChange={(e) => setLoan({ ...loan, purchaseDate: e.target.value })} className={darkInputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Monthly Payment</label>
                        <input data-testid="input-loan-payment" type="number" value={loan.monthlyPayment || ""} onChange={(e) => setLoan({ ...loan, monthlyPayment: parseInt(e.target.value) || 0 })} placeholder="2,500" className={darkInputClass} />
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditingLoan(false); setLoanConfirmed(true); }}
                      className="bg-primary text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm"
                      data-testid="button-loan-save"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            </ReportCard>

            {/* NET WORTH OF HOME */}
            <ReportCard>
              <div className="text-center" data-testid="section-net-worth">
                <p className="text-muted-foreground mb-2">That means the net worth of the home to you is</p>
                <p className={`text-4xl md:text-5xl font-display font-bold ${equity >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-net-worth">
                  {formatCurrency(equity)}
                </p>
                <p className="text-sm text-muted-foreground/70 mt-3 max-w-md mx-auto">
                  If you sold your home today, this is approximately how much you would put in your pocket (does not include selling fees, e.g., agent commissions, title cost, etc.)
                </p>
              </div>
            </ReportCard>

            {/* RECENTLY SOLD NEARBY */}
            {recentlySoldQuery.data && recentlySoldQuery.data.length > 0 && (
              <ReportCard>
                <div data-testid="section-recently-sold">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-primary font-semibold uppercase tracking-wide">Gallery</p>
                      <p className="text-xl font-bold text-foreground">Homes Near You in {addressParts.zip || addressParts.city}</p>
                      <p className="text-sm text-muted-foreground">Explore to see what the market is like</p>
                    </div>
                    <button
                      onClick={() => setLocation("/buy")}
                      className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors"
                      data-testid="button-view-all-homes"
                    >
                      View all homes
                    </button>
                  </div>

                  <div className="relative">
                    <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                      {recentlySoldQuery.data.map((prop, i) => (
                        <div
                          key={prop.id}
                          className="min-w-[260px] max-w-[280px] bg-muted rounded-xl overflow-hidden flex-shrink-0 snap-start cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                          onClick={() => setLocation(`/property/${prop.id}`)}
                          data-testid={`card-sold-${i}`}
                        >
                          <div className="relative h-40">
                            <img src={prop.imageUrl || FALLBACK_IMG} alt={prop.address} className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              {prop.status === "active" ? "Active" : "Sold"}
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="text-lg font-bold text-foreground">{formatCurrency(prop.price)}</p>
                            <p className="text-xs text-muted-foreground">
                              {prop.beds} beds {prop.baths} baths {formatNumber(prop.sqft)} sqft
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1 truncate">{prop.address}, {prop.city}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ReportCard>
            )}

            {/* WHAT'S IMPORTANT NOW */}
            <ReportCard>
              <div data-testid="section-whats-important">
                <h3 className="text-xl font-bold text-foreground text-center mb-6">What's important now</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-muted rounded-xl p-5 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 bg-muted/80 rounded-full flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-foreground/80" />
                    </div>
                    <p className="text-sm text-foreground/80">
                      Thinking of selling? You have <span className="text-foreground font-bold">{valuationQuery.data?.compsCount || 3}</span> strong selling signals
                    </p>
                    <p className="text-primary text-sm font-medium mt-2 cursor-pointer hover:underline" data-testid="link-selling-signals">Get more details</p>
                  </div>
                  <div className="bg-muted rounded-xl p-5 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 bg-muted/80 rounded-full flex items-center justify-center">
                      <Home className="w-7 h-7 text-foreground/80" />
                    </div>
                    <p className="text-sm text-foreground/80">
                      You might have up to <span className="text-green-600 dark:text-green-400 font-bold">{formatCompact(purchasingPower.newHome)}</span> in purchasing power for a new home
                    </p>
                    <p className="text-primary text-sm font-medium mt-2 cursor-pointer hover:underline" data-testid="link-purchasing-power">Get more details</p>
                  </div>
                  <div className="bg-muted rounded-xl p-5 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 bg-muted/80 rounded-full flex items-center justify-center">
                      <DollarSign className="w-7 h-7 text-foreground/80" />
                    </div>
                    <p className="text-sm text-foreground/80">
                      You could use about <span className="text-green-600 dark:text-green-400 font-bold">{formatCompact(Math.round(equity * 0.3))}</span> of equity to feel more ready for a storm
                    </p>
                    <p className="text-primary text-sm font-medium mt-2 cursor-pointer hover:underline" data-testid="link-equity-cushion">Get more details</p>
                  </div>
                </div>
              </div>
            </ReportCard>

            {/* WHAT YOU'VE PAID SO FAR */}
            <ReportCard>
              <div data-testid="section-paid-so-far">
                <h3 className="text-xl font-bold text-foreground text-center mb-6">What you've paid so far</h3>
                <div className="flex items-center justify-center gap-8 flex-wrap">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Towards Principal</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-principal-paid">{formatCurrency(paidSoFar.principalPaid)}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">How much of your loan<br />you have repaid.</p>
                  </div>
                  <PieChart principal={paidSoFar.principalPaid} interest={paidSoFar.interestPaid} />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Towards Interest</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-interest-paid">{formatCurrency(paidSoFar.interestPaid)}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">What the lender charges<br />you for your loan.</p>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <h4 className="text-lg font-semibold text-foreground mb-1">Interest Adds Up</h4>
                  <p className="text-sm text-muted-foreground">
                    Over your {loan.loanTerm} year loan you'll pay <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(totalInterest)}</span> in interest. There are ways to get ahead and save some of that interest.
                  </p>
                </div>
              </div>
            </ReportCard>

            {/* EXTRA PAYMENT TIP */}
            <ReportCard>
              <div className="text-center" data-testid="section-extra-payment">
                <p className="text-foreground/80 text-lg">
                  Tip: If you pay just{" "}
                  <select
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(parseInt(e.target.value))}
                    className="inline-block bg-muted border border-border rounded px-2 py-1 text-primary font-bold text-lg mx-1"
                    data-testid="select-extra-payment"
                  >
                    <option value={50}>$50</option>
                    <option value={100}>$100</option>
                    <option value={200}>$200</option>
                    <option value={500}>$500</option>
                    <option value={1000}>$1,000</option>
                  </select>{" "}
                  more each month, you could save
                </p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2" data-testid="text-extra-savings">{formatCurrency(extraSavings.savedInterest)}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  in interest over the rest of your loan. You'd also be done with the loan and no longer making payments{" "}
                  <span className="text-green-600 dark:text-green-400 font-medium">{Math.round(extraSavings.monthsSaved / 12)} years earlier</span>!
                </p>
                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  <button className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors" data-testid="button-learn-more">
                    Learn more
                  </button>
                  <button className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors" data-testid="button-already-paid">
                    Already paid extra?
                  </button>
                </div>
              </div>
            </ReportCard>

            {/* REFINANCE COMPARISON */}
            <ReportCard>
              <div data-testid="section-refinance">
                <h3 className="text-xs text-primary font-bold uppercase tracking-widest text-center mb-2">Rates Based On National Trends</h3>
                <h4 className="text-xl font-bold text-foreground text-center mb-2">What could a refi save you in interest?</h4>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  It depends: How many <span className="text-foreground font-bold">more years</span> will you keep this home?
                </p>

                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="bg-muted border border-border rounded-lg px-4 py-2 text-center">
                    <p className="text-2xl font-bold text-foreground">{refiYears}</p>
                  </div>
                </div>
                <div className="px-4 mb-8">
                  <input
                    type="range" min={1} max={30} value={refiYears}
                    onChange={(e) => setRefiYears(parseInt(e.target.value))}
                    className="w-full accent-primary"
                    data-testid="slider-refi-years"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground/70 mt-1">
                    <span>1 year</span>
                    <span>30 years</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {refiOptions.map((opt, i) => (
                    <div key={i} className={`bg-muted border ${i === 2 ? 'border-primary/50' : 'border-border'} rounded-xl p-4`} data-testid={`card-refi-${i}`}>
                      <h5 className="text-sm font-bold text-foreground text-center mb-2">{opt.name}</h5>
                      <p className={`text-xl font-bold text-center ${opt.savings > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {opt.savings > 0 ? '' : '-'}{formatCurrency(Math.abs(opt.savings))}
                      </p>
                      {opt.savings > 0 && <p className="text-xs text-green-600 dark:text-green-400 text-center">Saved Over {refiYears} Years</p>}
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>RATE</span>
                          <span>APR</span>
                        </div>
                        <div className="flex justify-between text-sm text-foreground font-medium">
                          <span>{opt.rate}%</span>
                          <span>{opt.apr}%</span>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        {opt.pros.map((p, j) => (
                          <p key={j} className="text-xs flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                            <span className="text-foreground/80">{p}</span>
                          </p>
                        ))}
                        {opt.cons.map((c, j) => (
                          <p key={j} className="text-xs flex items-center gap-1">
                            {opt.risky ? <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" /> : <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />}
                            <span className="text-foreground/80">{c}</span>
                          </p>
                        ))}
                        <p className="text-xs flex items-center gap-1">
                          <Info className="w-3 h-3 text-muted-foreground/70" />
                          <span className="text-muted-foreground">Rate is estimated</span>
                        </p>
                      </div>
                      <button className="w-full mt-3 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors" data-testid={`button-get-rate-${i}`}>
                        Get rate
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </ReportCard>

            {/* PURCHASING POWER */}
            <ReportCard>
              <div data-testid="section-purchasing-power">
                <h3 className="text-xl font-bold text-foreground text-center mb-6">If you bought another home, how much could you afford?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: Home, label: "Purchase a new home", value: purchasingPower.newHome },
                    { icon: Building2, label: "Buy an investment property", value: purchasingPower.investment },
                    { icon: Key, label: "Rent your home & buy another", value: purchasingPower.rentAndBuy },
                    { icon: Banknote, label: "Sell & pocket the cash", value: purchasingPower.sellAndPocket, dataTour: "sell-cta" },
                  ].map((item, i) => (
                    <div key={i} className="bg-muted rounded-xl p-4 flex items-center justify-between" data-testid={`card-power-${i}`} data-tour={item.dataTour}>
                      <div className="flex items-center gap-3">
                        <item.icon className="w-6 h-6 text-muted-foreground" />
                        <p className="text-sm text-foreground font-medium">{item.label}</p>
                      </div>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCompact(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ReportCard>

            {/* CONTACT Q&A */}
            <ReportCard>
              <div className="flex items-start gap-3" data-testid="section-contact-qa">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-medium mb-2">Do you have any questions?</p>
                  <input
                    type="text"
                    placeholder="What option is best for me?"
                    value={contactQuestion}
                    onChange={(e) => setContactQuestion(e.target.value)}
                    className={darkInputClass}
                    data-testid="input-contact-question"
                  />
                  <button
                    onClick={() => {
                      if (contactQuestion.trim()) {
                        toast({ title: "Message sent!", description: "An agent will get back to you shortly." });
                        setContactQuestion("");
                      }
                    }}
                    className="w-full mt-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3 rounded-lg font-bold text-sm transition-all active:scale-[0.98]"
                    data-testid="button-send-question"
                  >
                    Send
                  </button>
                </div>
              </div>
            </ReportCard>

            {/* HOME EQUITY */}
            <ReportCard>
              <div className="text-center" data-testid="section-home-equity">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCompact(Math.max(0, equity))}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1 mb-3">Your Home Equity</p>
                <p className="text-foreground/80">You can borrow against your equity to put it to use.</p>
                <p className="text-primary text-sm mt-1 cursor-pointer hover:underline">How does using home equity work?</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-800/20 border border-green-300 dark:border-green-700/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <p className="text-green-600 dark:text-green-400 font-bold text-sm">Tackle high-interest debt</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Take advantage of a lower rate to save on interest and potentially pay less each month.</p>
                  <button className="w-full py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1" data-testid="button-tackle-debt">
                    Play with some numbers <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-800/20 border border-green-300 dark:border-green-700/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Hammer className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <p className="text-green-600 dark:text-green-400 font-bold text-sm">Make home improvements</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Boost your home's value by making upgrades or adding more livable space.</p>
                  <button className="w-full py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1" data-testid="button-improvements">
                    More details <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="mt-4 text-center">
                <button className="px-5 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors" data-testid="button-explore-equity">
                  Explore other options for using equity
                </button>
              </div>
            </ReportCard>

            {/* AIRBNB RENTAL ESTIMATE */}
            <ReportCard>
              <div data-testid="section-airbnb">
                <h3 className="text-xl font-bold text-foreground text-center mb-2">
                  If you rented your home on Airbnb, how much could you potentially earn?
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  Showing results for: <span className="text-foreground font-medium">{fullAddress || `${addressParts.streetNumber} ${addressParts.streetName} ${addressParts.city}, ${addressParts.state} ${addressParts.zip}`}</span>
                </p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center bg-muted rounded-xl p-4">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(airbnbEstimate.monthly)}</p>
                  </div>
                  <div className="text-center bg-muted rounded-xl p-4">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Nightly Rate</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(airbnbEstimate.nightly)}</p>
                  </div>
                  <div className="text-center bg-muted rounded-xl p-4">
                    <p className="text-xs text-muted-foreground uppercase mb-1"># of Nights</p>
                    <p className="text-2xl font-bold text-foreground">{airbnbEstimate.nightsPerMonth}/mo</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground/70 text-center mb-4">Estimated based on similar rentals nearby</p>

                <div className="px-4">
                  <p className="text-sm text-muted-foreground text-center mb-2">How nice would you make it?</p>
                  <div className="relative">
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-muted border border-border rounded px-2 py-0.5 text-xs text-foreground" style={{ left: `${airbnbFancy}%` }}>
                      {formatCurrency(airbnbEstimate.nightly)}/night
                    </div>
                    <input
                      type="range" min={0} max={100} value={airbnbFancy}
                      onChange={(e) => setAirbnbFancy(parseInt(e.target.value))}
                      className="w-full accent-pink-500"
                      data-testid="slider-airbnb-fancy"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground/70 mt-1">
                      <span>basic</span>
                      <span>fancy</span>
                    </div>
                  </div>
                </div>
              </div>
            </ReportCard>

            {/* ZONING & BUILDING */}
            <ReportCard>
              <div data-testid="section-zoning">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Zoning & Building Potential</h3>
                </div>
                {zoningQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Fetching zoning data...</span>
                  </div>
                ) : zoningQuery.data ? (
                  <div className="space-y-4">
                    {zoningQuery.data.landUse && (
                      <div className="bg-muted rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Land Use Classification</p>
                        <p className="font-bold text-foreground text-lg" data-testid="text-land-use">{zoningQuery.data.landUse.label}</p>
                        {zoningQuery.data.landUse.breakdown.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {zoningQuery.data.landUse.breakdown.map((item) => {
                              const total = zoningQuery.data!.landUse!.breakdown.reduce((s, b) => s + b.count, 0);
                              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                              return (
                                <div key={item.type} className="flex items-center gap-2">
                                  <div className="w-full max-w-[200px] h-2 bg-muted/80 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">{item.label} ({pct}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {zoningQuery.data.buildingContext && (
                      <div className="grid grid-cols-3 gap-3">
                        {zoningQuery.data.buildingContext.typicalLevels && (
                          <div className="bg-muted rounded-lg p-3 text-center">
                            <Building2 className="w-5 h-5 text-primary mx-auto mb-1" />
                            <p className="text-lg font-bold text-foreground">{zoningQuery.data.buildingContext.typicalLevels}</p>
                            <p className="text-xs text-muted-foreground">Typical Stories</p>
                          </div>
                        )}
                        {zoningQuery.data.buildingContext.maxLevels && (
                          <div className="bg-muted rounded-lg p-3 text-center">
                            <Building2 className="w-5 h-5 text-primary mx-auto mb-1" />
                            <p className="text-lg font-bold text-foreground">{zoningQuery.data.buildingContext.maxLevels}</p>
                            <p className="text-xs text-muted-foreground">Max Stories</p>
                          </div>
                        )}
                        {zoningQuery.data.elevation && (
                          <div className="bg-muted rounded-lg p-3 text-center">
                            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
                            <p className="text-lg font-bold text-foreground">{zoningQuery.data.elevation.feet} ft</p>
                            <p className="text-xs text-muted-foreground">Elevation</p>
                          </div>
                        )}
                      </div>
                    )}

                    {details.lotSize >= 5000 && details.homeType === "SFH" && (
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-foreground text-sm">ADU Potential</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              With a {formatNumber(details.lotSize)} sq ft lot, this property may qualify for an ADU under California law.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Zoning data unavailable.</p>
                )}
              </div>
            </ReportCard>

            {/* NEIGHBORHOOD INSIGHTS */}
            <ReportCard>
              <div data-testid="section-neighborhood">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Neighborhood Insights</h3>
                </div>
                {publicRecordsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Loading neighborhood data...</span>
                  </div>
                ) : publicRecordsQuery.data ? (
                  <div className="space-y-4">
                    {publicRecordsQuery.data.neighborhoodStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "Median Income", value: formatCurrency(publicRecordsQuery.data.neighborhoodStats.medianIncome), icon: DollarSign },
                          { label: "Median Home Value", value: formatCurrency(publicRecordsQuery.data.neighborhoodStats.medianHomeValue), icon: Home },
                          { label: "Population", value: formatNumber(publicRecordsQuery.data.neighborhoodStats.totalPopulation), icon: Building2 },
                          { label: "Owner Occupied", value: `${publicRecordsQuery.data.neighborhoodStats.ownerOccupiedPct}%`, icon: Home },
                        ].map((stat, i) => (
                          <div key={i} className="bg-muted rounded-lg p-3 text-center">
                            <stat.icon className="w-4 h-4 text-primary mx-auto mb-1" />
                            <p className="text-lg font-bold text-foreground">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {publicRecordsQuery.data.floodInfo && (
                      <div className={`rounded-lg p-4 flex items-start gap-3 ${
                        publicRecordsQuery.data.floodInfo.sfha
                          ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30"
                          : "bg-green-900/20 border border-green-300 dark:border-green-700/30"
                      }`}>
                        <Droplets className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                          publicRecordsQuery.data.floodInfo.sfha ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
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
                        <p className="text-sm font-medium text-foreground/80 mb-3">Nearby Amenities</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { key: "schools", icon: GraduationCap, label: "Schools" },
                            { key: "parks", icon: TreePine, label: "Parks" },
                            { key: "transit", icon: Bus, label: "Transit" },
                            { key: "groceries", icon: ShoppingCart, label: "Groceries" },
                          ].map(({ key, icon: AmenityIcon, label }) => {
                            const items = (publicRecordsQuery.data?.nearbyPlaces as any)?.[key] || [];
                            if (items.length === 0) return null;
                            return (
                              <div key={key} className="bg-muted rounded-lg p-3" data-testid={`amenity-${key}`}>
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
                  <p className="text-muted-foreground text-center py-4">Neighborhood data unavailable.</p>
                )}
              </div>
            </ReportCard>

            {!isAuthenticated && (
              <ReportCard>
                <div className="text-center">
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
              </ReportCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
