import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin, Home, TrendingUp, Clock, Target, User, CheckCircle2,
  ChevronRight, ChevronLeft, BedDouble, Bath, Maximize2, Ruler,
  Star, ArrowRight, Building2, Calendar, DollarSign, Eye,
  Users, ShieldCheck, Sparkles, Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MOCK_ACTIVE_BUYERS = [
  { name: "Sarah M.", budget: "$850K", beds: "3–4 bd", cities: ["San Diego", "La Jolla"], timeline: "1–3 months", type: "Single Family" },
  { name: "James & Lisa K.", budget: "$1.2M", beds: "4–5 bd", cities: ["Carlsbad", "Encinitas"], timeline: "3–6 months", type: "Single Family" },
  { name: "David R.", budget: "$650K", beds: "2–3 bd", cities: ["San Diego", "Chula Vista"], timeline: "ASAP", type: "Condo" },
  { name: "Michelle T.", budget: "$975K", beds: "3–4 bd", cities: ["Poway", "Scripps Ranch"], timeline: "3–6 months", type: "Single Family" },
  { name: "Carlos & Ana G.", budget: "$550K", beds: "3+ bd", cities: ["Oceanside", "Vista"], timeline: "1–3 months", type: "Townhouse" },
  { name: "Rachel W.", budget: "$1.5M", beds: "4–6 bd", cities: ["La Jolla", "Del Mar"], timeline: "6–12 months", type: "Single Family" },
];

function BuyerDemandSection({ onNavigateToBuyers }: { onNavigateToBuyers: () => void }) {
  return (
    <div className="bg-gradient-to-br from-[#A02020] to-[#7B1818] rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden" data-testid="section-buyer-demand">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-red-300" />
          <span className="text-red-300 text-sm font-semibold uppercase tracking-wide">Buyers Are Waiting</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">100,000+ pre-approved buyers are looking for homes like yours</h2>
        <p className="text-red-100 text-sm sm:text-base mb-6 max-w-xl">
          Skip the waiting game. Real buyers have already posted exactly what they want — budget, bedrooms, neighborhoods, and more. See if your home is a match.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {MOCK_ACTIVE_BUYERS.slice(0, 3).map((buyer, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-4" data-testid={`card-buyer-preview-${i}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-xs font-bold text-white">
                    {buyer.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{buyer.name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-red-300">
                      <ShieldCheck className="w-3 h-3" />
                      Pre-approved
                    </div>
                  </div>
                </div>
                <span className="text-lg font-bold text-red-300">{buyer.budget}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 bg-white/10 rounded-full">{buyer.beds}</span>
                <span className="px-2 py-0.5 bg-white/10 rounded-full">{buyer.type}</span>
                <span className="px-2 py-0.5 bg-white/10 rounded-full">{buyer.timeline}</span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-[11px] text-red-200">
                <MapPin className="w-3 h-3" />
                {buyer.cities.join(", ")}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          {MOCK_ACTIVE_BUYERS.slice(3).map((buyer, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-[10px] font-bold text-white">
                {buyer.name.charAt(0)}
              </div>
              <span className="text-xs text-white font-medium">{buyer.name}</span>
              <span className="text-xs text-red-300 font-bold">{buyer.budget}</span>
            </div>
          ))}
          <span className="text-xs text-red-200">+ 99,994 more buyers...</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={onNavigateToBuyers}
            className="px-6 py-3 bg-white text-[#A02020] hover:bg-red-50 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center gap-2 shadow-lg"
            data-testid="button-view-all-buyers"
          >
            <Send className="w-4 h-4" />
            Browse All Buyers & Pitch Your Home
          </button>
          <div className="flex items-center gap-2 text-sm text-red-200">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span>Average response in 48 hours</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const LIBRARIES: ("places" | "marker")[] = ["places", "marker"];

interface FormData {
  fullAddress: string;
  addressStreetNumber: string;
  addressStreetName: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  lat: number | null;
  lng: number | null;
  beds: number;
  baths: number;
  sqft: number;
  lotSize: number;
  yearBuilt: number;
  homeType: string;
  condition: string;
  hoaFee: number;
  timeline: string;
  motivation: string;
  agentNote: string;
  name: string;
  email: string;
  phone: string;
  listingType: string;
  needsToBuyNext: string;
  hasAgent: string;
  sellerAgentName: string;
  sellerAgentPhone: string;
  sellerAgentEmail: string;
}

interface ValuationResult {
  estimatedLow: number;
  estimatedMid: number;
  estimatedHigh: number;
  pricePerSqft: number;
  compsCount: number;
  comps: { id: number; title: string; price: number; beds: number; sqft: number; location: string; distanceMiles?: number }[];
}

const STEPS = [
  { icon: MapPin, label: "Address" },
  { icon: Home, label: "Details" },
  { icon: TrendingUp, label: "Value" },
  { icon: Target, label: "Goals" },
  { icon: User, label: "Connect" },
  { icon: CheckCircle2, label: "Done" },
];

function fmt(n: number) {
  return "$" + n.toLocaleString();
}

export default function Sell() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState(1);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [autocompleteRef, setAutocompleteRef] = useState<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [showPitchForm, setShowPitchForm] = useState(false);
  const [pitchSent, setPitchSent] = useState(false);
  const [pitchPhotos, setPitchPhotos] = useState<string[]>([]);
  const [pitchDescription, setPitchDescription] = useState("");
  const [pitchPrice, setPitchPrice] = useState("");

  const pitchMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/seller-pitches", data);
    },
    onSuccess: () => {
      setPitchSent(true);
      setShowPitchForm(false);
      toast({ title: "Pitch submitted!", description: "Our team will review your home and match you with interested buyers." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handlePitchSubmit = () => {
    if (!form.name && !user?.firstName) {
      toast({ title: "Name required", description: "Please provide your name in the Connect step or log in.", variant: "destructive" });
      return;
    }
    pitchMutation.mutate({
      name: form.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
      email: form.email || user?.email || "",
      phone: form.phone || null,
      fullAddress: form.fullAddress || null,
      addressCity: form.addressCity || null,
      addressState: form.addressState || null,
      beds: form.beds,
      baths: String(form.baths),
      sqft: form.sqft,
      lotSize: form.lotSize,
      price: pitchPrice ? parseInt(pitchPrice) : null,
      homeType: form.homeType,
      condition: form.condition,
      description: pitchDescription || null,
      photos: pitchPhotos.length > 0 ? pitchPhotos : null,
      timeline: form.timeline,
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setPitchPhotos(prev => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const [form, setForm] = useState<FormData>({
    fullAddress: "",
    addressStreetNumber: "",
    addressStreetName: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
    lat: null,
    lng: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotSize: 5000,
    yearBuilt: 2000,
    homeType: "single-family",
    condition: "good",
    hoaFee: 0,
    timeline: "3-6months",
    motivation: "moving-up",
    agentNote: "",
    name: "",
    email: "",
    phone: "",
    listingType: "standard",
    needsToBuyNext: "",
    hasAgent: "",
    sellerAgentName: "",
    sellerAgentPhone: "",
    sellerAgentEmail: "",
  });

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  const set = (key: keyof FormData, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const onAutocompleteLoad = useCallback((ac: google.maps.places.Autocomplete) => {
    setAutocompleteRef(ac);
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (!autocompleteRef) return;
    const place = autocompleteRef.getPlace();
    if (!place.geometry) return;

    const lat = place.geometry.location?.lat() ?? null;
    const lng = place.geometry.location?.lng() ?? null;
    const components = place.address_components || [];

    const get = (type: string) =>
      components.find(c => c.types.includes(type))?.long_name || "";
    const getShort = (type: string) =>
      components.find(c => c.types.includes(type))?.short_name || "";

    const streetNumber = get("street_number");
    const streetName = get("route");
    const city = get("locality") || get("sublocality") || get("neighborhood");
    const state = getShort("administrative_area_level_1");
    const zip = get("postal_code");

    setForm(f => ({
      ...f,
      fullAddress: place.formatted_address || "",
      addressStreetNumber: streetNumber,
      addressStreetName: streetName,
      addressCity: city,
      addressState: state,
      addressZip: zip,
      lat,
      lng,
    }));
  }, [autocompleteRef]);

  const valuationQuery = useQuery<ValuationResult>({
    queryKey: ["/api/valuation", form.beds, form.sqft],
    enabled: false,
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sell-leads", data),
    onSuccess: () => {
      setStep(6);
    },
    onError: () => {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const fetchValuation = async () => {
    try {
      const params = new URLSearchParams({
        beds: String(form.beds),
        sqft: String(form.sqft),
      });
      if (form.lat) params.set("lat", String(form.lat));
      if (form.lng) params.set("lng", String(form.lng));
      const res = await fetch(`/api/valuation?${params}`);
      const data = await res.json();
      setValuation(data);
      setStep(3);
    } catch {
      toast({ title: "Error", description: "Could not load valuation.", variant: "destructive" });
    }
  };

  const handleSubmit = () => {
    if (!form.name || !form.email) {
      toast({ title: "Missing info", description: "Please enter your name and email.", variant: "destructive" });
      return;
    }
    if (!form.needsToBuyNext) {
      toast({ title: "Required", description: "Please answer whether you need to buy after selling.", variant: "destructive" });
      return;
    }
    if (!form.hasAgent) {
      toast({ title: "Required", description: "Please answer whether you have a real estate agent.", variant: "destructive" });
      return;
    }
    if (form.hasAgent === "yes" && (!form.sellerAgentName || !form.sellerAgentEmail)) {
      toast({ title: "Missing agent info", description: "Please enter your agent's name and email.", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      ...form,
      baths: String(form.baths),
      estimatedValue: valuation?.estimatedMid ?? null,
      lat: form.lat ? String(form.lat) : null,
      lng: form.lng ? String(form.lng) : null,
      needsToBuyNext: form.needsToBuyNext === "yes",
      hasAgent: form.hasAgent === "yes",
      sellerAgentName: form.hasAgent === "yes" ? form.sellerAgentName || null : null,
      sellerAgentPhone: form.hasAgent === "yes" ? form.sellerAgentPhone || null : null,
      sellerAgentEmail: form.hasAgent === "yes" ? form.sellerAgentEmail || null : null,
    });
  };

  const streetViewUrl = form.lat && form.lng
    ? `https://maps.googleapis.com/maps/api/streetview?size=800x300&location=${form.lat},${form.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&fov=90&pitch=0`
    : null;

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="w-6 h-6" />
            <span className="text-primary-foreground/80 text-sm font-medium uppercase tracking-wider">Sell with xucasa</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {step < 3 ? "What's your home worth?" :
             step === 3 ? "Your Home Valuation" :
             step === 6 ? "You're All Set!" : "List Your Home"}
          </h1>
          <p className="text-primary-foreground/80 text-base">
            {step < 3 ? "Get an instant estimate based on recent comparable sales in your area." :
             step === 3 ? "Based on comparable homes sold nearby." :
             step === 6 ? "An agent will reach out within 24 hours." :
             "Tell us a little more to help find the right buyers."}
          </p>
        </div>
      </div>

      {/* Step Progress */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-1 mb-3">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const Icon = s.icon;
              const done = step > n;
              const active = step === n;
              return (
                <div key={n} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex items-center gap-1.5 ${active ? "text-primary" : done ? "text-green-600" : "text-muted-foreground/40"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                      ${active ? "bg-primary text-white" : done ? "bg-green-100 text-green-700" : "bg-muted/50 text-muted-foreground/50"}`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className="hidden sm:inline text-xs font-medium">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${step > n ? "bg-green-400" : "bg-muted/30"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="h-1 bg-muted/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ── STEP 1: Address ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardContent className="pt-6 space-y-5">
                <div>
                  <Label className="text-base font-semibold mb-2 block">Enter your home's address</Label>
                  {isLoaded ? (
                    <Autocomplete
                      onLoad={onAutocompleteLoad}
                      onPlaceChanged={onPlaceChanged}
                      options={{ componentRestrictions: { country: "us" }, types: ["address"] }}
                    >
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          data-testid="input-address"
                          ref={addressInputRef}
                          placeholder="123 Main St, San Francisco, CA 94102"
                          className="pl-10 h-12 text-base"
                          defaultValue={form.fullAddress}
                        />
                      </div>
                    </Autocomplete>
                  ) : (
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        data-testid="input-address-fallback"
                        placeholder="123 Main St, San Francisco, CA 94102"
                        className="pl-10 h-12 text-base"
                        value={form.fullAddress}
                        onChange={e => set("fullAddress", e.target.value)}
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Start typing to search your address</p>
                </div>

                {/* Street View Preview */}
                {streetViewUrl && (
                  <div className="rounded-xl overflow-hidden border shadow-sm">
                    <div className="relative">
                      <img
                        src={streetViewUrl}
                        alt="Street View"
                        className="w-full h-48 object-cover"
                        onError={e => { (e.target as HTMLElement).style.display = "none"; }}
                      />
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="bg-black/60 text-white border-0 gap-1">
                          <Eye className="w-3 h-3" />
                          Street View
                        </Badge>
                      </div>
                    </div>
                    {form.fullAddress && (
                      <div className="bg-muted/30 px-4 py-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium">{form.fullAddress}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* What you get */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: TrendingUp, title: "Instant Estimate", desc: "Based on recent comps" },
                { icon: Star, title: "Expert Agents", desc: "Matched to your area" },
                { icon: DollarSign, title: "No commitment", desc: "Free, no obligation" },
              ].map(({ icon: Icon, title, desc }) => (
                <Card key={title} className="shadow-sm text-center">
                  <CardContent className="pt-5 pb-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              data-testid="button-step1-next"
              size="lg"
              className="w-full gap-2"
              onClick={() => {
                if (!form.fullAddress && !addressInputRef.current?.value) {
                  toast({ title: "Address required", description: "Please enter your home's address.", variant: "destructive" });
                  return;
                }
                if (addressInputRef.current?.value && !form.fullAddress) {
                  set("fullAddress", addressInputRef.current.value);
                }
                setStep(2);
              }}
            >
              Get My Estimate <ChevronRight className="w-4 h-4" />
            </Button>

            <BuyerDemandSection onNavigateToBuyers={() => navigate("/buyers")} />
          </div>
        )}

        {/* ── STEP 2: Home Details ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                    <Home className="w-5 h-5 text-primary" />
                    Tell us about your home
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    The more details you provide, the more accurate your estimate.
                  </p>
                </div>

                {/* Beds / Baths */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <BedDouble className="w-4 h-4 text-muted-foreground" />
                      Bedrooms
                    </Label>
                    <Select value={String(form.beds)} onValueChange={v => set("beds", parseInt(v))}>
                      <SelectTrigger data-testid="select-beds">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} bed{n > 1 ? "s" : ""}</SelectItem>
                        ))}
                        <SelectItem value="7">7+ beds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Bath className="w-4 h-4 text-muted-foreground" />
                      Bathrooms
                    </Label>
                    <Select value={String(form.baths)} onValueChange={v => set("baths", parseFloat(v))}>
                      <SelectTrigger data-testid="select-baths">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} bath{n > 1 ? "s" : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Sqft / Lot size */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Maximize2 className="w-4 h-4 text-muted-foreground" />
                      Home Size (sq ft)
                    </Label>
                    <Input
                      data-testid="input-sqft"
                      type="number"
                      value={form.sqft}
                      onChange={e => set("sqft", parseInt(e.target.value) || 0)}
                      placeholder="1,800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Ruler className="w-4 h-4 text-muted-foreground" />
                      Lot Size (sq ft)
                    </Label>
                    <Input
                      data-testid="input-lot-size"
                      type="number"
                      value={form.lotSize}
                      onChange={e => set("lotSize", parseInt(e.target.value) || 0)}
                      placeholder="5,000"
                    />
                  </div>
                </div>

                {/* Year built / Home type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      Year Built
                    </Label>
                    <Input
                      data-testid="input-year-built"
                      type="number"
                      value={form.yearBuilt}
                      onChange={e => set("yearBuilt", parseInt(e.target.value) || 2000)}
                      placeholder="2000"
                      min="1800"
                      max={new Date().getFullYear()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      Home Type
                    </Label>
                    <Select value={form.homeType} onValueChange={v => set("homeType", v)}>
                      <SelectTrigger data-testid="select-home-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single-family">Single Family</SelectItem>
                        <SelectItem value="condo">Condo / Apartment</SelectItem>
                        <SelectItem value="townhouse">Townhouse</SelectItem>
                        <SelectItem value="multi-family">Multi-Family</SelectItem>
                        <SelectItem value="land">Land / Lot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Condition / HOA */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Home Condition</Label>
                    <Select value={form.condition} onValueChange={v => set("condition", v)}>
                      <SelectTrigger data-testid="select-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent – Move-in ready</SelectItem>
                        <SelectItem value="good">Good – Minor updates</SelectItem>
                        <SelectItem value="fair">Fair – Some work needed</SelectItem>
                        <SelectItem value="needs-work">Needs Work – Fixer upper</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>HOA Fee / month</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        data-testid="input-hoa"
                        type="number"
                        className="pl-8"
                        value={form.hoaFee || ""}
                        onChange={e => set("hoaFee", parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pitch to Buyers CTA */}
            {!pitchSent ? (
              <Card className="shadow-sm border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 overflow-hidden">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-semibold text-emerald-900">Want buyers to come to you?</h3>
                  </div>
                  <p className="text-sm text-emerald-700 mb-4">
                    100,000+ pre-approved buyers are actively looking. Submit your home details and photos — our team will match you with the right buyers.
                  </p>

                  {!showPitchForm ? (
                    <Button
                      data-testid="button-open-pitch-form"
                      className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
                      onClick={() => setShowPitchForm(true)}
                    >
                      <Send className="w-4 h-4" />
                      Pitch My Home to Buyers
                    </Button>
                  ) : (
                    <div className="space-y-4 mt-4 pt-4 border-t border-emerald-200">
                      <div>
                        <Label className="text-sm font-medium mb-1 block">Your Asking Price (optional)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            data-testid="input-pitch-price"
                            type="number"
                            className="pl-8"
                            value={pitchPrice}
                            onChange={e => setPitchPrice(e.target.value)}
                            placeholder="e.g. 850000"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-1 block">Tell us about your home</Label>
                        <Textarea
                          data-testid="input-pitch-description"
                          value={pitchDescription}
                          onChange={e => setPitchDescription(e.target.value)}
                          placeholder="Describe what makes your home special — recent upgrades, neighborhood highlights, unique features..."
                          className="min-h-[100px] resize-none"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-2 block">Upload Photos</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {pitchPhotos.map((photo, i) => (
                            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
                              <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                              <button
                                onClick={() => setPitchPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                data-testid={`button-remove-photo-${i}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-emerald-300 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 transition-colors" data-testid="button-upload-photos">
                            <Eye className="w-5 h-5 text-emerald-400" />
                            <span className="text-[10px] text-emerald-500 mt-0.5">Add</span>
                            <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">Add photos of your home to attract more buyers</p>
                      </div>

                      {!isAuthenticated && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm font-medium mb-1 block">Your Name *</Label>
                            <Input
                              data-testid="input-pitch-name"
                              value={form.name}
                              onChange={e => set("name", e.target.value)}
                              placeholder="Full name"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-1 block">Email *</Label>
                            <Input
                              data-testid="input-pitch-email"
                              type="email"
                              value={form.email}
                              onChange={e => set("email", e.target.value)}
                              placeholder="you@email.com"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowPitchForm(false)}
                          data-testid="button-cancel-pitch"
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
                          onClick={handlePitchSubmit}
                          disabled={pitchMutation.isPending}
                          data-testid="button-submit-pitch"
                        >
                          <Send className="w-4 h-4" />
                          {pitchMutation.isPending ? "Submitting..." : "Submit to xucasa Team"}
                        </Button>
                      </div>

                      <p className="text-xs text-emerald-600/70 text-center">
                        Your pitch goes directly to the xucasa team — we'll review it and connect you with matching buyers.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm border-green-300 bg-green-50">
                <CardContent className="pt-5 pb-5 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-semibold text-green-800">Pitch submitted!</p>
                  <p className="text-sm text-green-700">Our team will review your home and reach out with matching buyers.</p>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button
                data-testid="button-step2-back"
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => setStep(1)}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                data-testid="button-step2-next"
                size="lg"
                className="flex-1 gap-2"
                onClick={fetchValuation}
              >
                Get My Valuation <TrendingUp className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Valuation ────────────────────────────────────── */}
        {step === 3 && valuation && (
          <div className="space-y-6">
            {/* Main valuation card */}
            <Card className="shadow-md border-primary/20 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 pt-6 pb-2">
                <p className="text-sm text-muted-foreground font-medium mb-1 uppercase tracking-wide">Estimated Home Value</p>
                <div className="flex items-end gap-3 mb-1">
                  <p className="text-5xl font-bold text-foreground">{fmt(valuation.estimatedMid)}</p>
                  <Badge className="mb-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                    xucasa Estimate
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Range: <span className="font-medium text-foreground">{fmt(valuation.estimatedLow)}</span>
                  {" – "}
                  <span className="font-medium text-foreground">{fmt(valuation.estimatedHigh)}</span>
                </p>

                {/* Visual range bar */}
                <div className="relative mb-6">
                  <div className="h-3 bg-gradient-to-r from-amber-300 via-green-400 to-amber-300 rounded-full" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-primary rounded-full shadow-md" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                    <span>{fmt(valuation.estimatedLow)}</span>
                    <span className="font-semibold text-foreground">{fmt(valuation.estimatedMid)}</span>
                    <span>{fmt(valuation.estimatedHigh)}</span>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <CardContent className="pt-4 pb-5">
                <div className="grid grid-cols-3 divide-x text-center">
                  <div className="px-4">
                    <p className="text-2xl font-bold text-foreground">${valuation.pricePerSqft}</p>
                    <p className="text-xs text-muted-foreground">Price per sq ft</p>
                  </div>
                  <div className="px-4">
                    <p className="text-2xl font-bold text-foreground">{form.sqft.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Sq ft</p>
                  </div>
                  <div className="px-4">
                    <p className="text-2xl font-bold text-foreground">{valuation.compsCount}</p>
                    <p className="text-xs text-muted-foreground">Comparable sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Home details summary */}
            <Card className="shadow-sm">
              <CardContent className="pt-5 pb-4">
                <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Your Home</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { icon: BedDouble, label: `${form.beds} beds` },
                    { icon: Bath, label: `${form.baths} baths` },
                    { icon: Maximize2, label: `${form.sqft.toLocaleString()} sq ft` },
                    { icon: Ruler, label: `${form.lotSize.toLocaleString()} lot` },
                    { icon: Calendar, label: `Built ${form.yearBuilt}` },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-full text-sm">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Comparable homes */}
            {valuation.comps.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Comparable Homes Used
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {valuation.comps.map(comp => (
                    <Card key={comp.id} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/property/${comp.id}`)}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm line-clamp-1">{comp.title}</p>
                            <p className="text-xs text-muted-foreground">{comp.location}</p>
                          </div>
                          <p className="text-sm font-bold text-primary ml-2">{fmt(comp.price)}</p>
                        </div>
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span>{comp.beds} bd</span>
                          <span>{comp.sqft.toLocaleString()} sqft</span>
                          <span className="text-primary font-medium">${Math.round(comp.price / comp.sqft)}/sqft</span>
                          {comp.distanceMiles !== undefined && (
                            <span className="ml-auto text-green-700 font-medium">{comp.distanceMiles} mi away</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Market insights */}
            <Card className="shadow-sm bg-blue-50/50 border-blue-100">
              <CardContent className="pt-5 pb-4">
                <h3 className="text-sm font-semibold mb-3 text-blue-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Market Insights
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg. days on market</span>
                    <span className="font-medium">18–32 days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Seller's market score</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: "72%" }} />
                      </div>
                      <span className="font-medium text-green-700">72/100</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">List-to-sale ratio</span>
                    <span className="font-medium text-green-700">+2.4% above ask</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your price/sqft vs. market</span>
                    <span className="font-medium">${valuation.pricePerSqft} (avg)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                data-testid="button-step3-back"
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => setStep(2)}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                data-testid="button-step3-next"
                size="lg"
                className="flex-1 gap-2"
                onClick={() => setStep(4)}
              >
                Continue to Selling Goals <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Goals ────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    What are your selling goals?
                  </h2>
                  <p className="text-sm text-muted-foreground">This helps us match you with the right agent and strategy.</p>
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-1.5 text-base">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    When are you looking to sell?
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "asap", label: "ASAP", sub: "Ready to list now" },
                      { value: "1-3months", label: "1–3 Months", sub: "Getting ready soon" },
                      { value: "3-6months", label: "3–6 Months", sub: "Planning ahead" },
                      { value: "exploring", label: "Just Exploring", sub: "No rush, gathering info" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        data-testid={`button-timeline-${opt.value}`}
                        onClick={() => set("timeline", opt.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all
                          ${form.timeline === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/30 bg-white"}`}
                      >
                        <p className="font-semibold text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Motivation */}
                <div className="space-y-3">
                  <Label className="text-base">Primary reason for selling</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "moving-up", label: "Moving Up", sub: "Upgrading to a larger home" },
                      { value: "downsizing", label: "Downsizing", sub: "Looking for something smaller" },
                      { value: "relocating", label: "Relocating", sub: "Moving to a new city or state" },
                      { value: "investment", label: "Investment", sub: "Selling an investment property" },
                      { value: "life-change", label: "Life Change", sub: "Divorce, estate, job change" },
                      { value: "other", label: "Other", sub: "Another reason" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        data-testid={`button-motivation-${opt.value}`}
                        onClick={() => set("motivation", opt.value)}
                        className={`p-3 rounded-xl border-2 text-left transition-all
                          ${form.motivation === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/30 bg-white"}`}
                      >
                        <p className="font-semibold text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional notes */}
                <div className="space-y-2">
                  <Label>Anything else we should know? (optional)</Label>
                  <Textarea
                    data-testid="textarea-agent-note"
                    placeholder="e.g. We'd prefer to stay until school year ends, or looking to do a simultaneous buy/sell..."
                    value={form.agentNote}
                    onChange={e => set("agentNote", e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                data-testid="button-step4-back"
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => setStep(3)}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                data-testid="button-step4-next"
                size="lg"
                className="flex-1 gap-2"
                onClick={() => setStep(5)}
              >
                Connect with an Agent <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Contact + Listing Options ────────────────────── */}
        {step === 5 && (
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardContent className="pt-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Your contact information
                  </h2>
                  <p className="text-sm text-muted-foreground">An agent will reach out within 24 hours. No spam, ever.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      data-testid="input-name"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={e => set("name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address *</Label>
                    <Input
                      data-testid="input-email"
                      type="email"
                      placeholder="jane@example.com"
                      value={form.email}
                      onChange={e => set("email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number (optional)</Label>
                    <Input
                      data-testid="input-phone"
                      type="tel"
                      placeholder="(415) 555-0100"
                      value={form.phone}
                      onChange={e => set("phone", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-blue-200 bg-blue-50/30">
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-base">Will you need to buy your next home?</h3>
                <p className="text-sm text-muted-foreground">This helps us connect you with the right resources for a smooth transition.</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    data-testid="button-needs-buy-yes"
                    onClick={() => set("needsToBuyNext", "yes" as any)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.needsToBuyNext === "yes" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border bg-white text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    Yes, I need to buy
                  </button>
                  <button
                    type="button"
                    data-testid="button-needs-buy-no"
                    onClick={() => set("needsToBuyNext", "no" as any)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.needsToBuyNext === "no" ? "border-green-500 bg-green-50 text-green-700" : "border-border bg-white text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    No, just selling
                  </button>
                </div>
                {form.needsToBuyNext === "yes" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 animate-in slide-in-from-top-2">
                    <p className="text-xs text-blue-800">
                      <span className="font-semibold">We've got you covered.</span> A xucasa representative will connect you with a trusted lender to get you pre-approved for your next purchase, so you can sell and buy with confidence.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-purple-200 bg-purple-50/30">
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-base">Do you have a real estate agent?</h3>
                <div className="flex gap-3">
                  <button
                    type="button"
                    data-testid="button-seller-has-agent-yes"
                    onClick={() => set("hasAgent", "yes" as any)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.hasAgent === "yes" ? "border-green-500 bg-green-50 text-green-700" : "border-border bg-white text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    data-testid="button-seller-has-agent-no"
                    onClick={() => set("hasAgent", "no" as any)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.hasAgent === "no" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-border bg-white text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    No
                  </button>
                </div>

                {form.hasAgent === "yes" && (
                  <div className="space-y-3 pt-1 animate-in slide-in-from-top-2">
                    <p className="text-xs text-muted-foreground">Your agent's info is private. If they have an account on xucasa, we'll link you automatically. Otherwise, we'll send them an invite.</p>
                    <div className="space-y-2">
                      <Input
                        data-testid="input-seller-agent-name"
                        placeholder="Agent's full name *"
                        value={form.sellerAgentName}
                        onChange={e => set("sellerAgentName", e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          data-testid="input-seller-agent-phone"
                          type="tel"
                          placeholder="Agent's phone"
                          value={form.sellerAgentPhone}
                          onChange={e => set("sellerAgentPhone", e.target.value)}
                        />
                        <Input
                          data-testid="input-seller-agent-email"
                          type="email"
                          placeholder="Agent's email *"
                          value={form.sellerAgentEmail}
                          onChange={e => set("sellerAgentEmail", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {form.hasAgent === "no" && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 animate-in slide-in-from-top-2">
                    <p className="text-xs text-purple-800">
                      <span className="font-semibold">We can help!</span> A xucasa representative will reach out to discuss how we can represent you and get your home sold for top dollar.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Listing type choice */}
            <Card className="shadow-sm">
              <CardContent className="pt-5 pb-5 space-y-3">
                <h3 className="font-semibold text-base">How do you want to list?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    data-testid="button-listing-standard"
                    onClick={() => set("listingType", "standard")}
                    className={`p-4 rounded-xl border-2 text-left transition-all
                      ${form.listingType === "standard"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30 bg-white"}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-blue-700" />
                      </div>
                      <span className="font-semibold">MLS Listing</span>
                      <Badge variant="secondary" className="text-xs ml-auto">Most Popular</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Listed publicly on MLS, Zillow, Realtor.com and xucasa. Maximum buyer exposure.</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> MLS syndication</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Professional photos</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Open house scheduling</li>
                    </ul>
                  </button>

                  <button
                    data-testid="button-listing-private"
                    onClick={() => set("listingType", "private")}
                    className={`p-4 rounded-xl border-2 text-left transition-all
                      ${form.listingType === "private"
                        ? "border-amber-500 bg-amber-50"
                        : "border-muted hover:border-muted-foreground/30 bg-white"}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Star className="w-4 h-4 text-amber-700" />
                      </div>
                      <span className="font-semibold">Buy it Now</span>
                      <Badge className="text-xs ml-auto bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Private</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Off-market, exclusively on xucasa. Attract serious buyers at your set price — no negotiation.</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-amber-500" /> Off-market exclusivity</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-amber-500" /> Set your "Buy it Now" price</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-amber-500" /> Shown in My Feed</li>
                    </ul>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* What happens next */}
            <Card className="shadow-sm bg-muted/30">
              <CardContent className="pt-5 pb-4">
                <h3 className="text-sm font-semibold mb-3">What happens next?</h3>
                <div className="space-y-3">
                  {[
                    { step: "1", text: "An agent reviews your home details" },
                    { step: "2", text: "You receive a full Comparative Market Analysis (CMA)" },
                    { step: "3", text: "We schedule a walkthrough and professional photos" },
                    { step: "4", text: "Your home is listed — and you start getting offers" },
                  ].map(item => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {item.step}
                      </div>
                      <p className="text-sm">{item.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                data-testid="button-step5-back"
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => setStep(4)}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                data-testid="button-step5-submit"
                size="lg"
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "Submitting..." : "Submit & Get Connected"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 6: Confirmation ─────────────────────────────────── */}
        {step === 6 && (
          <div className="space-y-6">
            {/* Success card */}
            <Card className="shadow-md border-green-200 bg-green-50/50 text-center">
              <CardContent className="pt-8 pb-7">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-9 h-9 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">You're all set, {form.name.split(" ")[0]}!</h2>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  A licensed xucasa agent will contact you at <strong>{form.email}</strong> within 24 hours
                  to discuss your selling strategy.
                </p>
              </CardContent>
            </Card>

            {/* Summary card */}
            <Card className="shadow-sm">
              <CardContent className="pt-5 pb-5">
                <h3 className="font-semibold mb-4 text-muted-foreground uppercase tracking-wide text-xs">Your Listing Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="text-sm font-medium">{form.fullAddress || "Address provided"}</p>
                    </div>
                  </div>
                  {valuation && (
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Estimated Value</p>
                        <p className="text-sm font-medium">{fmt(valuation.estimatedMid)} ({fmt(valuation.estimatedLow)} – {fmt(valuation.estimatedHigh)})</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Home className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Home</p>
                      <p className="text-sm font-medium">{form.beds} bd · {form.baths} ba · {form.sqft.toLocaleString()} sqft · Built {form.yearBuilt}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Timeline</p>
                      <p className="text-sm font-medium capitalize">{form.timeline.replace("-", " ")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Star className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Listing Type</p>
                      <p className="text-sm font-medium">{form.listingType === "private" ? "Buy it Now (Private)" : "MLS Public Listing"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(form.needsToBuyNext === "yes" || form.hasAgent === "no") && (
              <Card className="shadow-sm border-blue-200 bg-blue-50/30">
                <CardContent className="pt-5 pb-5 space-y-3">
                  <h3 className="text-sm font-semibold">What's next for you</h3>
                  {form.needsToBuyNext === "yes" && (
                    <div className="flex items-start gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <p className="text-muted-foreground">We'll connect you with a trusted lender to get you pre-approved for your next home purchase.</p>
                    </div>
                  )}
                  {form.hasAgent === "no" && (
                    <div className="flex items-start gap-2 text-sm">
                      <Users className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                      <p className="text-muted-foreground">A xucasa representative will reach out to discuss professional representation for your sale.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <BuyerDemandSection onNavigateToBuyers={() => navigate("/buyers")} />

            {/* CTA buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                data-testid="button-browse-comps"
                variant="outline"
                className="gap-2"
                onClick={() => navigate("/search")}
              >
                <Building2 className="w-4 h-4" />
                Browse Comps
              </Button>
              <Button
                data-testid="button-view-feed"
                className="gap-2"
                onClick={() => navigate("/swipe")}
              >
                <TrendingUp className="w-4 h-4" />
                View My Feed
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Questions? Contact us at{" "}
              <a href="mailto:hello@xucasa.com" className="text-primary hover:underline">hello@xucasa.com</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
