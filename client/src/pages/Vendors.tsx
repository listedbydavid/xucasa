import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AuthPromptModal from "@/components/AuthPromptModal";
import { SD_NEIGHBORHOOD_GROUPS, type VendorProfile } from "@shared/schema";
import {
  CheckCircle2, X, Phone, Globe, Instagram, Facebook, ExternalLink,
  ShieldCheck, Loader2, Upload, Wrench, Search as SearchIcon,
} from "lucide-react";
import { SiYelp, SiGoogle, SiNextdoor } from "react-icons/si";

const CATEGORIES = [
  "Pest Control", "Plumbing", "HVAC", "Landscaping", "Gutters", "Renovation",
  "Roofing", "Electrical", "Inspection", "Staging", "Photography",
  "Garage Door", "Painting",
];

const CATEGORY_ICONS: Record<string, string> = {
  "Pest Control": "🐜", "Plumbing": "🔧", "HVAC": "❄️", "Landscaping": "🌿",
  "Gutters": "🏠", "Renovation": "🔨", "Roofing": "🏘️", "Electrical": "⚡",
  "Inspection": "🔍", "Staging": "🛋️", "Photography": "📸",
  "Garage Door": "🚪", "Painting": "🎨",
};

type VendorListResponse = { vendors: VendorProfile[] };

function VendorCard({ vendor, onRequestBid }: { vendor: VendorProfile; onRequestBid: (v: VendorProfile) => void }) {
  const neighborhoods = vendor.serviceAreaNeighborhoods || [];
  const shownAreas = neighborhoods.slice(0, 4);
  const extra = neighborhoods.length - shownAreas.length;
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col" data-testid={`card-vendor-${vendor.id}`}>
      <div className="flex items-start gap-3 mb-3">
        {vendor.logoUrl ? (
          <img src={vendor.logoUrl} alt={vendor.businessName} className="w-14 h-14 rounded-xl object-contain bg-muted border border-border" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-2xl">{CATEGORY_ICONS[vendor.category] || "🛠️"}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-foreground truncate" data-testid={`text-vendor-name-${vendor.id}`}>{vendor.businessName}</h3>
            {vendor.isVerified && <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0" aria-label="Verified" />}
          </div>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-border text-muted-foreground">{vendor.category}</span>
        </div>
      </div>
      {vendor.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{vendor.description}</p>
      )}
      {shownAreas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {shownAreas.map(area => (
            <span key={area} className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{area}</span>
          ))}
          {extra > 0 && <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">+{extra} more</span>}
        </div>
      )}
      <div className="flex items-center gap-2 mb-3 text-muted-foreground">
        {vendor.yelpUrl && <a href={vendor.yelpUrl} target="_blank" rel="noopener noreferrer" aria-label="Yelp" data-testid={`link-yelp-${vendor.id}`}><SiYelp className="w-4 h-4 hover:text-foreground" /></a>}
        {vendor.googleBusinessUrl && <a href={vendor.googleBusinessUrl} target="_blank" rel="noopener noreferrer" aria-label="Google" data-testid={`link-google-${vendor.id}`}><SiGoogle className="w-4 h-4 hover:text-foreground" /></a>}
        {vendor.instagramHandle && <a href={`https://instagram.com/${vendor.instagramHandle}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" data-testid={`link-instagram-${vendor.id}`}><Instagram className="w-4 h-4 hover:text-foreground" /></a>}
        {vendor.facebookUrl && <a href={vendor.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" data-testid={`link-facebook-${vendor.id}`}><Facebook className="w-4 h-4 hover:text-foreground" /></a>}
        {vendor.nextdoorUrl && <a href={vendor.nextdoorUrl} target="_blank" rel="noopener noreferrer" aria-label="Nextdoor" data-testid={`link-nextdoor-${vendor.id}`}><SiNextdoor className="w-4 h-4 hover:text-foreground" /></a>}
        {vendor.website && <a href={vendor.website} target="_blank" rel="noopener noreferrer" aria-label="Website" data-testid={`link-website-${vendor.id}`}><Globe className="w-4 h-4 hover:text-foreground" /></a>}
      </div>
      {vendor.phone && (
        <a href={`tel:${vendor.phone}`} className="text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5" data-testid={`link-phone-${vendor.id}`}>
          <Phone className="w-4 h-4" /> {vendor.phone}
        </a>
      )}
      <button
        onClick={() => onRequestBid(vendor)}
        className="mt-auto w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-colors"
        data-testid={`button-request-bid-${vendor.id}`}
      >
        Request a Bid
      </button>
    </div>
  );
}

function BidModal({ vendor, onClose }: { vendor: VendorProfile; onClose: () => void }) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/vendors/${vendor.id}/request-bid`, { message, propertyAddress: propertyAddress || undefined });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bid request sent", description: "We'll be in touch shortly." });
      onClose();
    },
    onError: (err: any) => toast({ title: "Could not send", description: err?.message || "Try again.", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()} data-testid="modal-bid-request">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Request a bid</h2>
            <p className="text-sm text-muted-foreground">from {vendor.businessName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={500}
            placeholder="Describe what you need (max 500 chars)"
            rows={4}
            className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="input-bid-message"
          />
          <input
            value={propertyAddress}
            onChange={e => setPropertyAddress(e.target.value)}
            placeholder="Property address (optional)"
            className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="input-bid-address"
          />
          <button
            onClick={() => mutation.mutate()}
            disabled={!message.trim() || mutation.isPending}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-bid-send"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplyModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [yelpUrl, setYelpUrl] = useState("");
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [nextdoorUrl, setNextdoorUrl] = useState("");
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [zips, setZips] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleNeighborhood = (n: string) => {
    setNeighborhoods(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  };
  const selectAllInGroup = (group: string[]) => {
    setNeighborhoods(prev => {
      const allIn = group.every(n => prev.includes(n));
      return allIn ? prev.filter(n => !group.includes(n)) : Array.from(new Set([...prev, ...group]));
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!businessName.trim() || !category || !contactName.trim() || !email.trim()) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("businessName", businessName.trim());
      fd.append("category", category);
      fd.append("contactName", contactName.trim());
      fd.append("email", email.trim());
      if (phone) fd.append("phone", phone);
      if (description) fd.append("description", description);
      if (website) fd.append("website", website);
      if (yelpUrl) fd.append("yelpUrl", yelpUrl);
      if (googleBusinessUrl) fd.append("googleBusinessUrl", googleBusinessUrl);
      if (instagramHandle) fd.append("instagramHandle", instagramHandle.replace(/^@/, ""));
      if (facebookUrl) fd.append("facebookUrl", facebookUrl);
      if (nextdoorUrl) fd.append("nextdoorUrl", nextdoorUrl);
      for (const n of neighborhoods) fd.append("serviceAreaNeighborhoods", n);
      if (zips) fd.append("serviceAreaZips", zips);
      if (notes) fd.append("applicationNotes", notes);
      if (logoFile) fd.append("logo", logoFile);

      const res = await fetch("/api/vendors/apply", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Submission failed");
      }
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Could not submit", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-2xl w-full my-8 shadow-xl" onClick={e => e.stopPropagation()} data-testid="modal-vendor-apply">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-2xl font-bold">List Your Business</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {submitted ? (
          <div className="py-12 text-center" data-testid="apply-success">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Application submitted!</h3>
            <p className="text-muted-foreground">We'll review within 2 business days and send you an email confirmation.</p>
            <button onClick={onClose} className="mt-6 bg-primary text-white px-6 py-2.5 rounded-xl font-bold">Close</button>
          </div>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="font-bold mb-2">Business Info</h3>
              <div className="space-y-3">
                <input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Business Name *" className={inputClass} data-testid="input-business-name" />
                <select value={category} onChange={e => setCategory(e.target.value)} className={inputClass} data-testid="select-category">
                  <option value="">Select category *</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Contact Name *" className={inputClass} data-testid="input-contact-name" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email *" type="email" className={inputClass} data-testid="input-email" />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className={inputClass} data-testid="input-phone" />
                </div>
                <div>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} placeholder="Description" rows={3} className={inputClass} data-testid="input-description" />
                  <div className="text-xs text-muted-foreground text-right mt-1">{description.length}/500</div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary"><Upload className="w-4 h-4" /> Upload Logo</span>
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" data-testid="input-logo" />
                  {logoPreview && <img src={logoPreview} alt="preview" className="w-12 h-12 rounded-lg object-contain border border-border" />}
                </label>
              </div>
            </section>

            <section>
              <h3 className="font-bold mb-2">Online Presence</h3>
              <div className="space-y-3">
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="Website URL" className={inputClass} data-testid="input-website" />
                <input value={yelpUrl} onChange={e => setYelpUrl(e.target.value)} placeholder="https://yelp.com/biz/your-business" className={inputClass} data-testid="input-yelp" />
                <input value={googleBusinessUrl} onChange={e => setGoogleBusinessUrl(e.target.value)} placeholder="https://g.page/your-business" className={inputClass} data-testid="input-google" />
                <input value={instagramHandle} onChange={e => setInstagramHandle(e.target.value)} placeholder="@yourbusiness" className={inputClass} data-testid="input-instagram" />
                <input value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="Facebook URL" className={inputClass} data-testid="input-facebook" />
                <input value={nextdoorUrl} onChange={e => setNextdoorUrl(e.target.value)} placeholder="Nextdoor URL" className={inputClass} data-testid="input-nextdoor" />
              </div>
            </section>

            <section>
              <h3 className="font-bold mb-2">Service Area</h3>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {Object.entries(SD_NEIGHBORHOOD_GROUPS).map(([group, items]) => (
                  <div key={group}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase">{group}</span>
                      <button type="button" onClick={() => selectAllInGroup(items)} className="text-xs text-primary hover:underline" data-testid={`button-select-all-${group.replace(/\s+/g, "-").toLowerCase()}`}>Select all</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map(n => {
                        const active = neighborhoods.includes(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => toggleNeighborhood(n)}
                            className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                            data-testid={`button-neighborhood-${n.replace(/\s+/g, "-").toLowerCase()}`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <input value={zips} onChange={e => setZips(e.target.value)} placeholder="92101, 92130, 92037" className={`${inputClass} mt-3`} data-testid="input-zips" />
            </section>

            <section>
              <h3 className="font-bold mb-2">Additional Notes</h3>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} placeholder="Anything else you'd like us to know?" rows={3} className={inputClass} data-testid="input-notes" />
              <div className="text-xs text-muted-foreground text-right mt-1">{notes.length}/1000</div>
            </section>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-submit-application"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Submit Application
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Vendors() {
  usePageMeta({
    title: "Local Home Services",
    description: "Find verified local vendors for pest control, plumbing, HVAC, landscaping, and more in San Diego.",
  });
  const { isAuthenticated } = useAuth();
  const [category, setCategory] = useState<string>("");
  const [showApply, setShowApply] = useState(false);
  const [bidVendor, setBidVendor] = useState<VendorProfile | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const { data, isLoading } = useQuery<VendorListResponse>({
    queryKey: ["/api/vendors", category],
    queryFn: async () => {
      const url = category ? `/api/vendors?category=${encodeURIComponent(category)}` : "/api/vendors";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load vendors");
      return res.json();
    },
  });

  const vendors = data?.vendors || [];

  const handleRequestBid = (v: VendorProfile) => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    setBidVendor(v);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-vendors-title">Local Home Services</h1>
          <p className="text-muted-foreground mt-1">Verified vendors serving San Diego County</p>
        </div>
        <button
          onClick={() => setShowApply(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
          data-testid="button-list-business"
        >
          List Your Business
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6" data-testid="category-filter">
        <button
          onClick={() => setCategory("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${category === "" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}
          data-testid="button-category-all"
        >
          All
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${category === c ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}
            data-testid={`button-category-${c.replace(/\s+/g, "-").toLowerCase()}`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center" data-testid="empty-state">
          <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-1">No vendors in this category yet</h3>
          <p className="text-muted-foreground">Be the first — click "List Your Business" above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map(v => (
            <VendorCard key={v.id} vendor={v} onRequestBid={handleRequestBid} />
          ))}
        </div>
      )}

      {showApply && <ApplyModal onClose={() => { setShowApply(false); queryClient.invalidateQueries({ queryKey: ["/api/vendors"] }); }} />}
      {bidVendor && <BidModal vendor={bidVendor} onClose={() => setBidVendor(null)} />}
      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        message="Create a free account to request bids from local vendors."
      />
    </div>
  );
}
