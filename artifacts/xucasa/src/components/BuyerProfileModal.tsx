import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BuyerProfile } from "@/shared/schema";
import {
  DollarSign, Heart, X, Sparkles, Upload,
  AlertTriangle, Scale,
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

export function BuyerProfileModal({ onClose, existingProfile }: { onClose: () => void; existingProfile?: BuyerProfile | null }) {
  const { toast } = useToast();
  const isEdit = !!existingProfile;
  const ep: any = existingProfile || {};

  const [form, setForm] = useState({
    displayName: ep.displayName || "",
    preApprovalAmount: ep.preApprovalAmount?.toString() || "",
    minBeds: ep.minBeds?.toString() || "",
    maxBeds: ep.maxBeds?.toString() || "",
    minBaths: ep.minBaths?.toString() || "",
    minSqft: ep.minSqft?.toString() || "",
    maxSqft: ep.maxSqft?.toString() || "",
    minLotSize: ep.minLotSize?.toString() || "",
    preferredCities: ep.preferredCities?.join(", ") || "",
    homeTypes: ep.homeTypes?.join(", ") || "",
    mustHaves: ep.mustHaves?.join(", ") || "",
    niceToHaves: ep.niceToHaves?.join(", ") || "",
    dealBreakers: ep.dealBreakers?.join(", ") || "",
    moveInTimeline: ep.moveInTimeline || "",
    bio: ep.bio || "",
    isPreApproved: ep.isPreApproved === true ? "yes" : ep.isPreApproved === false && ep.id ? "no" : "",
    preApprovalLetter: ep.preApprovalLetter || "",
    lenderName: ep.lenderName || "",
    lenderPhone: ep.lenderPhone || "",
    lenderEmail: ep.lenderEmail || "",
    hasAgent: ep.hasAgent === true ? "yes" : ep.hasAgent === false && ep.id ? "no" : "",
    buyerAgentName: ep.buyerAgentName || "",
    buyerAgentPhone: ep.buyerAgentPhone || "",
    buyerAgentEmail: ep.buyerAgentEmail || "",
  });

  const handleLetterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, preApprovalLetter: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const splitList = (s: string) => s ? s.split(",").map(x => x.trim()).filter(Boolean) : [];
      const body: any = {
        displayName: form.displayName,
        preApprovalAmount: parseInt(form.preApprovalAmount),
        minBeds: form.minBeds ? parseInt(form.minBeds) : null,
        maxBeds: form.maxBeds ? parseInt(form.maxBeds) : null,
        minBaths: form.minBaths ? parseFloat(form.minBaths) : null,
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
        isPreApproved: form.isPreApproved === "yes",
        preApprovalLetter: form.isPreApproved === "yes" ? form.preApprovalLetter || null : null,
        lenderName: form.isPreApproved === "yes" ? form.lenderName || null : null,
        lenderPhone: form.isPreApproved === "yes" ? form.lenderPhone || null : null,
        lenderEmail: form.isPreApproved === "yes" ? form.lenderEmail || null : null,
        hasAgent: form.hasAgent === "yes",
        buyerAgentName: form.hasAgent === "yes" ? form.buyerAgentName || null : null,
        buyerAgentPhone: form.hasAgent === "yes" ? form.buyerAgentPhone || null : null,
        buyerAgentEmail: form.hasAgent === "yes" ? form.buyerAgentEmail || null : null,
      };

      if (isEdit) {
        return apiRequest("PATCH", `/api/buyer-profiles/${existingProfile!.id}`, body);
      } else {
        const res = await apiRequest("POST", "/api/buyer-profiles", body);
        return res.json();
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/buyer-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/buyer-profiles/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });

      if (!isEdit && form.hasAgent === "yes" && data?.agentLinked) {
        toast({ title: "Profile created & agent linked!", description: "Your agent has been connected to your profile." });
      } else if (!isEdit && form.hasAgent === "yes" && !data?.agentLinked) {
        toast({ title: "Profile created!", description: "We'll send your agent an invite to join xucasa." });
      } else if (!isEdit && form.hasAgent === "no") {
        toast({ title: "Profile created!", description: "A xucasa representative will reach out to help you find an agent." });
      } else if (!isEdit && form.isPreApproved === "no") {
        toast({ title: "Profile created!", description: "We'll connect you with a trusted lender to get pre-approved." });
      } else {
        toast({ title: isEdit ? "Profile updated" : "Profile created", description: "Sellers can now see your buyer profile!" });
      }
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const setField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const inputClass = "w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buyer-profile-modal-title"
      onClick={onClose}
      onKeyDown={e => { if (e.key === "Escape") onClose(); }}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 id="buyer-profile-modal-title" className="text-lg font-bold text-foreground" data-testid="text-profile-modal-title">{isEdit ? "Edit" : "Create"} Buyer Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg" data-testid="button-close-profile-modal" aria-label="Close buyer profile form">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Display Name *</label>
            <input
              className={inputClass}
              value={form.displayName}
              onChange={e => setField("displayName", e.target.value)}
              placeholder="How you'd like to appear to sellers"
              data-testid="input-display-name"
            />
          </div>

          <div className="border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-4 space-y-3">
            <label className="text-sm font-semibold text-foreground block">Are you pre-approved? *</label>
            <div className="flex gap-3" role="group" aria-label="Pre-approval status">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isPreApproved: "yes" }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.isPreApproved === "yes" ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"}`}
                data-testid="button-preapproved-yes"
                aria-pressed={form.isPreApproved === "yes"}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isPreApproved: "no" }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.isPreApproved === "no" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"}`}
                data-testid="button-preapproved-no"
                aria-pressed={form.isPreApproved === "no"}
              >
                Not yet
              </button>
            </div>

            {form.isPreApproved === "yes" && (
              <div className="space-y-3 pt-2 animate-in slide-in-from-top-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Budget (Pre-Approval Amount) *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      className={`${inputClass} pl-8`}
                      type="number"
                      value={form.preApprovalAmount}
                      onChange={e => setField("preApprovalAmount", e.target.value)}
                      placeholder="e.g. 750000"
                      data-testid="input-pre-approval"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Pre-Approval Letter (optional)</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl cursor-pointer hover:bg-muted/30 transition-colors text-sm">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      {form.preApprovalLetter ? "Letter uploaded" : "Upload letter"}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleLetterUpload} data-testid="input-letter-upload" />
                    </label>
                    {form.preApprovalLetter && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, preApprovalLetter: "" }))} className="text-xs text-destructive hover:underline" data-testid="button-remove-letter">Remove</button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">PDF, JPG, or PNG — max 5MB. This is private and never shown publicly.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Lender Information (private)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input className={inputClass} value={form.lenderName} onChange={e => setField("lenderName", e.target.value)} placeholder="Lender name" data-testid="input-lender-name" />
                    <input className={inputClass} type="tel" value={form.lenderPhone} onChange={e => setField("lenderPhone", e.target.value)} placeholder="Lender phone" data-testid="input-lender-phone" />
                    <input className={inputClass} type="email" value={form.lenderEmail} onChange={e => setField("lenderEmail", e.target.value)} placeholder="Lender email" data-testid="input-lender-email" />
                  </div>
                </div>
              </div>
            )}

            {form.isPreApproved === "no" && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 animate-in slide-in-from-top-2">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">No worries!</span> We'll connect you with a trusted lender who can help you get pre-approved quickly. A xucasa representative will reach out.
                </p>
                <div className="mt-2">
                  <label className="text-sm font-medium mb-1 block">Your estimated budget *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      className={`${inputClass} pl-8`}
                      type="number"
                      value={form.preApprovalAmount}
                      onChange={e => setField("preApprovalAmount", e.target.value)}
                      placeholder="Your approximate budget"
                      data-testid="input-estimated-budget"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl p-4 space-y-3">
            <label className="text-sm font-semibold text-foreground block">Do you have a real estate agent? *</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, hasAgent: "yes" }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.hasAgent === "yes" ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"}`}
                data-testid="button-has-agent-yes"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, hasAgent: "no" }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.hasAgent === "no" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"}`}
                data-testid="button-has-agent-no"
              >
                No
              </button>
            </div>

            {form.hasAgent === "yes" && (
              <div className="space-y-3 pt-2 animate-in slide-in-from-top-2">
                <p className="text-xs text-muted-foreground">Your agent's info is private. If they have an account, we'll link you automatically. Otherwise, we'll send them an invite.</p>
                <div className="grid grid-cols-1 gap-2">
                  <input className={inputClass} value={form.buyerAgentName} onChange={e => setField("buyerAgentName", e.target.value)} placeholder="Agent's full name *" data-testid="input-agent-name" />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} type="tel" value={form.buyerAgentPhone} onChange={e => setField("buyerAgentPhone", e.target.value)} placeholder="Agent's phone" data-testid="input-agent-phone" />
                    <input className={inputClass} type="email" value={form.buyerAgentEmail} onChange={e => setField("buyerAgentEmail", e.target.value)} placeholder="Agent's email *" data-testid="input-agent-email" />
                  </div>
                </div>
              </div>
            )}

            {form.hasAgent === "no" && (
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3 animate-in slide-in-from-top-2">
                <p className="text-xs text-purple-800 dark:text-purple-300">
                  <span className="font-semibold">We can help!</span> A xucasa representative will reach out to discuss how we can assist you in your home search with professional representation.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Min Beds</label>
              <input className={inputClass} type="number" value={form.minBeds} onChange={e => setField("minBeds", e.target.value)} placeholder="e.g. 3" data-testid="input-min-beds" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Max Beds</label>
              <input className={inputClass} type="number" value={form.maxBeds} onChange={e => setField("maxBeds", e.target.value)} placeholder="e.g. 5" data-testid="input-max-beds" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Min Baths</label>
              <input className={inputClass} type="number" step="0.5" value={form.minBaths} onChange={e => setField("minBaths", e.target.value)} placeholder="e.g. 2" data-testid="input-min-baths" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Move-in Timeline</label>
              <select className={`${inputClass} bg-card`} value={form.moveInTimeline} onChange={e => setField("moveInTimeline", e.target.value)} data-testid="select-timeline">
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
              <input className={inputClass} type="number" value={form.minSqft} onChange={e => setField("minSqft", e.target.value)} placeholder="e.g. 1500" data-testid="input-min-sqft" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Max Sqft</label>
              <input className={inputClass} type="number" value={form.maxSqft} onChange={e => setField("maxSqft", e.target.value)} placeholder="e.g. 3000" data-testid="input-max-sqft" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Preferred Cities</label>
            <input className={inputClass} value={form.preferredCities} onChange={e => setField("preferredCities", e.target.value)} placeholder="San Diego, La Jolla, Carlsbad (comma-separated)" data-testid="input-preferred-cities" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Home Types</label>
            <input className={inputClass} value={form.homeTypes} onChange={e => setField("homeTypes", e.target.value)} placeholder="Single Family, Townhouse, Condo (comma-separated)" data-testid="input-home-types" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-green-600" /> Must-Haves</span>
            </label>
            <input className={inputClass} value={form.mustHaves} onChange={e => setField("mustHaves", e.target.value)} placeholder="Garage, Yard, Updated kitchen (comma-separated)" data-testid="input-must-haves" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-blue-600" /> Nice-to-Haves</span>
            </label>
            <input className={inputClass} value={form.niceToHaves} onChange={e => setField("niceToHaves", e.target.value)} placeholder="Pool, View, Walk to school (comma-separated)" data-testid="input-nice-to-haves" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Deal-Breakers</span>
            </label>
            <input className={inputClass} value={form.dealBreakers} onChange={e => setField("dealBreakers", e.target.value)} placeholder="HOA over $500, No parking, Busy road (comma-separated)" data-testid="input-deal-breakers" />
            <p className="text-xs text-muted-foreground mt-1">
              Property features only. Do not reference characteristics of people or neighborhoods based on protected classes.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Min Lot Size (sqft)</label>
            <input className={inputClass} type="number" value={form.minLotSize} onChange={e => setField("minLotSize", e.target.value)} placeholder="e.g. 5000" data-testid="input-min-lot-size" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">About You</label>
            <textarea
              className={`${inputClass} min-h-[80px] resize-none`}
              value={form.bio}
              onChange={e => setField("bio", e.target.value)}
              placeholder="Tell sellers a bit about yourself — lifestyle, what you're looking for, why you're moving..."
              data-testid="input-bio"
            />
          </div>
        </div>

        <div className="px-5 pb-2">
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl" data-testid="notice-fair-housing-profile">
            <Scale className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Fair Housing Notice:</span> {FAIR_HOUSING_NOTICE} By submitting, you agree that your profile describes only property features and preferences.
            </p>
          </div>
        </div>
        <div className="p-5 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
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
              if (!form.isPreApproved) {
                toast({ title: "Required", description: "Please answer the pre-approval question.", variant: "destructive" });
                return;
              }
              if (!form.hasAgent) {
                toast({ title: "Required", description: "Please answer the agent question.", variant: "destructive" });
                return;
              }
              createMutation.mutate();
            }}
            disabled={!form.displayName || !form.preApprovalAmount || !form.isPreApproved || !form.hasAgent || createMutation.isPending}
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
