import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PropertyCard } from "@/components/PropertyCard";
import { BuyerProfileModal } from "@/components/BuyerProfileModal";
import type { BuyerProfile, Property, PropertyResponse } from "@/shared/schema";
import { Link } from "wouter";
import {
  Users, DollarSign, Bed, Bath, Ruler, MapPin, Heart, Clock,
  Plus, Send, Filter, X, ChevronDown, ChevronUp, Sparkles, Upload,
  Home as HomeIcon, TreePine, ShieldCheck, AlertTriangle, Scale, Lock,
  Search, ArrowRight, Loader2,
} from "lucide-react";

const FAIR_HOUSING_NOTICE = "xucasa supports fair housing. All profiles and communications must comply with the Fair Housing Act. Discrimination based on race, color, religion, national origin, sex, familial status, or disability is illegal and strictly prohibited.";

const PROHIBITED_TERMS = [
  "no kids", "no children", "no families", "adults only", "no section 8",
  "christian", "muslim", "jewish", "hindu", "buddhist", "catholic",
  "whites only", "no blacks", "no hispanics", "no asians", "no mexicans",
  "english only", "american only", "no immigrants", "no foreigners",
  "no disabled", "no wheelchair", "no handicap", "able-bodied only",
  "no gay", "no lgbtq", "straight only", "no trans",
  "no single mothers", "no single parents", "married only", "couples only",
  "no elderly", "young only", "no seniors",
];

function checkFairHousingCompliance(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of PROHIBITED_TERMS) {
    if (lower.includes(term)) {
      return `Your profile contains language ("${term}") that may violate the Fair Housing Act. Please describe only property features, not characteristics of people.`;
    }
  }
  return null;
}

type BuyerProfileWithUser = BuyerProfile & { user: { id: string; firstName?: string; lastName?: string; profileImageUrl?: string } | null } & { agentId?: string | null; clientName?: string | null; clientEmail?: string | null; clientPhone?: string | null };

function formatBudget(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  return `$${(amount / 1000).toFixed(0)}K`;
}

function LockedValue({ icon: Icon, blurText }: { icon: typeof Bed; blurText: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-muted-foreground/40 blur-[3px] select-none" aria-hidden="true">{blurText}</span>
      <Lock className="w-3 h-3 text-muted-foreground/40 -ml-1" />
    </div>
  );
}

function LockedPills({ icon: Icon, label, color }: { icon: typeof Heart; label: string; color: "green" | "blue" | "red" }) {
  const colors = {
    green: "bg-green-50/60 text-green-400 border-green-200/50",
    blue: "bg-blue-50/60 text-blue-400 border-blue-200/50",
    red: "bg-red-50/60 text-red-400 border-red-200/50",
  };
  const labelColors = { green: "text-green-400", blue: "text-blue-400", red: "text-red-400" };
  const blurPills = { green: ["Garage", "Updated"], blue: ["Pool", "View"], red: ["Busy Road", "HOA"] };
  return (
    <div>
      <div className={`flex items-center gap-1 text-xs font-semibold ${labelColors[color]} mb-1`}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {blurPills[color].map((text, i) => (
          <span key={i} className={`px-2 py-0.5 text-xs rounded-full border ${colors[color]} flex items-center gap-1 blur-[3px] select-none`} aria-hidden="true">
            {text}
          </span>
        ))}
        <span className="px-2 py-0.5 text-xs rounded-full border border-muted-foreground/20 text-muted-foreground/50 bg-muted/30 flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" /> Unlock
        </span>
      </div>
    </div>
  );
}

function BuyerCard({ profile, onPitch }: { profile: BuyerProfileWithUser; onPitch: (profile: BuyerProfileWithUser) => void }) {
  const [expanded, setExpanded] = useState(false);

  const hasBeds = !!(profile.minBeds || profile.maxBeds);
  const hasBaths = !!profile.minBaths;
  const hasSqft = !!(profile.minSqft || profile.maxSqft);
  const hasTimeline = !!profile.moveInTimeline;
  const hasCities = profile.preferredCities && profile.preferredCities.length > 0;
  const hasHomeTypes = profile.homeTypes && profile.homeTypes.length > 0;
  const hasBio = !!profile.bio;
  const hasMustHaves = profile.mustHaves && profile.mustHaves.length > 0;
  const hasNiceToHaves = profile.niceToHaves && profile.niceToHaves.length > 0;
  const hasDealBreakers = profile.dealBreakers && profile.dealBreakers.length > 0;

  return (
    <div
      data-testid={`card-buyer-${profile.id}`}
      className="bg-white rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-full"
    >
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {profile.user?.profileImageUrl ? (
              <img src={profile.user.profileImageUrl} alt="" className="w-10 h-10 rounded-full border border-border" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {profile.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-foreground" data-testid={`text-buyer-name-${profile.id}`}>{profile.displayName}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                {profile.isPreApproved && (
                  <span className="flex items-center gap-0.5 text-green-700"><ShieldCheck className="w-3.5 h-3.5" /> Pre-approved</span>
                )}
                {profile.agentId && (
                  <span className="flex items-center gap-0.5 text-blue-700"><ShieldCheck className="w-3.5 h-3.5" /> Represented</span>
                )}
                {!profile.isPreApproved && !profile.agentId && <span>Buyer</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-primary" data-testid={`text-buyer-budget-${profile.id}`}>
              {formatBudget(profile.preApprovalAmount)}
            </div>
            <span className="text-xs text-muted-foreground">budget</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {hasBeds ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Bed className="w-4 h-4" />
              {profile.minBeds && profile.maxBeds
                ? `${profile.minBeds}–${profile.maxBeds} beds`
                : profile.minBeds
                  ? `${profile.minBeds}+ beds`
                  : `Up to ${profile.maxBeds} beds`}
            </div>
          ) : (
            <LockedValue icon={Bed} blurText="3-4 beds" />
          )}
          {hasBaths ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Bath className="w-4 h-4" />
              {profile.minBaths}+ baths
            </div>
          ) : (
            <LockedValue icon={Bath} blurText="2+ baths" />
          )}
          {hasSqft ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Ruler className="w-4 h-4" />
              {profile.minSqft && profile.maxSqft
                ? `${profile.minSqft.toLocaleString()}–${profile.maxSqft.toLocaleString()} sqft`
                : profile.minSqft
                  ? `${profile.minSqft.toLocaleString()}+ sqft`
                  : `Up to ${profile.maxSqft!.toLocaleString()} sqft`}
            </div>
          ) : (
            <LockedValue icon={Ruler} blurText="1,800 sqft" />
          )}
          {hasTimeline ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {profile.moveInTimeline}
            </div>
          ) : (
            <LockedValue icon={Clock} blurText="1-3 months" />
          )}
        </div>

        {hasCities ? (
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex flex-wrap gap-1">
              {profile.preferredCities!.map((city, i) => (
                <span key={i} className="px-2 py-0.5 bg-primary/5 text-primary text-xs rounded-full font-medium">
                  {city}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex flex-wrap gap-1">
              <span className="px-2 py-0.5 bg-primary/5 text-primary/30 text-xs rounded-full font-medium blur-[3px] select-none" aria-hidden="true">San Diego</span>
              <span className="px-2 py-0.5 bg-primary/5 text-primary/30 text-xs rounded-full font-medium blur-[3px] select-none" aria-hidden="true">La Jolla</span>
              <span className="px-2 py-0.5 bg-muted/30 text-muted-foreground/50 text-xs rounded-full flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> Unlock
              </span>
            </div>
          </div>
        )}

        {hasHomeTypes ? (
          <div className="flex flex-wrap gap-1 mb-3">
            {profile.homeTypes!.map((type, i) => (
              <span key={i} className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                {type}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 mb-3">
            <span className="px-2 py-0.5 bg-muted/50 text-muted-foreground/30 text-xs rounded-full blur-[3px] select-none" aria-hidden="true">Single Family</span>
            <span className="px-2 py-0.5 bg-muted/30 text-muted-foreground/50 text-xs rounded-full flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5" /> Unlock
            </span>
          </div>
        )}

        <div className="min-h-[2.75rem] mb-3">
          {hasBio ? (
            <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground/30 blur-[3px] select-none line-clamp-2" aria-hidden="true">Looking for a move-in ready home in a great neighborhood with good schools nearby.</p>
              <p className="text-xs text-muted-foreground/50 flex items-center gap-1 mt-0.5"><Lock className="w-3 h-3" /> Upgrade to view full bio</p>
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-primary hover:underline mb-3"
          data-testid={`button-expand-buyer-${profile.id}`}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Less details" : "More details"}
        </button>

        {expanded && (
          <div className="space-y-3 mb-3 animate-in slide-in-from-top-2">
            {hasMustHaves ? (
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-green-700 mb-1">
                  <Heart className="w-3.5 h-3.5" /> Must-Haves
                </div>
                <div className="flex flex-wrap gap-1">
                  {profile.mustHaves!.map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <LockedPills icon={Heart} label="Must-Haves" color="green" />
            )}
            {hasNiceToHaves ? (
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-blue-700 mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> Nice-to-Haves
                </div>
                <div className="flex flex-wrap gap-1">
                  {profile.niceToHaves!.map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <LockedPills icon={Sparkles} label="Nice-to-Haves" color="blue" />
            )}
            {hasDealBreakers ? (
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-red-700 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Deal-Breakers
                </div>
                <div className="flex flex-wrap gap-1">
                  {profile.dealBreakers!.map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <LockedPills icon={AlertTriangle} label="Deal-Breakers" color="red" />
            )}
            {profile.minLotSize ? (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TreePine className="w-4 h-4" />
                Min lot: {profile.minLotSize.toLocaleString()} sqft
              </div>
            ) : (
              <LockedValue icon={TreePine} blurText="5,000 sqft" />
            )}
          </div>
        )}

        <div className="flex-1" />
      </div>

      <div className="px-5 pb-4">
        <button
          onClick={() => onPitch(profile)}
          className="w-full py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          data-testid={`button-pitch-buyer-${profile.id}`}
        >
          <Send className="w-4 h-4" />
          Pitch Your Home
        </button>
      </div>
    </div>
  );
}

// CreateProfileModal is now in client/src/components/BuyerProfileModal.tsx

function PitchModal({ profile, onClose }: { profile: BuyerProfileWithUser; onClose: () => void }) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);

  const { data: myProperties } = useQuery<Property[]>({
    queryKey: ["/api/properties/mine"],
  });

  const pitchMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/buyer-matches", {
        buyerProfileId: profile.id,
        propertyId: selectedPropertyId,
        message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buyer-matches"] });
      toast({
        title: "Pitch sent!",
        description: profile.agentId
          ? "Your pitch has been received. A xucasa representative will review it and connect you with this buyer's agent."
          : `Your pitch has been sent to ${profile.displayName}.`,
      });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-bold" data-testid="text-pitch-modal-title">Pitch to {profile.displayName}</h2>
            <p className="text-sm text-muted-foreground">Budget: {formatBudget(profile.preApprovalAmount)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg" data-testid="button-close-pitch-modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {myProperties && myProperties.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Select a property (optional)</label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {myProperties.map(prop => (
                  <label
                    key={prop.id}
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                      selectedPropertyId === prop.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                    }`}
                    data-testid={`option-property-${prop.id}`}
                  >
                    <input
                      type="radio"
                      name="property"
                      checked={selectedPropertyId === prop.id}
                      onChange={() => setSelectedPropertyId(prop.id)}
                      className="accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{(prop as any).address || `${prop.addressStreetNumber || ""} ${prop.addressStreetName || ""}`.trim() || prop.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {prop.beds}bd / {prop.baths}ba · {prop.sqft?.toLocaleString()} sqft · ${prop.price?.toLocaleString()}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Your message *</label>
            <textarea
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[120px] resize-none"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Hi ${profile.displayName}, I have a property that matches what you're looking for. Here are the details...`}
              data-testid="input-pitch-message"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Focus on your property's features and how they match this buyer's criteria. Do not make assumptions about the buyer based on personal characteristics.
            </p>
          </div>

          {profile.agentId && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl" data-testid="notice-represented-buyer">
              <ShieldCheck className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-800">
                <span className="font-semibold">This buyer is represented by an agent.</span> Your contact information will be reviewed by xucasa and routed to their agent on your behalf.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl" data-testid="notice-fair-housing-pitch">
            <Scale className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Fair Housing Act:</span> Your pitch must focus only on property features. Do not discriminate or make assumptions about any person based on race, color, religion, national origin, sex, familial status, or disability.
            </p>
          </div>
        </div>

        <div className="p-5 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            data-testid="button-cancel-pitch"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const violation = checkFairHousingCompliance(message);
              if (violation) {
                toast({ title: "Fair Housing Violation", description: violation, variant: "destructive" });
                return;
              }
              pitchMutation.mutate();
            }}
            disabled={!message.trim() || pitchMutation.isPending}
            className="flex-1 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-testid="button-send-pitch"
          >
            <Send className="w-4 h-4" />
            {pitchMutation.isPending ? "Sending..." : "Send Pitch"}
          </button>
        </div>
      </div>
    </div>
  );
}

const MOCK_BUYERS = ([
  {
    id: -1, userId: "mock-1", displayName: "Sarah M.", preApprovalAmount: 850000,
    minBeds: 3, maxBeds: 4, minBaths: "2", minSqft: 1800, maxSqft: 2500, minLotSize: 5000,
    preferredCities: ["San Diego", "La Jolla"], homeTypes: ["Single Family"],
    mustHaves: ["Garage", "Updated Kitchen", "Backyard"], niceToHaves: ["Pool", "Ocean View"],
    dealBreakers: ["Busy Road", "HOA over $400"], moveInTimeline: "1-3 months",
    bio: "Growing family looking for our forever home in the San Diego area. Pre-approved and ready to close quickly.",
    isActive: true, createdAt: new Date(),
    user: { id: "mock-1", firstName: "Sarah", lastName: "M." },
  },
  {
    id: -2, userId: "mock-2", displayName: "James & Lisa K.", preApprovalAmount: 1200000,
    minBeds: 4, maxBeds: 5, minBaths: "3", minSqft: 2500, maxSqft: 4000, minLotSize: 8000,
    preferredCities: ["Carlsbad", "Encinitas", "Del Mar"], homeTypes: ["Single Family", "Townhouse"],
    mustHaves: ["4+ Bedrooms", "2-Car Garage", "Good Schools"], niceToHaves: ["Pool", "Home Office", "Walk to Beach"],
    dealBreakers: ["No Parking", "Major Renovations Needed"], moveInTimeline: "3-6 months",
    bio: "Relocating from the Bay Area for work. Looking for a spacious home near top-rated schools. Flexible on timeline.",
    isActive: true, createdAt: new Date(),
    user: { id: "mock-2", firstName: "James", lastName: "K." },
  },
  {
    id: -3, userId: "mock-3", displayName: "David R.", preApprovalAmount: 650000,
    minBeds: 2, maxBeds: 3, minBaths: "2", minSqft: 1200, maxSqft: 1800, minLotSize: null,
    preferredCities: ["San Diego", "Chula Vista", "National City"], homeTypes: ["Condo", "Townhouse"],
    mustHaves: ["In-Unit Laundry", "Parking"], niceToHaves: ["Rooftop Deck", "Gym", "Near Transit"],
    dealBreakers: ["No A/C", "Street Parking Only"], moveInTimeline: "ASAP",
    bio: "First-time buyer, pre-approved and motivated. Looking for a move-in ready condo or townhome close to downtown.",
    isActive: true, createdAt: new Date(),
    user: { id: "mock-3", firstName: "David", lastName: "R." },
  },
  {
    id: -4, userId: "mock-4", displayName: "Michelle T.", preApprovalAmount: 975000,
    minBeds: 3, maxBeds: 4, minBaths: "2.5", minSqft: 2000, maxSqft: 3000, minLotSize: 6000,
    preferredCities: ["Poway", "Scripps Ranch", "Rancho Bernardo"], homeTypes: ["Single Family"],
    mustHaves: ["Large Yard", "Modern Kitchen", "Quiet Street"], niceToHaves: ["Solar Panels", "RV Parking", "View"],
    dealBreakers: ["Flood Zone", "Under 1800 sqft"], moveInTimeline: "3-6 months",
    bio: "Empty nester downsizing from a larger home. Want a single-story or main-floor primary in a quiet neighborhood.",
    isActive: true, createdAt: new Date(),
    user: { id: "mock-4", firstName: "Michelle", lastName: "T." },
  },
  {
    id: -5, userId: "mock-5", displayName: "Carlos & Ana G.", preApprovalAmount: 550000,
    minBeds: 3, maxBeds: null, minBaths: "2", minSqft: 1400, maxSqft: 2200, minLotSize: null,
    preferredCities: ["Oceanside", "Vista", "San Marcos"], homeTypes: ["Single Family", "Townhouse"],
    mustHaves: ["3+ Bedrooms", "Garage", "Near Schools"], niceToHaves: ["Community Pool", "Park Nearby"],
    dealBreakers: ["Major Foundation Issues"], moveInTimeline: "1-3 months",
    bio: "Young family of 4 looking for our first home. Would love a neighborhood with other families and good schools nearby.",
    isActive: true, createdAt: new Date(),
    user: { id: "mock-5", firstName: "Carlos", lastName: "G." },
  },
  {
    id: -6, userId: "mock-6", displayName: "Rachel W.", preApprovalAmount: 1500000,
    minBeds: 4, maxBeds: 6, minBaths: "3", minSqft: 3000, maxSqft: 5000, minLotSize: 10000,
    preferredCities: ["La Jolla", "Del Mar", "Rancho Santa Fe"], homeTypes: ["Single Family"],
    mustHaves: ["Pool", "Ocean View", "Gourmet Kitchen", "3-Car Garage"], niceToHaves: ["Wine Cellar", "Home Theater", "Guest Suite"],
    dealBreakers: ["No View", "Under 3000 sqft"], moveInTimeline: "6-12 months",
    bio: "Looking for a luxury property with entertaining space and ocean views. No rush — waiting for the right fit.",
    isActive: true, createdAt: new Date(),
    user: { id: "mock-6", firstName: "Rachel", lastName: "W." },
  },
] as unknown) as BuyerProfileWithUser[];

function QuickCriteriaForm({ onOpenFullForm }: { onOpenFullForm: () => void }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [quickForm, setQuickForm] = useState({
    budget: "",
    beds: "",
    city: "",
    homeType: "",
  });

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please log in to create your buyer profile.", variant: "destructive" });
      return;
    }
    onOpenFullForm();
  };

  return (
    <div className="bg-gradient-to-br from-[#A02020] to-[#7B1818] rounded-2xl p-6 sm:p-8 mb-8 text-white relative overflow-hidden" data-testid="section-cta-form">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <span className="text-yellow-400 text-sm font-semibold uppercase tracking-wide">Reverse Home Search</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Tell sellers what you want</h2>
        <p className="text-red-100 text-sm sm:text-base mb-6 max-w-xl">
          Post your home criteria and let homeowners come to you. Skip the endless scrolling — get matched with properties that fit your exact needs.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div>
            <label className="text-xs text-red-200 font-medium mb-1 block">Your Budget</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-300" />
              <input
                className="w-full pl-8 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                type="number"
                value={quickForm.budget}
                onChange={e => setQuickForm(f => ({ ...f, budget: e.target.value }))}
                placeholder="e.g. 750,000"
                data-testid="input-quick-budget"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-red-200 font-medium mb-1 block">Bedrooms</label>
            <div className="relative">
              <Bed className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-300" />
              <select
                className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                value={quickForm.beds}
                onChange={e => setQuickForm(f => ({ ...f, beds: e.target.value }))}
                data-testid="select-quick-beds"
              >
                <option value="" className="text-slate-900">Any</option>
                <option value="1" className="text-slate-900">1+</option>
                <option value="2" className="text-slate-900">2+</option>
                <option value="3" className="text-slate-900">3+</option>
                <option value="4" className="text-slate-900">4+</option>
                <option value="5" className="text-slate-900">5+</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-red-200 font-medium mb-1 block">City</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-300" />
              <input
                className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={quickForm.city}
                onChange={e => setQuickForm(f => ({ ...f, city: e.target.value }))}
                placeholder="e.g. San Diego"
                data-testid="input-quick-city"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-red-200 font-medium mb-1 block">Home Type</label>
            <div className="relative">
              <HomeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-300" />
              <select
                className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                value={quickForm.homeType}
                onChange={e => setQuickForm(f => ({ ...f, homeType: e.target.value }))}
                data-testid="select-quick-home-type"
              >
                <option value="" className="text-slate-900">Any</option>
                <option value="Single Family" className="text-slate-900">Single Family</option>
                <option value="Condo" className="text-slate-900">Condo</option>
                <option value="Townhouse" className="text-slate-900">Townhouse</option>
                <option value="Multi-Family" className="text-slate-900">Multi-Family</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={handleGetStarted}
            className="px-6 py-3 bg-white hover:bg-red-50 text-[#A02020] rounded-xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center gap-2 shadow-lg"
            data-testid="button-post-criteria"
          >
            <Plus className="w-4 h-4" />
            Post My Criteria — It's Free
          </button>
          <div className="flex items-center gap-3 text-sm text-red-200">
            <div className="flex -space-x-2">
              {["S", "J", "D", "M", "C"].map((letter, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-xs font-semibold text-white">
                  {letter}
                </div>
              ))}
            </div>
            <span data-testid="text-buyer-count">100K+ buyers have posted their needs</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsBar() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8" data-testid="section-stats">
      <div className="bg-white rounded-xl border border-border/60 p-4 text-center">
        <div className="text-2xl font-bold text-foreground">100K+</div>
        <div className="text-xs text-muted-foreground mt-0.5">Active Buyers</div>
      </div>
      <div className="bg-white rounded-xl border border-border/60 p-4 text-center">
        <div className="text-2xl font-bold text-foreground">$850K</div>
        <div className="text-xs text-muted-foreground mt-0.5">Avg Budget</div>
      </div>
      <div className="bg-white rounded-xl border border-border/60 p-4 text-center">
        <div className="text-2xl font-bold text-foreground">23K+</div>
        <div className="text-xs text-muted-foreground mt-0.5">Matches Made</div>
      </div>
      <div className="bg-white rounded-xl border border-border/60 p-4 text-center">
        <div className="text-2xl font-bold text-foreground">48 hrs</div>
        <div className="text-xs text-muted-foreground mt-0.5">Avg Response Time</div>
      </div>
    </div>
  );
}

function MatchingListings({ buyerProfile }: { buyerProfile: BuyerProfile | null | undefined }) {
  const [showAll, setShowAll] = useState(false);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", showAll ? "24" : "8");
    params.set("sort", "newest");

    if (buyerProfile) {
      if (buyerProfile.preApprovalAmount) {
        params.set("maxPrice", buyerProfile.preApprovalAmount.toString());
      }
      if (buyerProfile.minBeds) {
        params.set("minBeds", buyerProfile.minBeds.toString());
      }
      if (buyerProfile.minBaths) {
        params.set("minBaths", buyerProfile.minBaths.toString());
      }
      if (buyerProfile.minSqft) {
        params.set("minSqft", buyerProfile.minSqft.toString());
      }
      if (buyerProfile.maxSqft) {
        params.set("maxSqft", buyerProfile.maxSqft.toString());
      }
      if (buyerProfile.preferredCities && buyerProfile.preferredCities.length > 0) {
        params.set("location", buyerProfile.preferredCities[0]);
      }
      if (buyerProfile.homeTypes && buyerProfile.homeTypes.length > 0) {
        const typeMap: Record<string, string> = {
          "single family": "SFH",
          "condo": "Condo",
          "townhouse": "Townhouse",
          "multi-family": "Residential Income",
          "mobile": "Mobile",
        };
        const mapped = buyerProfile.homeTypes
          .map(t => typeMap[t.toLowerCase()] || t)
          .join(",");
        params.set("propertyType", mapped);
      }
    }

    return params.toString();
  }, [buyerProfile, showAll]);

  const { data, isLoading } = useQuery<{ properties: PropertyResponse[]; total: number }>({
    queryKey: ["/api/properties", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/properties?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load listings");
      return res.json();
    },
  });

  const properties = data?.properties || [];
  const total = data?.total || 0;

  const hasProfile = !!buyerProfile;
  const hasCriteria = hasProfile && !!(
    buyerProfile.preApprovalAmount ||
    buyerProfile.minBeds ||
    buyerProfile.minBaths ||
    buyerProfile.minSqft ||
    buyerProfile.maxSqft ||
    (buyerProfile.preferredCities && buyerProfile.preferredCities.length > 0) ||
    (buyerProfile.homeTypes && buyerProfile.homeTypes.length > 0)
  );

  return (
    <div className="mb-10" data-testid="section-matching-listings">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-listings-section-heading">
            {hasCriteria ? (
              <>
                <Sparkles className="w-5 h-5 text-primary" />
                Listings Matching Your Criteria
              </>
            ) : (
              <>
                <Search className="w-5 h-5 text-primary" />
                Featured Listings
              </>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasCriteria
              ? `${total.toLocaleString()} listings match your buyer profile`
              : "Browse homes while you set up your buyer profile"}
          </p>
        </div>
        <Link
          href="/search"
          className="text-sm font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          data-testid="link-view-all-search"
        >
          View All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {hasCriteria && (
        <div className="flex flex-wrap gap-2 mb-4" data-testid="section-active-criteria-pills">
          {buyerProfile.preApprovalAmount && (
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              Budget: {formatBudget(buyerProfile.preApprovalAmount)}
            </span>
          )}
          {buyerProfile.minBeds && (
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {buyerProfile.minBeds}+ beds
            </span>
          )}
          {buyerProfile.minBaths && (
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {buyerProfile.minBaths}+ baths
            </span>
          )}
          {buyerProfile.minSqft && (
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {buyerProfile.minSqft.toLocaleString()}+ sqft
            </span>
          )}
          {buyerProfile.preferredCities?.map(city => (
            <span key={city} className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {city}
            </span>
          ))}
          {buyerProfile.homeTypes?.map(type => (
            <span key={type} className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {type}
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-5 bg-muted rounded w-24" />
                <div className="h-4 bg-muted rounded w-48" />
                <div className="h-4 bg-muted rounded w-36" />
              </div>
            </div>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-2xl">
          <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <h4 className="font-bold text-foreground mb-1">No listings found</h4>
          <p className="text-sm text-muted-foreground mb-4">
            {hasCriteria
              ? "Try adjusting your buyer profile criteria to see more results."
              : "No listings available at the moment."}
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-full font-bold hover:bg-primary hover:text-white transition-colors text-sm"
            data-testid="link-browse-all-listings"
          >
            Browse All Listings
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="grid-matching-listings">
            {properties.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>

          {!showAll && total > 8 && (
            <div className="text-center mt-6">
              <button
                onClick={() => setShowAll(true)}
                className="px-6 py-2.5 border border-border rounded-full font-semibold text-sm hover:bg-muted transition-colors"
                data-testid="button-show-more-listings"
              >
                Show More ({total.toLocaleString()} total)
              </button>
            </div>
          )}

          {showAll && total > 24 && (
            <div className="text-center mt-6">
              <Link
                href={hasCriteria
                  ? `/search?maxPrice=${buyerProfile.preApprovalAmount || ""}&minBeds=${buyerProfile.minBeds || ""}&location=${buyerProfile.preferredCities?.[0] || ""}`
                  : "/search"}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-full font-bold text-sm hover:bg-primary hover:text-white transition-colors"
                data-testid="link-see-all-on-search"
              >
                See All {total.toLocaleString()} Listings on Search <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Buyers() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pitchTarget, setPitchTarget] = useState<BuyerProfileWithUser | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ city: "", minBudget: "", maxBudget: "" });
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const { data: profiles, isLoading } = useQuery<BuyerProfileWithUser[]>({
    queryKey: ["/api/buyer-profiles", activeFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/buyer-profiles?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: myProfile } = useQuery<BuyerProfile | null>({
    queryKey: ["/api/buyer-profiles/mine"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await fetch("/api/buyer-profiles/mine", { credentials: "include" });
      if (res.status === 401) return null;
      return res.json();
    },
  });

  const applyFilters = () => {
    setActiveFilters({ ...filters });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({ city: "", minBudget: "", maxBudget: "" });
    setActiveFilters({});
    setShowFilters(false);
  };

  const handlePitch = (profile: BuyerProfileWithUser) => {
    if (profile.id < 0) {
      toast({ title: "Example Profile", description: "This is a sample buyer. Sign in and create your own profile to get pitches from real homeowners!" });
      return;
    }
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please log in to pitch your home to buyers.", variant: "destructive" });
      return;
    }
    setPitchTarget(profile);
  };

  const realProfiles = profiles || [];
  const allProfiles = [...realProfiles, ...MOCK_BUYERS.filter(mock => !realProfiles.some(p => p.id === mock.id))];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-6 h-6 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-page-title">Buyer Marketplace</h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
              Pre-approved buyers sharing what they're looking for. Homeowners — find your perfect match and pitch your property directly.
            </p>
            <div className="flex items-center gap-1.5 mt-2" data-testid="badge-fair-housing">
              <Scale className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs text-amber-700 font-medium">
                Equal Housing Opportunity — Fair Housing Act compliant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4" />
              Filter
              {Object.values(activeFilters).filter(Boolean).length > 0 && (
                <span className="w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center">
                  {Object.values(activeFilters).filter(Boolean).length}
                </span>
              )}
            </button>
            {isAuthenticated && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-xl text-sm font-semibold transition-all flex items-center gap-2 active:scale-[0.98]"
                data-testid="button-create-profile"
              >
                <Plus className="w-4 h-4" />
                {myProfile ? "Edit My Profile" : "I'm a Buyer"}
              </button>
            )}
          </div>
        </div>

        <QuickCriteriaForm onOpenFullForm={() => setShowCreateModal(true)} />

        <MatchingListings buyerProfile={myProfile} />

        <StatsBar />

        {showFilters && (
          <div className="bg-white border rounded-2xl p-4 mb-6 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">City</label>
                <input
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={filters.city}
                  onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. San Diego"
                  data-testid="input-filter-city"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Min Budget</label>
                <input
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  type="number"
                  value={filters.minBudget}
                  onChange={e => setFilters(f => ({ ...f, minBudget: e.target.value }))}
                  placeholder="e.g. 500000"
                  data-testid="input-filter-min-budget"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Max Budget</label>
                <input
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  type="number"
                  value={filters.maxBudget}
                  onChange={e => setFilters(f => ({ ...f, maxBudget: e.target.value }))}
                  placeholder="e.g. 1000000"
                  data-testid="input-filter-max-budget"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-clear-filters"
              >
                Clear
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-1.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-all"
                data-testid="button-apply-filters"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground" data-testid="text-listings-heading">
            Buyers Looking Right Now
          </h3>
          <span className="text-sm text-muted-foreground" data-testid="text-showing-count">
            Showing {allProfiles.length.toLocaleString()} of 100,000+ buyers
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl border p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allProfiles.map(profile => (
              <BuyerCard key={profile.id} profile={profile} onPitch={handlePitch} />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <BuyerProfileModal onClose={() => setShowCreateModal(false)} existingProfile={myProfile} />
      )}
      {pitchTarget && (
        <PitchModal profile={pitchTarget} onClose={() => setPitchTarget(null)} />
      )}
    </div>
  );
}
