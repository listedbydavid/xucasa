import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BuyerProfile, Property } from "@shared/schema";
import {
  Users, DollarSign, Bed, Bath, Ruler, MapPin, Heart, Clock,
  Plus, Send, Filter, X, ChevronDown, ChevronUp, Sparkles,
  Home as HomeIcon, TreePine, ShieldCheck, AlertTriangle, Scale
} from "lucide-react";

const FAIR_HOUSING_NOTICE = "doocasa supports fair housing. All profiles and communications must comply with the Fair Housing Act. Discrimination based on race, color, religion, national origin, sex, familial status, or disability is illegal and strictly prohibited.";

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

type BuyerProfileWithUser = BuyerProfile & { user: { id: string; firstName?: string; lastName?: string; profileImageUrl?: string } | null };

function formatBudget(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  return `$${(amount / 1000).toFixed(0)}K`;
}

function BuyerCard({ profile, onPitch }: { profile: BuyerProfileWithUser; onPitch: (profile: BuyerProfileWithUser) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid={`card-buyer-${profile.id}`}
      className="bg-white rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className="p-5">
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
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                Pre-approved
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
          {(profile.minBeds || profile.maxBeds) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Bed className="w-4 h-4" />
              {profile.minBeds && profile.maxBeds
                ? `${profile.minBeds}–${profile.maxBeds} beds`
                : profile.minBeds
                  ? `${profile.minBeds}+ beds`
                  : `Up to ${profile.maxBeds} beds`}
            </div>
          )}
          {profile.minBaths && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Bath className="w-4 h-4" />
              {profile.minBaths}+ baths
            </div>
          )}
          {(profile.minSqft || profile.maxSqft) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Ruler className="w-4 h-4" />
              {profile.minSqft && profile.maxSqft
                ? `${profile.minSqft.toLocaleString()}–${profile.maxSqft.toLocaleString()} sqft`
                : profile.minSqft
                  ? `${profile.minSqft.toLocaleString()}+ sqft`
                  : `Up to ${profile.maxSqft!.toLocaleString()} sqft`}
            </div>
          )}
          {profile.moveInTimeline && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {profile.moveInTimeline}
            </div>
          )}
        </div>

        {profile.preferredCities && profile.preferredCities.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex flex-wrap gap-1">
              {profile.preferredCities.map((city, i) => (
                <span key={i} className="px-2 py-0.5 bg-primary/5 text-primary text-xs rounded-full font-medium">
                  {city}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.homeTypes && profile.homeTypes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {profile.homeTypes.map((type, i) => (
              <span key={i} className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                {type}
              </span>
            ))}
          </div>
        )}

        {profile.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{profile.bio}</p>
        )}

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
            {profile.mustHaves && profile.mustHaves.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-green-700 mb-1">
                  <Heart className="w-3.5 h-3.5" /> Must-Haves
                </div>
                <div className="flex flex-wrap gap-1">
                  {profile.mustHaves.map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.niceToHaves && profile.niceToHaves.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-blue-700 mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> Nice-to-Haves
                </div>
                <div className="flex flex-wrap gap-1">
                  {profile.niceToHaves.map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.dealBreakers && profile.dealBreakers.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-red-700 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Deal-Breakers
                </div>
                <div className="flex flex-wrap gap-1">
                  {profile.dealBreakers.map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.minLotSize && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TreePine className="w-4 h-4" />
                Min lot: {profile.minLotSize.toLocaleString()} sqft
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-4">
        <button
          onClick={() => onPitch(profile)}
          className="w-full py-2.5 bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          data-testid={`button-pitch-buyer-${profile.id}`}
        >
          <Send className="w-4 h-4" />
          Pitch Your Home
        </button>
      </div>
    </div>
  );
}

function CreateProfileModal({ onClose, existingProfile }: { onClose: () => void; existingProfile?: BuyerProfile | null }) {
  const { toast } = useToast();
  const isEdit = !!existingProfile;
  
  const [form, setForm] = useState({
    displayName: existingProfile?.displayName || "",
    preApprovalAmount: existingProfile?.preApprovalAmount?.toString() || "",
    minBeds: existingProfile?.minBeds?.toString() || "",
    maxBeds: existingProfile?.maxBeds?.toString() || "",
    minBaths: existingProfile?.minBaths?.toString() || "",
    minSqft: existingProfile?.minSqft?.toString() || "",
    maxSqft: existingProfile?.maxSqft?.toString() || "",
    minLotSize: existingProfile?.minLotSize?.toString() || "",
    preferredCities: existingProfile?.preferredCities?.join(", ") || "",
    homeTypes: existingProfile?.homeTypes?.join(", ") || "",
    mustHaves: existingProfile?.mustHaves?.join(", ") || "",
    niceToHaves: existingProfile?.niceToHaves?.join(", ") || "",
    dealBreakers: existingProfile?.dealBreakers?.join(", ") || "",
    moveInTimeline: existingProfile?.moveInTimeline || "",
    bio: existingProfile?.bio || "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const splitList = (s: string) => s ? s.split(",").map(x => x.trim()).filter(Boolean) : [];
      const body: any = {
        displayName: form.displayName,
        preApprovalAmount: parseInt(form.preApprovalAmount),
        minBeds: form.minBeds ? parseInt(form.minBeds) : null,
        maxBeds: form.maxBeds ? parseInt(form.maxBeds) : null,
        minBaths: form.minBaths || null,
        minSqft: form.minSqft ? parseInt(form.minSqft) : null,
        maxSqft: form.maxSqft ? parseInt(form.maxSqft) : null,
        minLotSize: form.minLotSize ? parseInt(form.minLotSize) : null,
        preferredCities: splitList(form.preferredCities),
        homeTypes: splitList(form.homeTypes),
        mustHaves: splitList(form.mustHaves),
        niceToHaves: splitList(form.niceToHaves),
        dealBreakers: splitList(form.dealBreakers),
        moveInTimeline: form.moveInTimeline || null,
        bio: form.bio || null,
      };

      if (isEdit) {
        await apiRequest("PATCH", `/api/buyer-profiles/${existingProfile!.id}`, body);
      } else {
        await apiRequest("POST", "/api/buyer-profiles", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buyer-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/buyer-profiles/mine"] });
      toast({ title: isEdit ? "Profile updated" : "Profile created", description: "Sellers can now see your buyer profile!" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const setField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold" data-testid="text-profile-modal-title">{isEdit ? "Edit" : "Create"} Buyer Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg" data-testid="button-close-profile-modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Display Name *</label>
            <input
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.displayName}
              onChange={e => setField("displayName", e.target.value)}
              placeholder="How you'd like to appear to sellers"
              data-testid="input-display-name"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Pre-Approval Amount *</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-8 pr-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                type="number"
                value={form.preApprovalAmount}
                onChange={e => setField("preApprovalAmount", e.target.value)}
                placeholder="e.g. 750000"
                data-testid="input-pre-approval"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Min Beds</label>
              <input
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                type="number"
                value={form.minBeds}
                onChange={e => setField("minBeds", e.target.value)}
                placeholder="e.g. 3"
                data-testid="input-min-beds"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Max Beds</label>
              <input
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                type="number"
                value={form.maxBeds}
                onChange={e => setField("maxBeds", e.target.value)}
                placeholder="e.g. 5"
                data-testid="input-max-beds"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Min Baths</label>
              <input
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                type="number"
                step="0.5"
                value={form.minBaths}
                onChange={e => setField("minBaths", e.target.value)}
                placeholder="e.g. 2"
                data-testid="input-min-baths"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Move-in Timeline</label>
              <select
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                value={form.moveInTimeline}
                onChange={e => setField("moveInTimeline", e.target.value)}
                data-testid="select-timeline"
              >
                <option value="">Select...</option>
                <option value="ASAP">ASAP</option>
                <option value="1-3 months">1–3 months</option>
                <option value="3-6 months">3–6 months</option>
                <option value="6-12 months">6–12 months</option>
                <option value="12+ months">12+ months</option>
                <option value="Just looking">Just looking</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Min Sqft</label>
              <input
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                type="number"
                value={form.minSqft}
                onChange={e => setField("minSqft", e.target.value)}
                placeholder="e.g. 1500"
                data-testid="input-min-sqft"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Max Sqft</label>
              <input
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                type="number"
                value={form.maxSqft}
                onChange={e => setField("maxSqft", e.target.value)}
                placeholder="e.g. 3000"
                data-testid="input-max-sqft"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Preferred Cities</label>
            <input
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.preferredCities}
              onChange={e => setField("preferredCities", e.target.value)}
              placeholder="San Diego, La Jolla, Carlsbad (comma-separated)"
              data-testid="input-preferred-cities"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Home Types</label>
            <input
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.homeTypes}
              onChange={e => setField("homeTypes", e.target.value)}
              placeholder="Single Family, Townhouse, Condo (comma-separated)"
              data-testid="input-home-types"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-green-600" /> Must-Haves</span>
            </label>
            <input
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.mustHaves}
              onChange={e => setField("mustHaves", e.target.value)}
              placeholder="Garage, Yard, Updated kitchen (comma-separated)"
              data-testid="input-must-haves"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-blue-600" /> Nice-to-Haves</span>
            </label>
            <input
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.niceToHaves}
              onChange={e => setField("niceToHaves", e.target.value)}
              placeholder="Pool, View, Walk to school (comma-separated)"
              data-testid="input-nice-to-haves"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Deal-Breakers</span>
            </label>
            <input
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.dealBreakers}
              onChange={e => setField("dealBreakers", e.target.value)}
              placeholder="HOA over $500, No parking, Busy road (comma-separated)"
              data-testid="input-deal-breakers"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Property features only. Do not reference characteristics of people or neighborhoods based on protected classes.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Min Lot Size (sqft)</label>
            <input
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              type="number"
              value={form.minLotSize}
              onChange={e => setField("minLotSize", e.target.value)}
              placeholder="e.g. 5000"
              data-testid="input-min-lot-size"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">About You</label>
            <textarea
              className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px] resize-none"
              value={form.bio}
              onChange={e => setField("bio", e.target.value)}
              placeholder="Tell sellers a bit about yourself — lifestyle, what you're looking for, why you're moving..."
              data-testid="input-bio"
            />
          </div>
        </div>

        <div className="px-5 pb-2">
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl" data-testid="notice-fair-housing-profile">
            <Scale className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Fair Housing Notice:</span> {FAIR_HOUSING_NOTICE} By submitting, you agree that your profile describes only property features and preferences.
            </p>
          </div>
        </div>
        <div className="p-5 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            data-testid="button-cancel-profile"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const allText = [form.mustHaves, form.niceToHaves, form.dealBreakers, form.bio].join(" ");
              const violation = checkFairHousingCompliance(allText);
              if (violation) {
                toast({ title: "Fair Housing Violation", description: violation, variant: "destructive" });
                return;
              }
              createMutation.mutate();
            }}
            disabled={!form.displayName || !form.preApprovalAmount || createMutation.isPending}
            className="flex-1 py-2.5 bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-submit-profile"
          >
            {createMutation.isPending ? "Saving..." : isEdit ? "Update Profile" : "Create Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
      toast({ title: "Pitch sent!", description: `Your pitch has been sent to ${profile.displayName}.` });
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
                      <p className="text-sm font-medium truncate">{prop.address}</p>
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
            className="flex-1 py-2.5 bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please log in to pitch your home to buyers.", variant: "destructive" });
      return;
    }
    setPitchTarget(profile);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
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
        ) : profiles && profiles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map(profile => (
              <BuyerCard key={profile.id} profile={profile} onPitch={handlePitch} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-state">No buyer profiles yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Be the first to create a buyer profile! Let sellers know exactly what you're looking for and get matched with your dream home.
            </p>
            {isAuthenticated && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-xl font-semibold transition-all flex items-center gap-2 mx-auto active:scale-[0.98]"
                data-testid="button-create-profile-empty"
              >
                <Plus className="w-5 h-5" />
                Create My Buyer Profile
              </button>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateProfileModal onClose={() => setShowCreateModal(false)} existingProfile={myProfile} />
      )}
      {pitchTarget && (
        <PitchModal profile={pitchTarget} onClose={() => setPitchTarget(null)} />
      )}
    </div>
  );
}
