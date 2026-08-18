import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Radar,
  Search,
  FileDown,
  DollarSign,
  BedDouble,
  Bath,
  Maximize2,
  MapPin,
  Home,
  ShieldCheck,
  Clock,
  Heart,
  Star,
  Users,
  Phone,
  Mail,
  Building2,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { jsPDF } from "jspdf";
import logoPath from "@assets/doocasa-logo.png";

interface BeaconFormData {
  address: string;
  city: string;
  state: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  propertyType: string;
  mustHaves: string;
}

interface MatchedBuyer {
  id: number;
  displayName: string;
  preApprovalAmount: number;
  isPreApproved: boolean;
  minBeds: number | null;
  maxBeds: number | null;
  minBaths: string | null;
  minSqft: number | null;
  maxSqft: number | null;
  preferredCities: string[] | null;
  homeTypes: string[] | null;
  mustHaves: string[] | null;
  niceToHaves: string[] | null;
  moveInTimeline: string | null;
  hasAgent: boolean | null;
  bio: string | null;
  matchScore: number;
  matchTier: "Strong" | "Good" | "Potential";
  scoreBreakdown: Record<string, number>;
}

const PROPERTY_TYPES = [
  { value: "SFH", label: "Single Family Home" },
  { value: "Condo", label: "Condo" },
  { value: "Townhome", label: "Townhome" },
  { value: "Multi-Family", label: "Multi-Family" },
  { value: "Land", label: "Land" },
];

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
  return `$${amount.toLocaleString()}`;
}

export function BeaconTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<BeaconFormData>({
    address: "",
    city: "",
    state: "",
    price: "",
    beds: "",
    baths: "",
    sqft: "",
    propertyType: "SFH",
    mustHaves: "",
  });
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const queryEnabled = searchTriggered && !!searchParams.price && !!searchParams.city;

  const beaconQueryString = queryEnabled
    ? `?price=${searchParams.price}&beds=${searchParams.beds}&baths=${searchParams.baths}&sqft=${searchParams.sqft}&city=${encodeURIComponent(searchParams.city || "")}&propertyType=${encodeURIComponent(searchParams.propertyType || "")}&mustHaves=${encodeURIComponent(searchParams.mustHaves || "")}`
    : "";

  const { data, isLoading, error } = useQuery<{ matches: MatchedBuyer[]; total: number }>({
    queryKey: ["/api/beacon/match-buyers", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/beacon/match-buyers${beaconQueryString}`, { credentials: "include" });
      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        throw new Error(errBody || "Failed to match buyers");
      }
      return res.json();
    },
    enabled: queryEnabled,
  });

  const matches = data?.matches || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.price || !form.city) {
      toast({ title: "Missing fields", description: "Price and city are required.", variant: "destructive" });
      return;
    }
    setSearchParams({
      price: form.price,
      beds: form.beds || "0",
      baths: form.baths || "0",
      sqft: form.sqft || "0",
      city: form.city,
      propertyType: form.propertyType,
      mustHaves: form.mustHaves || "",
    });
    setSearchTriggered(true);
  };

  const updateField = (field: keyof BeaconFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const generatePDF = useCallback(async () => {
    if (matches.length === 0) return;
    setIsGenerating(true);

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentW = pageW - margin * 2;
      let y = margin;

      const primaryColor: [number, number, number] = [160, 32, 32];
      const darkText: [number, number, number] = [30, 30, 30];
      const mutedText: [number, number, number] = [120, 120, 120];
      const lightBg: [number, number, number] = [248, 248, 248];
      const white: [number, number, number] = [255, 255, 255];

      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, pageH - 15, pageW - margin, pageH - 15);
        doc.setFontSize(8);
        doc.setTextColor(...mutedText);
        doc.text("Powered by xucasa — www.xucasa.com", margin, pageH - 10);
        doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 10, { align: "right" });
      };

      const checkPageBreak = (needed: number) => {
        if (y + needed > pageH - 25) {
          doc.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // ===== COVER PAGE =====
      let logoLoaded = false;
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = logoPath;
        });
        const imgRatio = img.width / img.height;
        const logoW = 40;
        const logoH = logoW / imgRatio;
        doc.addImage(img, "PNG", (pageW - logoW) / 2, y, logoW, logoH);
        y += logoH + 5;
        logoLoaded = true;
      } catch {
        doc.setFontSize(24);
        doc.setTextColor(...primaryColor);
        doc.setFont("helvetica", "bold");
        doc.text("xucasa", pageW / 2, y + 10, { align: "center" });
        y += 18;
      }

      doc.setFontSize(10);
      doc.setTextColor(...mutedText);
      doc.text("www.xucasa.com", pageW / 2, y, { align: "center" });
      y += 15;

      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.8);
      doc.line(margin + 30, y, pageW - margin - 30, y);
      y += 15;

      doc.setFontSize(22);
      doc.setTextColor(...darkText);
      doc.setFont("helvetica", "bold");
      doc.text("Pre-Market Buyer Report", pageW / 2, y, { align: "center" });
      y += 10;

      doc.setFontSize(11);
      doc.setTextColor(...mutedText);
      doc.setFont("helvetica", "normal");
      doc.text("Qualified buyers ready to make an offer before listing", pageW / 2, y, { align: "center" });
      y += 20;

      // Property details box
      doc.setFillColor(...lightBg);
      doc.roundedRect(margin, y, contentW, 42, 3, 3, "F");
      doc.setDrawColor(220, 220, 220);
      doc.roundedRect(margin, y, contentW, 42, 3, 3, "S");

      doc.setFontSize(9);
      doc.setTextColor(...mutedText);
      doc.text("SUBJECT PROPERTY", margin + 8, y + 8);

      doc.setFontSize(14);
      doc.setTextColor(...darkText);
      doc.setFont("helvetica", "bold");
      const fullAddress = `${form.address}${form.address ? ", " : ""}${form.city}, ${form.state}`;
      doc.text(fullAddress, margin + 8, y + 18);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const priceNum = parseInt(form.price);
      const details = [
        `$${priceNum.toLocaleString()}`,
        form.beds ? `${form.beds} Beds` : "",
        form.baths ? `${form.baths} Baths` : "",
        form.sqft ? `${parseInt(form.sqft).toLocaleString()} Sqft` : "",
        PROPERTY_TYPES.find(t => t.value === form.propertyType)?.label || form.propertyType,
      ].filter(Boolean).join("  •  ");
      doc.setTextColor(...mutedText);
      doc.text(details, margin + 8, y + 28);

      doc.setFontSize(9);
      doc.text(`Report generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin + 8, y + 36);
      y += 52;

      // Match count
      doc.setFontSize(16);
      doc.setTextColor(...primaryColor);
      doc.setFont("helvetica", "bold");
      doc.text(`${matches.length} Qualified Buyer${matches.length !== 1 ? "s" : ""} Found`, pageW / 2, y, { align: "center" });
      y += 20;

      // Agent info section
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, y, contentW, 45, 3, 3, "F");

      let agentPhotoLoaded = false;
      if ((user as any)?.profileImageUrl) {
        try {
          const agentImg = new Image();
          agentImg.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            agentImg.onload = () => resolve();
            agentImg.onerror = () => reject();
            agentImg.src = (user as any).profileImageUrl;
          });
          doc.addImage(agentImg, "JPEG", margin + 6, y + 6, 33, 33);
          agentPhotoLoaded = true;
        } catch {}
      }

      const agentTextX = agentPhotoLoaded ? margin + 46 : margin + 10;

      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.text("YOUR LISTING AGENT", agentTextX, y + 10);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const agentName = `${(user as any)?.firstName || ""} ${(user as any)?.lastName || ""}`.trim() || "Agent";
      doc.text(agentName, agentTextX, y + 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const agentDetails: string[] = [];
      if ((user as any)?.email) agentDetails.push((user as any).email);
      if ((user as any)?.phone) agentDetails.push((user as any).phone);
      if (agentDetails.length) doc.text(agentDetails.join("  |  "), agentTextX, y + 25);

      const agentCredentials: string[] = [];
      if ((user as any)?.brokerageName) agentCredentials.push((user as any).brokerageName);
      if ((user as any)?.licenseNumber) agentCredentials.push(`DRE# ${(user as any).licenseNumber}`);
      if ((user as any)?.licenseState) agentCredentials.push((user as any).licenseState);
      if (agentCredentials.length) doc.text(agentCredentials.join("  |  "), agentTextX, y + 32);

      y += 55;

      // ===== BUYER PAGES =====
      doc.addPage();
      y = margin;

      doc.setFontSize(16);
      doc.setTextColor(...darkText);
      doc.setFont("helvetica", "bold");
      doc.text("Matched Buyer Profiles", margin, y);
      y += 3;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.6);
      doc.line(margin, y, margin + 60, y);
      y += 10;

      for (let i = 0; i < matches.length; i++) {
        const buyer = matches[i];
        const cardH = 55;
        checkPageBreak(cardH + 5);

        doc.setFillColor(...lightBg);
        doc.roundedRect(margin, y, contentW, cardH, 2, 2, "F");
        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(margin, y, contentW, cardH, 2, 2, "S");

        // Buyer number badge
        doc.setFillColor(...primaryColor);
        doc.roundedRect(margin + 5, y + 5, 8, 8, 1, 1, "F");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(`${i + 1}`, margin + 9, y + 11, { align: "center" });

        // Name & badges
        doc.setFontSize(12);
        doc.setTextColor(...darkText);
        doc.setFont("helvetica", "bold");
        doc.text(buyer.displayName || `Buyer ${i + 1}`, margin + 18, y + 12);

        let badgeX = margin + 18 + doc.getTextWidth(buyer.displayName || `Buyer ${i + 1}`) + 4;
        if (buyer.isPreApproved) {
          doc.setFillColor(34, 139, 34);
          doc.roundedRect(badgeX, y + 6, 22, 6, 1, 1, "F");
          doc.setFontSize(6);
          doc.setTextColor(255, 255, 255);
          doc.text("PRE-APPROVED", badgeX + 11, y + 10.5, { align: "center" });
          badgeX += 25;
        }
        if (buyer.hasAgent === false) {
          doc.setFillColor(59, 130, 246);
          doc.roundedRect(badgeX, y + 6, 24, 6, 1, 1, "F");
          doc.setFontSize(6);
          doc.setTextColor(255, 255, 255);
          doc.text("UNREPRESENTED", badgeX + 12, y + 10.5, { align: "center" });
          badgeX += 27;
        }

        // Tier badge (Strong / Good / Potential)
        const tierColor: [number, number, number] =
          buyer.matchTier === "Strong"
            ? [34, 139, 34]
            : buyer.matchTier === "Good"
            ? [217, 119, 6]
            : [107, 114, 128];
        const tierLabel = buyer.matchTier.toUpperCase();
        doc.setFontSize(6);
        const tierW = doc.getTextWidth(tierLabel) + 6;
        doc.setFillColor(...tierColor);
        doc.roundedRect(badgeX, y + 6, tierW, 6, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(tierLabel, badgeX + tierW / 2, y + 10.5, { align: "center" });

        // Budget + match score
        doc.setFontSize(13);
        doc.setTextColor(...primaryColor);
        doc.setFont("helvetica", "bold");
        doc.text(`$${buyer.preApprovalAmount.toLocaleString()}`, pageW - margin - 6, y + 11, { align: "right" });
        doc.setFontSize(7);
        doc.setTextColor(...mutedText);
        doc.setFont("helvetica", "normal");
        doc.text("Budget", pageW - margin - 6, y + 16, { align: "right" });
        doc.setFontSize(9);
        doc.setTextColor(...darkText);
        doc.setFont("helvetica", "bold");
        doc.text(`Match: ${buyer.matchScore}/100`, pageW - margin - 6, y + 21, { align: "right" });

        // Details row
        let detailY = y + 25;
        doc.setFontSize(8);
        doc.setTextColor(...mutedText);
        doc.setFont("helvetica", "normal");

        const detailItems: string[] = [];
        if (buyer.minBeds || buyer.maxBeds) {
          const bedRange = buyer.maxBeds ? `${buyer.minBeds || 0}–${buyer.maxBeds}` : `${buyer.minBeds}+`;
          detailItems.push(`Beds: ${bedRange}`);
        }
        if (buyer.minBaths) detailItems.push(`Baths: ${buyer.minBaths}+`);
        if (buyer.minSqft || buyer.maxSqft) {
          const sqftRange = buyer.maxSqft ? `${buyer.minSqft?.toLocaleString() || "0"}–${buyer.maxSqft.toLocaleString()}` : `${buyer.minSqft?.toLocaleString()}+`;
          detailItems.push(`Sqft: ${sqftRange}`);
        }
        if (buyer.moveInTimeline) detailItems.push(`Timeline: ${buyer.moveInTimeline}`);

        if (detailItems.length) {
          doc.setTextColor(...darkText);
          doc.text(detailItems.join("    |    "), margin + 8, detailY);
          detailY += 7;
        }

        if (buyer.preferredCities?.length) {
          doc.setFontSize(7);
          doc.setTextColor(...mutedText);
          doc.text(`Preferred Areas: ${buyer.preferredCities.join(", ")}`, margin + 8, detailY);
          detailY += 6;
        }

        if (buyer.homeTypes?.length) {
          doc.setFontSize(7);
          doc.setTextColor(...mutedText);
          doc.text(`Home Types: ${buyer.homeTypes.join(", ")}`, margin + 8, detailY);
          detailY += 6;
        }

        if (buyer.mustHaves?.length) {
          doc.setFontSize(7);
          doc.setTextColor(...mutedText);
          doc.text(`Must-Haves: ${buyer.mustHaves.slice(0, 5).join(", ")}`, margin + 8, detailY);
        }

        y += cardH + 5;
      }

      // ===== DISCLAIMER PAGE =====
      checkPageBreak(80);
      y += 10;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageW - margin, y);
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(...darkText);
      doc.setFont("helvetica", "bold");
      doc.text("Disclaimer", margin, y);
      y += 7;

      doc.setFontSize(8);
      doc.setTextColor(...mutedText);
      doc.setFont("helvetica", "normal");
      const disclaimer = [
        "This report is generated by xucasa for informational purposes only. Buyer information is aggregated from",
        "active buyer profiles on the xucasa platform. Contact information for buyers remains private and is not",
        "disclosed in this report. For buyer introductions and facilitation of offers, please work with your",
        "xucasa representative. This report does not constitute an offer, guarantee, or commitment from any buyer.",
        "",
        "Equal Housing Opportunity. xucasa complies with all applicable Fair Housing laws.",
      ];
      disclaimer.forEach(line => {
        doc.text(line, margin, y);
        y += 4.5;
      });

      y += 10;
      doc.setFontSize(9);
      doc.setTextColor(...darkText);
      doc.setFont("helvetica", "bold");
      doc.text(`${agentName}  |  ${(user as any)?.email || ""}  |  ${(user as any)?.phone || ""}`, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(agentCredentials.join("  |  "), margin, y);

      // Add footers to all pages
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        addFooter(p, totalPages);
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeAddress = (form.address || form.city).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      doc.save(`Beacon_Report_${safeAddress}_${dateStr}.pdf`);

      toast({ title: "Report downloaded", description: `Beacon report with ${matches.length} matched buyer${matches.length !== 1 ? "s" : ""} saved.` });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({ title: "PDF Error", description: "Failed to generate the report. Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [matches, form, user, toast]);

  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";
  const labelClass = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-8">
      <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Radar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground" data-testid="heading-beacon">Beacon Report</h2>
            <p className="text-sm text-muted-foreground">Enter a prospective listing to find ready & willing buyers</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="space-y-5">
          <div>
            <label className={labelClass}>Property Address</label>
            <input
              type="text"
              className={inputClass}
              placeholder="123 Main Street"
              value={form.address}
              onChange={e => updateField("address", e.target.value)}
              data-testid="input-beacon-address"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>City *</label>
              <input
                type="text"
                className={inputClass}
                placeholder="San Diego"
                value={form.city}
                onChange={e => updateField("city", e.target.value)}
                required
                data-testid="input-beacon-city"
              />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input
                type="text"
                className={inputClass}
                placeholder="CA"
                value={form.state}
                onChange={e => updateField("state", e.target.value)}
                data-testid="input-beacon-state"
              />
            </div>
            <div>
              <label className={labelClass}>Asking Price *</label>
              <input
                type="number"
                className={inputClass}
                placeholder="850000"
                value={form.price}
                onChange={e => updateField("price", e.target.value)}
                required
                min={1}
                data-testid="input-beacon-price"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Beds</label>
              <input
                type="number"
                className={inputClass}
                placeholder="3"
                value={form.beds}
                onChange={e => updateField("beds", e.target.value)}
                min={0}
                data-testid="input-beacon-beds"
              />
            </div>
            <div>
              <label className={labelClass}>Baths</label>
              <input
                type="number"
                className={inputClass}
                placeholder="2"
                value={form.baths}
                onChange={e => updateField("baths", e.target.value)}
                min={0}
                step="0.5"
                data-testid="input-beacon-baths"
              />
            </div>
            <div>
              <label className={labelClass}>Sqft</label>
              <input
                type="number"
                className={inputClass}
                placeholder="1800"
                value={form.sqft}
                onChange={e => updateField("sqft", e.target.value)}
                min={0}
                data-testid="input-beacon-sqft"
              />
            </div>
            <div>
              <label className={labelClass}>Property Type</label>
              <select
                className={inputClass}
                value={form.propertyType}
                onChange={e => updateField("propertyType", e.target.value)}
                data-testid="select-beacon-property-type"
              >
                {PROPERTY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Listing Features (comma-separated)</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. pool, garage, ocean view, single story"
              value={form.mustHaves}
              onChange={e => updateField("mustHaves", e.target.value)}
              data-testid="input-beacon-must-haves"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Enter features this listing has to surface buyers who specifically want them.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-xl font-bold hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
            data-testid="button-beacon-search"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Find Matching Buyers
          </button>
        </form>
      </div>

      {/* Results Section */}
      {searchTriggered && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card rounded-2xl border border-border p-6 animate-pulse">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="h-5 bg-muted rounded w-40" />
                      <div className="h-4 bg-muted rounded w-24" />
                    </div>
                    <div className="h-6 bg-muted rounded w-20" />
                  </div>
                  <div className="flex gap-4 mt-4">
                    <div className="h-4 bg-muted rounded w-16" />
                    <div className="h-4 bg-muted rounded w-16" />
                    <div className="h-4 bg-muted rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-destructive/10 text-destructive rounded-2xl p-6 text-center">
              <p className="font-bold">Failed to search buyers</p>
              <p className="text-sm mt-1">Please check your inputs and try again.</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-10 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-display font-bold text-lg mb-2">No Matching Buyers Found</h3>
              <p className="text-muted-foreground text-sm">Try adjusting the price or criteria to widen the search.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold" data-testid="text-beacon-match-count">
                    {matches.length} Buyer{matches.length !== 1 ? "s" : ""} Matched
                  </div>
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    for {form.address ? `${form.address}, ` : ""}{form.city}{form.state ? `, ${form.state}` : ""}
                  </p>
                </div>
                <button
                  onClick={generatePDF}
                  disabled={isGenerating}
                  className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50"
                  data-testid="button-beacon-generate-pdf"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Generate PDF Report
                </button>
              </div>

              <div className="space-y-3">
                {matches.map((buyer, idx) => {
                  const tierClasses =
                    buyer.matchTier === "Strong"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : buyer.matchTier === "Good"
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
                  return (
                  <div
                    key={buyer.id}
                    className="bg-card rounded-2xl border border-border p-5 sm:p-6 hover:border-primary/30 transition-colors"
                    data-testid={`card-beacon-buyer-${buyer.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-foreground">{buyer.displayName || `Buyer ${idx + 1}`}</h3>
                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded-full ${tierClasses}`}
                              data-testid={`tier-beacon-buyer-${buyer.id}`}
                            >
                              {buyer.matchTier}
                            </span>
                            {buyer.isPreApproved && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                                <ShieldCheck className="w-3 h-3" />
                                Pre-Approved
                              </span>
                            )}
                            {buyer.hasAgent === false && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded-full">
                                <Users className="w-3 h-3" />
                                Unrepresented
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Budget: <span className="font-bold text-primary">{formatCurrency(buyer.preApprovalAmount)}</span>
                          </p>
                        </div>
                      </div>
                      <div
                        className="flex flex-col items-end shrink-0"
                        data-testid={`score-beacon-buyer-${buyer.id}`}
                      >
                        <div className="text-2xl font-bold font-display text-foreground leading-none">
                          {buyer.matchScore}
                          <span className="text-sm text-muted-foreground font-normal">/100</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                          Match Score
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-muted-foreground">
                      {(buyer.minBeds || buyer.maxBeds) && (
                        <span className="flex items-center gap-1.5">
                          <BedDouble className="w-3.5 h-3.5" />
                          {buyer.maxBeds ? `${buyer.minBeds || 0}–${buyer.maxBeds}` : `${buyer.minBeds}+`} beds
                        </span>
                      )}
                      {buyer.minBaths && (
                        <span className="flex items-center gap-1.5">
                          <Bath className="w-3.5 h-3.5" />
                          {buyer.minBaths}+ baths
                        </span>
                      )}
                      {(buyer.minSqft || buyer.maxSqft) && (
                        <span className="flex items-center gap-1.5">
                          <Maximize2 className="w-3.5 h-3.5" />
                          {buyer.maxSqft ? `${buyer.minSqft?.toLocaleString() || "0"}–${buyer.maxSqft.toLocaleString()}` : `${buyer.minSqft?.toLocaleString()}+`} sqft
                        </span>
                      )}
                      {buyer.moveInTimeline && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {buyer.moveInTimeline}
                        </span>
                      )}
                    </div>

                    {(buyer.preferredCities?.length || buyer.homeTypes?.length) && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {buyer.preferredCities?.map(city => (
                          <span key={city} className="px-2.5 py-1 bg-muted text-muted-foreground text-xs rounded-full flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {city}
                          </span>
                        ))}
                        {buyer.homeTypes?.map(type => (
                          <span key={type} className="px-2.5 py-1 bg-primary/5 text-primary text-xs rounded-full flex items-center gap-1">
                            <Home className="w-3 h-3" />
                            {type}
                          </span>
                        ))}
                      </div>
                    )}

                    {buyer.mustHaves?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {buyer.mustHaves.slice(0, 6).map(item => (
                          <span key={item} className="px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-full flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <details className="mt-4 group" data-testid={`breakdown-beacon-buyer-${buyer.id}`}>
                      <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1.5">
                        <Star className="w-3 h-3" />
                        <span className="group-open:hidden">Show score breakdown</span>
                        <span className="hidden group-open:inline">Hide score breakdown</span>
                      </summary>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {[
                          { key: "budget", label: "Budget headroom", max: 20 },
                          { key: "preApproval", label: "Pre-approved", max: 15 },
                          { key: "beds", label: "Beds match", max: 15 },
                          { key: "mustHaves", label: "Must-haves overlap", max: 20 },
                          { key: "timeline", label: "Move-in timeline", max: 15 },
                          { key: "recency", label: "Profile recency", max: 15 },
                        ].map(({ key, label, max }) => (
                          <div key={key} className="flex items-center justify-between bg-muted/40 rounded-lg px-2.5 py-1.5">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-bold text-foreground">
                              {buyer.scoreBreakdown?.[key] ?? 0}
                              <span className="text-muted-foreground font-normal">/{max}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
