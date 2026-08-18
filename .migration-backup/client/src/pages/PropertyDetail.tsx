import { useState, useEffect, useCallback, useRef, Component, type ReactNode, type ErrorInfo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProperty, useProperties } from "@/hooks/use-properties";
import { useSavedProperties, useToggleSavedProperty } from "@/hooks/use-saved";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BedDouble, Bath, Maximize, MapPin, Heart, Sparkles, Building, Briefcase, ChevronLeft, ChevronRight, Phone, Mail, MessageSquare, Camera, Home, LandPlot, Clock, TrendingUp, CalendarDays, Activity, Calculator, ChevronDown, DollarSign, Percent, Share2, Printer, Check, Link2, School, Trees, Hospital, Bus, ShoppingCart, Navigation, View, ExternalLink, GraduationCap, BookOpen, Globe, Loader2, Send, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { MapView } from "@/components/MapView";
import { PublicRecordsPanel } from "@/components/PublicRecordsPanel";
import { ZoningPanel } from "@/components/ZoningPanel";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import { SdmlsDisclaimer } from "@/components/SdmlsDisclaimer";
import { PropertyReviewSection } from "@/components/PropertyReviewSection";
import { AgentMLSPanel } from "@/components/AgentMLSPanel";
import SpotlightTour from "@/components/tours/SpotlightTour";

class SectionErrorBoundary extends Component<{ children: ReactNode; name?: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; name?: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`SectionErrorBoundary [${this.props.name || "unknown"}] caught:`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const FALLBACK = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=900&fit=crop";

const ADMIN_CONTACT = {
  name: "David Hussain",
  phone: "6198886283",
  email: "david@xucasa.com",
  brokerage: "Listed by David",
  title: "Realtor | DRE# 02008317",
};

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function ContactCard({
  contactName,
  contactPhone,
  contactEmail,
  contactTitle,
  contactBrokerage,
  contactImage,
  propertyAddress,
  propertyId,
  onAskQuestion,
  onRequestShowing,
  onRequestInfo,
}: {
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactTitle?: string;
  contactBrokerage?: string;
  contactImage?: string | null;
  propertyAddress: string;
  propertyId?: number;
  onAskQuestion?: () => void;
  onRequestShowing?: () => void;
  onRequestInfo?: () => void;
}) {
  const subject = encodeURIComponent(`Inquiry about ${propertyAddress}`);
  const body = encodeURIComponent(`Hi ${contactName.split(" ")[0]},\n\nI'm interested in learning more about the property at ${propertyAddress}.\n\nPlease get back to me at your earliest convenience.\n\nThank you!`);

  return (
    <div className="hidden md:block bg-muted p-6 rounded-3xl border border-border sticky top-24" data-testid="contact-card">
      <h3 className="font-display font-bold text-lg mb-4">Your Agent</h3>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center border-2 border-primary overflow-hidden shadow-sm flex-shrink-0">
          {contactImage ? (
            <img src={contactImage} alt={contactName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-primary">
              {(contactName[0] || "A").toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-foreground truncate">{contactName}</p>
          {contactTitle && <p className="text-xs text-muted-foreground truncate">{contactTitle}</p>}
          {contactBrokerage && <p className="text-xs text-muted-foreground truncate">{contactBrokerage}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {contactPhone && (
          <>
            <a
              href={`tel:${contactPhone.replace(/\D/g, "")}`}
              className="flex items-center gap-3 w-full bg-foreground text-background py-3 px-4 rounded-xl font-semibold hover:bg-primary transition-colors shadow-md active:scale-[0.98]"
              data-testid="button-call-agent"
            >
              <Phone className="w-4 h-4" />
              Call {formatPhone(contactPhone)}
            </a>
            <a
              href={`sms:${contactPhone.replace(/\D/g, "")}?body=${encodeURIComponent(`Hi ${contactName.split(" ")[0]}, I'm interested in ${propertyAddress}`)}`}
              className="flex items-center gap-3 w-full bg-muted-foreground/10 text-foreground py-3 px-4 rounded-xl font-semibold hover:bg-muted-foreground/20 transition-colors border border-border active:scale-[0.98]"
              data-testid="button-text-agent"
            >
              <MessageSquare className="w-4 h-4" />
              Text
            </a>
          </>
        )}
        {contactEmail && (
          <a
            href={`mailto:${contactEmail}?subject=${subject}&body=${body}`}
            className="flex items-center gap-3 w-full bg-muted-foreground/10 text-foreground py-3 px-4 rounded-xl font-semibold hover:bg-muted-foreground/20 transition-colors border border-border active:scale-[0.98]"
            data-testid="button-email-agent"
          >
            <Mail className="w-4 h-4" />
            Email
          </a>
        )}

        <div className="border-t border-border pt-3 mt-1 space-y-2">
          {onAskQuestion && (
            <button
              onClick={onAskQuestion}
              className="flex items-center gap-3 w-full bg-primary/10 text-primary py-3 px-4 rounded-xl font-semibold hover:bg-primary/20 transition-colors border border-primary/20 active:scale-[0.98]"
              data-testid="button-ask-question"
            >
              <MessageSquare className="w-4 h-4" />
              Message Your Agent
            </button>
          )}
          {onRequestShowing && (
            <button
              onClick={onRequestShowing}
              className="flex items-center gap-3 w-full bg-primary/10 text-primary py-3 px-4 rounded-xl font-semibold hover:bg-primary/20 transition-colors border border-primary/20 active:scale-[0.98]"
              data-testid="button-request-showing"
            >
              <CalendarDays className="w-4 h-4" />
              Request Showing Through Agent
            </button>
          )}
          {onRequestInfo && (
            <button
              onClick={onRequestInfo}
              className="flex items-center gap-3 w-full bg-muted text-foreground py-3 px-4 rounded-xl font-semibold hover:bg-muted/80 transition-colors border border-border active:scale-[0.98]"
              data-testid="button-request-info"
            >
              <Mail className="w-4 h-4" />
              Request Info Through Agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileContactBar({
  contactName,
  contactPhone,
  contactEmail,
  propertyAddress,
  onAskQuestion,
  onRequestShowing,
  onRequestInfo,
}: {
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  propertyAddress: string;
  onAskQuestion?: () => void;
  onRequestShowing?: () => void;
  onRequestInfo?: () => void;
}) {
  const subject = encodeURIComponent(`Inquiry about ${propertyAddress}`);
  const body = encodeURIComponent(`Hi ${contactName.split(" ")[0]},\n\nI'm interested in learning more about the property at ${propertyAddress}.\n\nPlease get back to me at your earliest convenience.\n\nThank you!`);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-4 py-3 safe-bottom" data-testid="mobile-contact-bar">
      <div className="flex items-center gap-2 max-w-lg mx-auto">
        {contactPhone && (
          <a
            href={`tel:${contactPhone.replace(/\D/g, "")}`}
            className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background py-3 px-4 rounded-xl font-semibold active:scale-[0.98] transition-transform"
            data-testid="mobile-button-call"
          >
            <Phone className="w-4 h-4" />
            Call
          </a>
        )}
        {contactPhone && (
          <a
            href={`sms:${contactPhone.replace(/\D/g, "")}?body=${encodeURIComponent(`Hi ${contactName.split(" ")[0]}, I'm interested in ${propertyAddress}`)}`}
            className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground py-3 px-4 rounded-xl font-semibold border border-border active:scale-[0.98] transition-transform"
            data-testid="mobile-button-text"
          >
            <MessageSquare className="w-4 h-4" />
            Text
          </a>
        )}
        {contactEmail && (
          <a
            href={`mailto:${contactEmail}?subject=${subject}&body=${body}`}
            className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground py-3 px-4 rounded-xl font-semibold border border-border active:scale-[0.98] transition-transform"
            data-testid="mobile-button-email"
          >
            <Mail className="w-4 h-4" />
            Email
          </a>
        )}
        {onAskQuestion && (
          <button
            onClick={onAskQuestion}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-4 rounded-xl font-semibold active:scale-[0.98] transition-transform"
            data-testid="mobile-button-ask"
          >
            <MessageSquare className="w-4 h-4" />
            Ask
          </button>
        )}
        {onRequestShowing && (
          <button
            onClick={onRequestShowing}
            className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary py-3 px-4 rounded-xl font-semibold border border-primary/20 active:scale-[0.98] transition-transform"
            data-testid="mobile-button-request-showing"
          >
            <CalendarDays className="w-4 h-4" />
            Tour
          </button>
        )}
        {onRequestInfo && (
          <button
            onClick={onRequestInfo}
            className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground py-3 px-4 rounded-xl font-semibold border border-border active:scale-[0.98] transition-transform"
            data-testid="mobile-button-request-info"
          >
            <Mail className="w-4 h-4" />
            Info
          </button>
        )}
      </div>
    </div>
  );
}

function InlinePhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const startAutoRotate = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    if (photos.length <= 1) return;
    autoRef.current = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % photos.length);
    }, 2800);
  }, [photos.length]);

  useEffect(() => {
    if (!isPaused) startAutoRotate();
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [isPaused, startAutoRotate]);

  const goTo = (idx: number) => {
    setActiveIndex(idx);
    if (autoRef.current) clearInterval(autoRef.current);
    if (!isPaused) startAutoRotate();
  };

  const goPrev = () => goTo((activeIndex - 1 + photos.length) % photos.length);
  const goNext = () => goTo((activeIndex + 1) % photos.length);

  if (photos.length === 0) return null;

  const sidePhotos = photos.length > 1 ? photos.slice(1, Math.min(photos.length, 9)) : [];
  const totalCount = photos.length;

  return (
    <div
      className="w-full relative"
      data-testid="photo-gallery"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="w-full h-[35vh] sm:h-[45vh] md:h-[58vh] flex gap-1 bg-black">
        <div className="relative flex-1 min-w-0 overflow-hidden">
          <img
            key={activeIndex}
            src={photos[activeIndex]}
            alt={`${title} - Photo ${activeIndex + 1}`}
            className="w-full h-full object-cover animate-fade-in"
            data-testid={`gallery-main-photo`}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10 pointer-events-none" />

          {photos.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 text-foreground shadow-lg hover:bg-white transition-all active:scale-95 z-10"
                aria-label="Previous photo"
                data-testid="gallery-prev-photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 text-foreground shadow-lg hover:bg-white transition-all active:scale-95 z-10"
                aria-label="Next photo"
                data-testid="gallery-next-photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
            <span className="bg-black/60 backdrop-blur-sm text-white text-sm font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              {activeIndex + 1} / {totalCount}
            </span>
          </div>

          {photos.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div
                className="h-full bg-white/70 transition-all duration-300"
                style={{ width: `${((activeIndex + 1) / photos.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {sidePhotos.length > 0 && (
          <div className="hidden md:grid gap-1 w-[30%] auto-rows-fr"
            style={{ gridTemplateRows: `repeat(${Math.min(sidePhotos.length, 4)}, 1fr)`, gridTemplateColumns: sidePhotos.length > 4 ? '1fr 1fr' : '1fr' }}
          >
            {sidePhotos.slice(0, 8).map((photo, i) => {
              const globalIdx = i + 1;
              const isActive = globalIdx === activeIndex;
              return (
                <button
                  key={i}
                  onClick={() => goTo(globalIdx)}
                  className={`relative overflow-hidden transition-all ${
                    isActive ? "ring-2 ring-white ring-inset brightness-100" : "brightness-75 hover:brightness-100"
                  }`}
                  aria-label={`View photo ${globalIdx + 1}`}
                >
                  <img
                    src={photo}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {i === sidePhotos.slice(0, 8).length - 1 && photos.length > 9 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">+{photos.length - 9}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <div className="md:hidden px-4 py-2 bg-background border-b border-border overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {photos.slice(0, 20).map((photo, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`flex-shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 transition-all ${
                  i === activeIndex
                    ? "border-primary opacity-100"
                    : "border-transparent opacity-50"
                }`}
              >
                <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SimilarPropertyCard({ property }: { property: any }) {
  const photo = property.photos?.[0] || property.imageUrl || FALLBACK;
  return (
    <Link href={`/property/${property.id}`} data-testid={`card-similar-${property.id}`}>
      <div className="group cursor-pointer rounded-xl overflow-hidden border border-border bg-card hover:shadow-lg transition-shadow">
        <div className="relative aspect-[4/3] overflow-hidden">
          <img src={photo} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          <div className="absolute top-2 left-2 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Active</div>
        </div>
        <div className="p-3">
          <p className="text-base font-bold text-foreground">${property.price?.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{property.title}</p>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <span>{property.beds} bd</span>
            <span>|</span>
            <span>{property.baths} ba</span>
            <span>|</span>
            <span>{property.sqft?.toLocaleString()} sqft</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SoldPropertyCard({ listing }: { listing: any }) {
  const closeDateStr = listing.closeDate
    ? new Date(listing.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card" data-testid={`card-sold-${listing.mlsNumber}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt={listing.address} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Home className="w-8 h-8" />
          </div>
        )}
        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Sold</div>
      </div>
      <div className="p-3">
        <p className="text-base font-bold text-foreground">${listing.closePrice?.toLocaleString() || listing.listPrice?.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{listing.address}</p>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <span>{listing.beds} bd</span>
          <span>|</span>
          <span>{listing.baths} ba</span>
          <span>|</span>
          <span>{listing.sqft?.toLocaleString()} sqft</span>
        </div>
        {closeDateStr && (
          <p className="text-xs text-muted-foreground mt-1">Sold {closeDateStr}</p>
        )}
      </div>
    </div>
  );
}

function SimilarHomesSection({ propertyId }: { propertyId: number }) {
  const { data: similar, isLoading } = useQuery<any[]>({
    queryKey: [`/api/properties/${propertyId}/similar`],
  });

  if (isLoading) {
    return (
      <div className="mt-10 pt-8 border-t border-border" data-testid="section-similar-homes">
        <h2 className="text-xl font-display font-bold mb-5 flex items-center gap-2">
          <Home className="w-5 h-5 text-primary" />
          Similar Homes for Sale
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-border bg-muted/30 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      </div>
    );
  }

  if (!similar || similar.length === 0) return null;

  return (
    <div className="mt-10 pt-8 border-t border-border" data-testid="section-similar-homes">
      <h2 className="text-xl font-display font-bold mb-5 flex items-center gap-2">
        <Home className="w-5 h-5 text-primary" />
        Similar Homes for Sale
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {similar.slice(0, 8).map((p: any) => (
          <SimilarPropertyCard key={p.id} property={p} />
        ))}
      </div>
    </div>
  );
}

function SoldNearbySection({ propertyId }: { propertyId: number }) {
  const { data: sold, isLoading } = useQuery<any[]>({
    queryKey: [`/api/properties/${propertyId}/sold-nearby`],
  });

  if (isLoading) {
    return (
      <div className="mt-10 pt-8 border-t border-border" data-testid="section-sold-nearby">
        <h2 className="text-xl font-display font-bold mb-5 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Recently Sold Nearby
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Within 0.5 miles · Last 6 months</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-border bg-muted/30 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      </div>
    );
  }

  if (!sold || sold.length === 0) return null;

  const avgClosePrice = sold.reduce((sum: number, s: any) => sum + (s.closePrice || 0), 0) / sold.length;
  const avgPricePerSqft = sold.filter((s: any) => s.sqft > 0).length > 0
    ? Math.round(sold.filter((s: any) => s.sqft > 0).reduce((sum: number, s: any) => sum + (s.closePrice || 0) / s.sqft, 0) / sold.filter((s: any) => s.sqft > 0).length)
    : null;

  return (
    <div className="mt-10 pt-8 border-t border-border" data-testid="section-sold-nearby">
      <h2 className="text-xl font-display font-bold mb-5 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Recently Sold Nearby
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Within 0.5 miles · Last 6 months</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-muted/50 rounded-xl border border-border p-3 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Homes Sold</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-sold-count">{sold.length}</p>
        </div>
        <div className="bg-muted/50 rounded-xl border border-border p-3 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Avg. Sale Price</p>
          <p className="text-lg sm:text-xl font-bold text-foreground" data-testid="text-avg-sold-price">${Math.round(avgClosePrice).toLocaleString()}</p>
        </div>
        {avgPricePerSqft && (
          <div className="col-span-2 md:col-span-1 bg-muted/50 rounded-xl border border-border p-3 sm:p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Avg. $/Sq Ft</p>
            <p className="text-lg sm:text-xl font-bold text-foreground" data-testid="text-avg-price-sqft">${avgPricePerSqft}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sold.slice(0, 8).map((s: any, i: number) => (
          <SoldPropertyCard key={s.mlsNumber || i} listing={s} />
        ))}
      </div>
    </div>
  );
}

function formatWalkTime(meters: number): string {
  const minutes = Math.round(meters / 80);
  if (minutes < 1) return "< 1 min walk";
  if (minutes <= 30) return `${minutes} min walk`;
  const miles = (meters / 1609.34).toFixed(1);
  return `${miles} mi`;
}

function formatDistanceMi(meters: number): string {
  if (meters < 400) return `${meters}m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

interface NearbyPlace {
  name: string;
  type: string;
  distanceMeters: number;
}

interface NeighborhoodData {
  geocoded: { lat: number; lng: number } | null;
  neighborhood: {
    medianHouseholdIncome: number | null;
    medianHomeValue: number | null;
    totalPopulation: number | null;
    ownerOccupiedPct: number | null;
    tractId: string;
  } | null;
  flood: {
    floodZone: string;
    sfha: boolean;
    description: string;
  } | null;
  nearby: {
    schools: NearbyPlace[];
    parks: NearbyPlace[];
    hospitals: NearbyPlace[];
    transit: NearbyPlace[];
    groceries: NearbyPlace[];
  };
}

const AMENITY_CONFIG = [
  { key: "schools" as const, label: "Schools", icon: School, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400", accent: "text-blue-600 dark:text-blue-400" },
  { key: "parks" as const, label: "Parks & Recreation", icon: Trees, color: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400", accent: "text-green-600 dark:text-green-400" },
  { key: "groceries" as const, label: "Grocery & Shopping", icon: ShoppingCart, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400", accent: "text-orange-600 dark:text-orange-400" },
  { key: "transit" as const, label: "Public Transit", icon: Bus, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400", accent: "text-violet-600 dark:text-violet-400" },
  { key: "hospitals" as const, label: "Healthcare", icon: Hospital, color: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400", accent: "text-rose-600 dark:text-rose-400" },
];

interface SchoolData {
  name: string;
  level: "elementary" | "middle" | "high" | "private" | "other";
  grades: string | null;
  district: string | null;
  address: string | null;
  distanceMeters: number;
  distanceMiles: number;
  lat: number;
  lng: number;
  website: string | null;
  phone: string | null;
  greatSchoolsUrl: string | null;
}

interface SchoolsResponse {
  schools: SchoolData[];
  district: string | null;
}

const LEVEL_CONFIG: Record<string, { label: string; icon: typeof School; color: string; accent: string }> = {
  elementary: { label: "Elementary Schools", icon: BookOpen, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400", accent: "text-emerald-600 dark:text-emerald-400" },
  middle: { label: "Middle Schools", icon: School, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400", accent: "text-blue-600 dark:text-blue-400" },
  high: { label: "High Schools", icon: GraduationCap, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400", accent: "text-violet-600 dark:text-violet-400" },
  private: { label: "Private Schools", icon: School, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400", accent: "text-amber-600 dark:text-amber-400" },
};

function SchoolsSection({ propertyId }: { propertyId: number }) {
  const [isOpen, setIsOpen] = useState(true);
  const { data, isLoading } = useQuery<SchoolsResponse>({
    queryKey: ["/api/properties", propertyId, "schools"],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}/schools`);
      if (!res.ok) throw new Error("Failed to fetch schools");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  if (isLoading) {
    return (
      <div className="mt-10 pt-8 border-t border-border" data-testid="section-schools">
        <h2 className="text-xl font-display font-bold mb-5 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          Schools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-border bg-muted/30 animate-pulse h-44" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.schools.length === 0) return null;

  const grouped: Record<string, SchoolData[]> = {};
  for (const school of data.schools) {
    const key = school.level;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(school);
  }

  const levelOrder = ["elementary", "middle", "high", "private"];
  const sortedLevels = levelOrder.filter(l => grouped[l]?.length > 0);

  return (
    <div className="mt-10 pt-8 border-t border-border" data-testid="section-schools">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full mb-1"
        data-testid="toggle-schools"
      >
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h2 className="text-xl sm:text-2xl font-display font-bold">Schools</h2>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {data.district && (
        <p className="text-sm text-muted-foreground mb-4" data-testid="school-district">
          School District: <span className="font-medium text-foreground/80">{data.district}</span>
        </p>
      )}

      {isOpen && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {sortedLevels.map(level => {
              const config = LEVEL_CONFIG[level];
              const schools = grouped[level].slice(0, 5);
              const Icon = config.icon;
              return (
                <div
                  key={level}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                  data-testid={`card-schools-${level}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${config.color}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-foreground">{config.label}</h3>
                      <p className="text-xs text-muted-foreground">
                        {schools.length} nearby
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-0">
                    {schools.map((school, i) => (
                      <li
                        key={i}
                        className="py-2 border-b border-border/40 last:border-0"
                        data-testid={`item-school-${level}-${i}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm text-foreground font-medium leading-tight block truncate">
                              {school.name}
                            </span>
                            {school.grades && (
                              <span className="text-xs text-muted-foreground">
                                Grades {school.grades}
                              </span>
                            )}
                          </div>
                          <span className={`text-xs font-semibold flex-shrink-0 mt-0.5 ${config.accent}`}>
                            {school.distanceMiles} mi
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {school.greatSchoolsUrl && (
                            <a
                              href={school.greatSchoolsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary/70 hover:text-primary hover:underline flex items-center gap-0.5"
                              data-testid={`link-greatschools-${level}-${i}`}
                            >
                              GreatSchools
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          {school.website && (
                            <a
                              href={school.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary/70 hover:text-primary hover:underline flex items-center gap-0.5"
                              data-testid={`link-school-website-${level}-${i}`}
                            >
                              Website
                              <Globe className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Source: OpenStreetMap · School data is for informational purposes only</p>
        </>
      )}
    </div>
  );
}

function NeighborhoodSection({ propertyId }: { propertyId: number }) {
  const { data, isLoading } = useQuery<NeighborhoodData>({
    queryKey: [`/api/properties/${propertyId}/public-records`],
    staleTime: 1000 * 60 * 60,
  });

  const nearby = data?.nearby;
  const hasNearby = nearby && (
    (nearby.schools?.length ?? 0) > 0 ||
    (nearby.parks?.length ?? 0) > 0 ||
    (nearby.hospitals?.length ?? 0) > 0 ||
    (nearby.transit?.length ?? 0) > 0 ||
    (nearby.groceries?.length ?? 0) > 0
  );

  if (isLoading) {
    return (
      <div className="mt-10 pt-8 border-t border-border" data-testid="section-neighborhood">
        <h2 className="text-xl font-display font-bold mb-5 flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" />
          Neighborhood
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-xl border border-border bg-muted/30 animate-pulse h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasNearby) return null;

  const categories = AMENITY_CONFIG.filter(c => (nearby![c.key]?.length ?? 0) > 0);

  return (
    <div className="mt-10 pt-8 border-t border-border" data-testid="section-neighborhood">
      <div className="mb-6">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" />
          Neighborhood
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Nearby amenities within walking distance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(({ key, label, icon: Icon, color, accent }) => {
          const places = (nearby![key] || []).slice(0, 4);
          const closest = places[0];
          return (
            <div
              key={key}
              className="rounded-xl border border-border bg-muted/30 p-4"
              data-testid={`card-neighborhood-${key}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-foreground">{label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {places.length} nearby · Closest {formatWalkTime(closest.distanceMeters)}
                  </p>
                </div>
              </div>
              <ul className="space-y-0">
                {places.map((place, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                    data-testid={`item-neighborhood-${key}-${i}`}
                  >
                    <span className="text-sm text-foreground font-medium truncate mr-2">{place.name}</span>
                    <span className={`text-xs font-semibold flex-shrink-0 ${accent}`}>
                      {formatDistanceMi(place.distanceMeters)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">Source: OpenStreetMap</p>
    </div>
  );
}

function isValidTourUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function VirtualTourSection({ url }: { url: string }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!isValidTourUrl(url)) return null;

  const getEmbedUrl = (tourUrl: string): string => {
    try {
      const u = new URL(tourUrl);
      if (u.hostname.includes("matterport.com") && !u.searchParams.has("play")) {
        u.searchParams.set("play", "1");
      }
      if (u.hostname.includes("my.matterport.com") && u.pathname.startsWith("/show")) {
        u.searchParams.set("qs", "1");
        u.searchParams.set("brand", "0");
      }
      return u.toString();
    } catch {
      return tourUrl;
    }
  };

  const embedUrl = getEmbedUrl(url);

  return (
    <div className="mt-8" data-testid="virtual-tour-section">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full mb-4"
        data-testid="toggle-virtual-tour"
      >
        <div className="flex items-center gap-2">
          <View className="w-5 h-5 text-primary" />
          <h2 className="text-xl sm:text-2xl font-display font-bold">3D Virtual Tour</h2>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="space-y-3">
          <div className="relative w-full rounded-2xl overflow-hidden border border-border bg-muted" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
              allow="xr-spatial-tracking; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              referrerPolicy="no-referrer-when-downgrade"
              title="3D Virtual Tour"
              data-testid="virtual-tour-iframe"
            />
          </div>
          <div className="flex justify-end">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              data-testid="virtual-tour-external-link"
            >
              Open full tour
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function MortgageCalculator({ price, hoaFee }: { price: number; hoaFee?: number | null }) {
  const [isOpen, setIsOpen] = useState(true);
  const [homePrice, setHomePrice] = useState(price);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [interestRate, setInterestRate] = useState(6.75);
  const [loanTerm, setLoanTerm] = useState(30);
  const [propertyTaxRate, setPropertyTaxRate] = useState(1.1);
  const [homeInsurance, setHomeInsurance] = useState(150);
  const [monthlyHoa, setMonthlyHoa] = useState(hoaFee || 0);

  const downPaymentAmount = Math.round(homePrice * (downPaymentPercent / 100));
  const loanAmount = homePrice - downPaymentAmount;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;

  const monthlyPrincipalInterest =
    monthlyRate > 0
      ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

  const monthlyPropertyTax = Math.round((homePrice * (propertyTaxRate / 100)) / 12);
  const pmiRate = 0.75;
  const monthlyPmi = downPaymentPercent < 20 ? Math.round((loanAmount * (pmiRate / 100)) / 12) : 0;
  const totalMonthly = Math.round(monthlyPrincipalInterest + monthlyPropertyTax + homeInsurance + monthlyHoa + monthlyPmi);

  const piPercent = totalMonthly > 0 ? Math.round((monthlyPrincipalInterest / totalMonthly) * 100) : 0;
  const taxPercent = totalMonthly > 0 ? Math.round((monthlyPropertyTax / totalMonthly) * 100) : 0;
  const insurancePercent = totalMonthly > 0 ? Math.round((homeInsurance / totalMonthly) * 100) : 0;
  const hoaPercent = totalMonthly > 0 ? Math.round((monthlyHoa / totalMonthly) * 100) : 0;
  const pmiPercent = totalMonthly > 0 ? Math.round((monthlyPmi / totalMonthly) * 100) : 0;

  return (
    <div className="mt-10 pt-8 border-t border-border" data-testid="section-mortgage-calculator">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 group"
        data-testid="button-toggle-mortgage-calculator"
      >
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          Monthly Payment Estimate
        </h2>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="mt-6">
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-display font-bold text-foreground" data-testid="text-monthly-payment">
              ${totalMonthly.toLocaleString()}
            </span>
            <span className="text-muted-foreground font-medium">/month</span>
          </div>

          <div className="w-full h-3 rounded-full overflow-hidden flex mb-4" data-testid="mortgage-breakdown-bar">
            <div className="bg-primary h-full" style={{ width: `${piPercent}%` }} title="Principal & Interest" />
            <div className="bg-amber-500 h-full" style={{ width: `${taxPercent}%` }} title="Property Tax" />
            <div className="bg-sky-500 h-full" style={{ width: `${insurancePercent}%` }} title="Insurance" />
            {monthlyHoa > 0 && (
              <div className="bg-violet-500 h-full" style={{ width: `${hoaPercent}%` }} title="HOA" />
            )}
            {monthlyPmi > 0 && (
              <div className="bg-rose-500 h-full" style={{ width: `${pmiPercent}%` }} title="PMI" />
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm mb-8">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
              <span className="text-muted-foreground">Principal & Interest</span>
              <span className="font-semibold text-foreground" data-testid="text-pi-amount">${Math.round(monthlyPrincipalInterest).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-muted-foreground">Property Tax</span>
              <span className="font-semibold text-foreground" data-testid="text-tax-amount">${monthlyPropertyTax.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-500 flex-shrink-0" />
              <span className="text-muted-foreground">Insurance</span>
              <span className="font-semibold text-foreground" data-testid="text-insurance-amount">${homeInsurance.toLocaleString()}</span>
            </div>
            {monthlyHoa > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-violet-500 flex-shrink-0" />
                <span className="text-muted-foreground">HOA</span>
                <span className="font-semibold text-foreground" data-testid="text-hoa-amount">${monthlyHoa.toLocaleString()}</span>
              </div>
            )}
            {monthlyPmi > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 flex-shrink-0" />
                <span className="text-muted-foreground">PMI</span>
                <span className="font-semibold text-foreground" data-testid="text-pmi-amount">${monthlyPmi.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Home Price</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  value={homePrice}
                  onChange={e => setHomePrice(Number(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  data-testid="input-home-price"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                Down Payment ({downPaymentPercent}% = ${downPaymentAmount.toLocaleString()})
              </label>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={downPaymentPercent}
                onChange={e => setDownPaymentPercent(Number(e.target.value))}
                className="w-full accent-primary h-2 rounded-full cursor-pointer"
                data-testid="input-down-payment"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span>50%</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Interest Rate (%)</label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  step={0.125}
                  min={0}
                  max={15}
                  value={interestRate}
                  onChange={e => setInterestRate(Number(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  data-testid="input-interest-rate"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Loan Term</label>
              <div className="flex gap-2">
                {[15, 20, 30].map(term => (
                  <button
                    key={term}
                    onClick={() => setLoanTerm(term)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border ${
                      loanTerm === term
                        ? "bg-primary text-white border-primary"
                        : "bg-muted/50 text-foreground border-border"
                    }`}
                    data-testid={`button-loan-term-${term}`}
                  >
                    {term} yr
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Property Tax Rate (%/yr)</label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  max={5}
                  value={propertyTaxRate}
                  onChange={e => setPropertyTaxRate(Number(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  data-testid="input-property-tax-rate"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Home Insurance ($/mo)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  min={0}
                  value={homeInsurance}
                  onChange={e => setHomeInsurance(Number(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  data-testid="input-home-insurance"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">HOA Dues ($/mo)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  min={0}
                  value={monthlyHoa}
                  onChange={e => setMonthlyHoa(Number(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  data-testid="input-hoa-dues"
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            This is an estimate. Actual payments may vary based on your credit score, lender, and other factors.{monthlyPmi > 0 ? " PMI (0.75% annual rate) is included and will be removed once you reach 20% equity." : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function PriceHistorySection({ property, daysOnMarket }: { property: any; daysOnMarket: number | null }) {
  const listDateStr = property.listDate
    ? new Date(property.listDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const pricePerSqft = property.sqft > 0 ? Math.round(property.price / property.sqft) : null;

  return (
    <div className="mt-10 pt-8 border-t border-border" data-testid="section-price-history">
      <h2 className="text-xl font-display font-bold mb-5 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Price History
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-3 pr-4 font-semibold text-muted-foreground">Date</th>
              <th className="py-3 pr-4 font-semibold text-muted-foreground">Event</th>
              <th className="py-3 pr-4 font-semibold text-muted-foreground text-right">Price</th>
              <th className="py-3 font-semibold text-muted-foreground text-right">$/Sq Ft</th>
            </tr>
          </thead>
          <tbody>
            {listDateStr && (
              <tr className="border-b border-border/50" data-testid="row-price-history-listed">
                <td className="py-3 pr-4 text-foreground">{listDateStr}</td>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Listed
                  </span>
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-foreground">${(property.price || 0).toLocaleString()}</td>
                <td className="py-3 text-right text-muted-foreground">{pricePerSqft ? `$${pricePerSqft.toLocaleString()}` : '—'}</td>
              </tr>
            )}
            {!listDateStr && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground text-sm">No price history available for this listing.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Price history is based on MLS data. Some events may not be reflected.
      </p>
    </div>
  );
}

function ListingActivitySection({ property, daysOnMarket }: { property: any; daysOnMarket: number | null }) {
  const listDateStr = property.listDate
    ? new Date(property.listDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const events: { date: string; icon: any; label: string; detail?: string }[] = [];

  if (listDateStr) {
    events.push({
      date: listDateStr,
      icon: CalendarDays,
      label: "Listed for sale",
      detail: `Listed at $${(property.price || 0).toLocaleString()}`,
    });
  }

  if (property.idxUpdatedAt) {
    events.push({
      date: new Date(property.idxUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      icon: Activity,
      label: "Listing updated",
      detail: "MLS data refreshed",
    });
  }

  return (
    <div className="mt-10 pt-8 border-t border-border" data-testid="section-listing-activity">
      <h2 className="text-xl font-display font-bold mb-5 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        Listing Activity
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-muted/50 rounded-xl border border-border p-3 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Days on Market</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-dom-value">{daysOnMarket ?? '—'}</p>
        </div>
        <div className="bg-muted/50 rounded-xl border border-border p-3 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
          <p className="text-base sm:text-lg font-bold text-foreground capitalize" data-testid="text-listing-status">{property.status}</p>
        </div>
        <div className="bg-muted/50 rounded-xl border border-border p-3 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Property Type</p>
          <p className="text-base sm:text-lg font-bold text-foreground" data-testid="text-property-type">{property.propertyType || '—'}</p>
        </div>
        <div className="bg-muted/50 rounded-xl border border-border p-3 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">MLS #</p>
          <p className="text-base sm:text-lg font-bold text-foreground truncate" data-testid="text-mls-number">{property.mlsNumber || '—'}</p>
        </div>
      </div>

      {events.length > 0 ? (
        <div className="relative pl-6 space-y-0">
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
          {events.map((evt, i) => {
            const Icon = evt.icon;
            return (
              <div key={i} className="relative flex items-start gap-4 py-3" data-testid={`activity-event-${i}`}>
                <div className="absolute left-[-13px] top-4 w-5 h-5 bg-primary/10 border-2 border-primary rounded-full flex items-center justify-center">
                  <Icon className="w-2.5 h-2.5 text-primary" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-semibold text-foreground">{evt.label}</p>
                  {evt.detail && <p className="text-xs text-muted-foreground mt-0.5">{evt.detail}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{evt.date}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No listing activity available.</p>
      )}
    </div>
  );
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: property, isLoading } = useProperty(Number(id));
  usePageMeta({
    title: property?.title ?? 'Property Details',
    description: property
      ? `${property.beds} bed, ${property.baths} bath home in ${property.addressCity}, ${property.addressState}. Listed at $${property.price?.toLocaleString()}.`
      : undefined,
  });
  const { data: savedProps = [] } = useSavedProperties();
  const { mutate: toggleSave, isPending: isSaving } = useToggleSavedProperty();
  const { user, isAuthenticated } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);
  const [showShowingModal, setShowShowingModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [showingDates, setShowingDates] = useState<string[]>([""]);
  const [showingNotes, setShowingNotes] = useState("");
  const [requestInfoChecks, setRequestInfoChecks] = useState({
    disclosures: false,
    hoaDetails: false,
    additionalPhotos: false,
    floorPlan: false,
    priceHistory: false,
    neighborhoodInfo: false,
    inspectionReports: false,
  });
  const [requestInfoNote, setRequestInfoNote] = useState("");
  const { toast } = useToast();

  const askMutation = useMutation({
    mutationFn: async (data: { message: string; propertyId: number }) => {
      const res = await apiRequest("POST", "/api/conversations", {
        propertyId: data.propertyId,
        initialMessage: data.message,
        type: "ask_question",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setShowAskModal(false);
      setQuestionText("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Message sent!", description: "The agent will respond in your Messages." });
      navigate(`/conversations/${data.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const showingMutation = useMutation({
    mutationFn: async (params: { propertyId: number; dates: string[]; notes: string }) => {
      const res = await apiRequest("POST", "/api/showing-requests", {
        propertyId: params.propertyId,
        requestedDates: params.dates.filter(Boolean),
        notes: params.notes || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setShowShowingModal(false);
      setShowingDates([""]);
      setShowingNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/showing-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Showing requested!", description: "Your agent will confirm a date in your messages." });
      if (data?.conversationId) {
        navigate(`/conversations/${data.conversationId}`);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to request showing.", variant: "destructive" });
    },
  });

  const requestInfoMutation = useMutation({
    mutationFn: async (propertyId: number) => {
      const items = Object.entries(requestInfoChecks)
        .filter(([, v]) => v)
        .map(([k]) => {
          const labels: Record<string, string> = {
            disclosures: "Property disclosures",
            hoaDetails: "HOA details & fees",
            additionalPhotos: "Additional photos",
            floorPlan: "Floor plan",
            priceHistory: "Price history",
            neighborhoodInfo: "Neighborhood info",
            inspectionReports: "Inspection reports",
          };
          return labels[k] || k;
        });
      const message = `I'd like to request more information about this property:\n\n${items.map(i => `• ${i}`).join("\n")}${requestInfoNote ? `\n\nAdditional notes: ${requestInfoNote}` : ""}`;
      const res = await apiRequest("POST", "/api/conversations", {
        propertyId,
        initialMessage: message,
        type: "info_request",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setShowRequestInfoModal(false);
      setRequestInfoChecks({ disclosures: false, hoaDetails: false, additionalPhotos: false, floorPlan: false, priceHistory: false, neighborhoodInfo: false, inspectionReports: false });
      setRequestInfoNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Info request sent!", description: "The agent will respond in your Messages." });
      navigate(`/conversations/${data.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send request.", variant: "destructive" });
    },
  });

  const { data: agentLink } = useQuery<{ agentId: string; agentEmail: string; status: string } | null>({
    queryKey: ["/api/agent-invite"],
    enabled: isAuthenticated,
  });

  const { data: assignedAgent } = useQuery<{ id: string; firstName: string; lastName: string; email: string; phone: string; profileImageUrl: string | null; brokerageName: string } | null>({
    queryKey: ["/api/assigned-agent"],
    enabled: isAuthenticated,
  });

  const { data: nearbyData } = useProperties({ limit: 50, offset: 0 });
  const nearbyListings = nearbyData?.properties?.filter(p => p.status === "active") || [];

  const currentIdx = nearbyListings.findIndex(p => p.id === Number(id));
  const prevListing = currentIdx > 0 ? nearbyListings[currentIdx - 1] : null;
  const nextListing = currentIdx >= 0 && currentIdx < nearbyListings.length - 1 ? nearbyListings[currentIdx + 1] : null;

  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" && prevListing) {
        e.preventDefault();
        navigate(`/property/${prevListing.id}`);
      }
      if (e.key === "ArrowRight" && nextListing) {
        e.preventDefault();
        navigate(`/property/${nextListing.id}`);
      }
    };
    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [prevListing, nextListing, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" role="status" aria-label="Loading property details" data-testid="skeleton-property-detail">
        <span className="sr-only">Loading property details</span>
        <div className="w-full h-[35vh] sm:h-[45vh] md:h-[58vh] bg-muted animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
            <div className="flex-1 space-y-3">
              <div className="h-9 bg-muted animate-pulse rounded-md w-48" />
              <div className="h-6 bg-muted animate-pulse rounded-md w-72" />
              <div className="h-5 bg-muted animate-pulse rounded-md w-56" />
            </div>
            <div className="flex gap-2">
              <div className="h-12 w-36 bg-muted animate-pulse rounded-full" />
              <div className="h-12 w-24 bg-muted animate-pulse rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 mb-8 sm:mb-12">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="flex flex-col items-center p-3 bg-muted/50 rounded-2xl border border-border animate-pulse">
                <div className="w-6 h-6 bg-muted rounded-full mb-1.5" />
                <div className="h-6 w-12 bg-muted rounded-md mb-1" />
                <div className="h-3 w-10 bg-muted rounded-md" />
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <div className="md:col-span-2 space-y-4">
              <div className="h-7 bg-muted animate-pulse rounded-md w-48 mb-4" />
              <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
              <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
              <div className="h-4 bg-muted animate-pulse rounded-md w-3/4" />
              <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
              <div className="h-4 bg-muted animate-pulse rounded-md w-5/6" />
            </div>
            <div className="space-y-4">
              <div className="hidden md:block bg-muted/50 rounded-3xl border border-border p-6 animate-pulse">
                <div className="h-5 bg-muted rounded-md w-40 mb-4" />
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 bg-muted rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded-md w-28" />
                    <div className="h-3 bg-muted rounded-md w-36" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-12 bg-muted rounded-xl" />
                  <div className="h-12 bg-muted rounded-xl" />
                  <div className="h-12 bg-muted rounded-xl" />
                </div>
              </div>
              <div className="h-48 sm:h-64 bg-muted animate-pulse rounded-2xl border border-border" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-4xl font-display font-bold mb-4">Property not found</h1>
        <p className="text-muted-foreground">The property you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  const isSaved = savedProps.some(sp => sp.propertyId === property.id);

  const handleSave = () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    toggleSave({ propertyId: property.id, isSaved });
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = `${property.title} - $${property.price.toLocaleString()}`;
    const text = `Check out this property: ${property.title}, ${property.location} - $${property.price.toLocaleString()}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (e) {
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      } catch (e) {
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const photos: string[] =
    property.photos && (property.photos as string[]).length > 0
      ? (property.photos as string[])
      : [property.imageUrl || FALLBACK];

  const daysOnMarket = property.listDate
    ? Math.max(0, Math.floor((Date.now() - new Date(property.listDate).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const listingAgentName = property.listingAgentName || (property.agent ? `${property.agent.firstName || ""} ${property.agent.lastName || ""}`.trim() : "");
  const listingBrokerage = property.listingBrokerage || property.agent?.brokerageName || "";
  const listingAgentEmail = property.listingAgentEmail || property.agent?.email || "";
  const listingAgentPhone = property.listingAgentPhone || "";
  const listingAgentImage = property.agent?.profileImageUrl || null;

  const hasAssignedAgent = !!assignedAgent;
  const contactName = hasAssignedAgent
    ? `${assignedAgent.firstName || ""} ${assignedAgent.lastName || ""}`.trim() || "Your Agent"
    : ADMIN_CONTACT.name;
  const contactPhone = hasAssignedAgent ? (assignedAgent.phone || null) : ADMIN_CONTACT.phone;
  const contactEmail = hasAssignedAgent ? (assignedAgent.email || null) : ADMIN_CONTACT.email;
  const contactTitle = hasAssignedAgent ? "Your Agent" : ADMIN_CONTACT.title;
  const contactBrokerage = hasAssignedAgent ? (assignedAgent.brokerageName || "") : ADMIN_CONTACT.brokerage;
  const contactImage = hasAssignedAgent ? assignedAgent.profileImageUrl : null;

  const propertyAddress = `${property.title}, ${property.location}`;

  const handleAskQuestion = () => {
    if (!isAuthenticated) { setShowAuthPrompt(true); return; }
    setShowAskModal(true);
  };

  const handleRequestShowing = () => {
    if (!isAuthenticated) { setShowAuthPrompt(true); return; }
    setShowShowingModal(true);
  };

  const handleRequestInfo = () => {
    if (!isAuthenticated) { setShowAuthPrompt(true); return; }
    setShowRequestInfoModal(true);
  };

  return (
    <>
      {property && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "RealEstateListing",
              "name": property.title,
              "description": property.description ??
                `${property.beds} bed, ${property.baths} bath home in ${property.addressCity}, ${property.addressState}`,
              "url": `https://xucasa.com/property/${property.id}`,
              "image": property.photos?.[0] ?? property.imageUrl,
              "offers": {
                "@type": "Offer",
                "price": property.price,
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
              },
              "address": {
                "@type": "PostalAddress",
                "streetAddress": `${property.addressStreetNumber ?? ''} ${property.addressStreetName ?? ''}`.trim(),
                "addressLocality": property.addressCity,
                "addressRegion": property.addressState,
                "postalCode": property.addressZip,
                "addressCountry": "US",
              },
              "numberOfRooms": property.beds,
              "floorSize": {
                "@type": "QuantitativeValue",
                "value": property.sqft,
                "unitCode": "FTK",
              },
            })
          }}
        />
      )}
      {showAuthPrompt && (
        <AuthPromptModal feature="favorite" onClose={() => setShowAuthPrompt(false)} />
      )}

      {showAskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-ask-question">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold text-lg">Ask a Question</h3>
              <button onClick={() => setShowAskModal(false)} className="p-1.5 hover:bg-muted rounded-lg" data-testid="button-close-ask">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">About: {property.title}</p>
              <textarea
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                placeholder="What would you like to know about this property?"
                rows={4}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-question"
              />
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button onClick={() => setShowAskModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground">Cancel</button>
              <button
                onClick={() => askMutation.mutate({ message: questionText, propertyId: property.id })}
                disabled={!questionText.trim() || askMutation.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                data-testid="button-send-question"
              >
                {askMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {showShowingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-request-showing">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold text-lg">Request a Showing</h3>
              <button onClick={() => setShowShowingModal(false)} className="p-1.5 hover:bg-muted rounded-lg" data-testid="button-close-showing">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">Property: {property.title}</p>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Preferred Dates</label>
                {showingDates.map((date, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="date"
                      value={date}
                      onChange={e => {
                        const newDates = [...showingDates];
                        newDates[i] = e.target.value;
                        setShowingDates(newDates);
                      }}
                      className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid={`input-showing-date-${i}`}
                    />
                    {showingDates.length > 1 && (
                      <button
                        onClick={() => setShowingDates(showingDates.filter((_, j) => j !== i))}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {showingDates.length < 3 && (
                  <button
                    onClick={() => setShowingDates([...showingDates, ""])}
                    className="text-xs font-bold text-primary hover:text-primary/80"
                    data-testid="button-add-date"
                  >
                    + Add another date
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Notes (optional)</label>
                <textarea
                  value={showingNotes}
                  onChange={e => setShowingNotes(e.target.value)}
                  placeholder="Any special requests or notes..."
                  rows={2}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="input-showing-notes"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button onClick={() => setShowShowingModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground">Cancel</button>
              <button
                onClick={() => showingMutation.mutate({ propertyId: property.id, dates: showingDates, notes: showingNotes })}
                disabled={!showingDates.some(d => !!d) || showingMutation.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                data-testid="button-submit-showing"
              >
                {showingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                Request Showing
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequestInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-request-info">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold text-lg">Request More Info</h3>
              <button onClick={() => setShowRequestInfoModal(false)} className="p-1.5 hover:bg-muted rounded-lg" data-testid="button-close-request-info">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">Select what you'd like to know about {property.title}:</p>
              <div className="space-y-2">
                {[
                  { key: "disclosures", label: "Property disclosures" },
                  { key: "hoaDetails", label: "HOA details & fees" },
                  { key: "additionalPhotos", label: "Additional photos" },
                  { key: "floorPlan", label: "Floor plan" },
                  { key: "priceHistory", label: "Price history" },
                  { key: "neighborhoodInfo", label: "Neighborhood info" },
                  { key: "inspectionReports", label: "Inspection reports" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer" data-testid={`checkbox-${key}`}>
                    <input
                      type="checkbox"
                      checked={requestInfoChecks[key as keyof typeof requestInfoChecks]}
                      onChange={e => setRequestInfoChecks(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Additional notes (optional)</label>
                <textarea
                  value={requestInfoNote}
                  onChange={e => setRequestInfoNote(e.target.value)}
                  placeholder="Any specific questions or details..."
                  rows={2}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="input-request-info-note"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button onClick={() => setShowRequestInfoModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground">Cancel</button>
              <button
                onClick={() => requestInfoMutation.mutate(property.id)}
                disabled={!Object.values(requestInfoChecks).some(v => v) || requestInfoMutation.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                data-testid="button-submit-request-info"
              >
                {requestInfoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="min-h-screen bg-background pb-24 md:pb-20 relative">

      {prevListing && (
        <button
          onClick={() => navigate(`/property/${prevListing.id}`)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 group hidden md:block"
          aria-label={`Previous listing: ${prevListing.title}`}
          data-testid="button-prev-listing"
        >
          <div className="flex items-center bg-white dark:bg-zinc-900 shadow-xl border border-border rounded-r-2xl pl-2 pr-3 py-4 hover:pr-5 transition-all group-hover:shadow-2xl">
            <ChevronLeft className="w-5 h-5 text-foreground" />
            <div className="hidden group-hover:block ml-2 max-w-[180px]">
              <p className="text-xs font-semibold text-foreground truncate">${prevListing.price.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground truncate">{prevListing.title}</p>
            </div>
          </div>
        </button>
      )}
      {nextListing && (
        <button
          onClick={() => navigate(`/property/${nextListing.id}`)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 group hidden md:block"
          aria-label={`Next listing: ${nextListing.title}`}
          data-testid="button-next-listing"
        >
          <div className="flex items-center bg-white dark:bg-zinc-900 shadow-xl border border-border rounded-l-2xl pr-2 pl-3 py-4 hover:pl-5 transition-all group-hover:shadow-2xl">
            <div className="hidden group-hover:block mr-2 max-w-[180px] text-right">
              <p className="text-xs font-semibold text-foreground truncate">${nextListing.price.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground truncate">{nextListing.title}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
        </button>
      )}

      <InlinePhotoGallery photos={photos} title={property.title} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-10">
        <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-10 shadow-2xl border border-border">

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-border pb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 rounded-full font-bold text-xs ${
                  property.status === 'active' ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {property.status === 'active' ? 'For Sale' : (property.status || 'active').toUpperCase()}
                </span>
                {property.isOffMarket && (
                  <span className="bg-foreground text-background px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-yellow-400" />
                    Buy it Now
                  </span>
                )}
              </div>
              <h1 data-tour="property-detail-header" className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground mb-3">
                ${property.price.toLocaleString()}
              </h1>
              <div className="flex items-center text-muted-foreground font-medium text-sm sm:text-lg gap-2">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="break-words">{property.title} · {property.location}</span>
              </div>
              <div className="flex items-center gap-3 sm:gap-5 mt-3 text-sm font-semibold text-foreground flex-wrap">
                <span>{property.beds} Beds</span>
                <span className="text-muted-foreground">|</span>
                <span>{property.baths} Baths</span>
                <span className="text-muted-foreground">|</span>
                <span>{(property.sqft || 0).toLocaleString()} Sq Ft</span>
                {property.lotSize && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span>{property.lotSize.toLocaleString()} Lot Sq Ft</span>
                  </>
                )}
                {property.propertyType && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span>{property.propertyType}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="flex items-center gap-2 flex-wrap justify-start md:justify-end">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  aria-pressed={isSaved}
                  data-testid="button-save-property"
                  className={`flex items-center gap-2 px-5 py-3 sm:px-8 sm:py-4 rounded-full font-bold text-base sm:text-lg transition-all shadow-lg active:scale-95 ${
                    isSaved 
                      ? "bg-primary text-white hover:bg-primary/90 hover:shadow-primary/30" 
                      : "bg-muted text-foreground hover:bg-muted/80 border border-border"
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} aria-hidden="true" />
                  {isSaved ? "Saved" : "Save Home"}
                </button>
                <button
                  onClick={handleShare}
                  data-testid="button-share-property"
                  className="relative flex items-center gap-2 px-4 py-3 sm:px-5 sm:py-4 rounded-full font-semibold text-sm bg-muted text-foreground hover:bg-muted/80 border border-border transition-all active:scale-95"
                >
                  {showCopied ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
                      <span className="hidden sm:inline">Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Share</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handlePrint}
                  data-testid="button-print-property"
                  className="hidden sm:flex items-center gap-2 px-5 py-4 rounded-full font-semibold text-sm bg-muted text-foreground hover:bg-muted/80 border border-border transition-all active:scale-95"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  Print
                </button>
              </div>
              {daysOnMarket !== null && (
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5" data-testid="text-days-on-market">
                  <Clock className="w-3.5 h-3.5" />
                  {daysOnMarket} {daysOnMarket === 1 ? "day" : "days"} on market
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 mb-8 sm:mb-12">
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-2xl border border-border">
              <BedDouble className="w-6 h-6 text-primary mb-1.5" />
              <span className="text-xl font-bold">{property.beds}</span>
              <span className="text-xs font-medium text-muted-foreground">Beds</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-2xl border border-border">
              <Bath className="w-6 h-6 text-primary mb-1.5" />
              <span className="text-xl font-bold">{property.baths}</span>
              <span className="text-xs font-medium text-muted-foreground">Baths</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-2xl border border-border">
              <Maximize className="w-6 h-6 text-primary mb-1.5" />
              <span className="text-xl font-bold">{(property.sqft || 0).toLocaleString()}</span>
              <span className="text-xs font-medium text-muted-foreground">Sq Ft</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-2xl border border-border">
              <LandPlot className="w-6 h-6 text-primary mb-1.5" />
              <span className="text-xl font-bold">{property.lotSize ? property.lotSize.toLocaleString() : '—'}</span>
              <span className="text-xs font-medium text-muted-foreground">Lot Sq Ft</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-2xl border border-border">
              <Home className="w-6 h-6 text-primary mb-1.5" />
              <span className="text-lg font-bold">{property.propertyType || '—'}</span>
              <span className="text-xs font-medium text-muted-foreground">Type</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-2xl border border-border">
              <Building className="w-6 h-6 text-primary mb-1.5" />
              <span className="text-lg font-bold">
                {property.hoaFee ? `$${property.hoaFee}` : 'None'}
              </span>
              <span className="text-xs font-medium text-muted-foreground">HOA/mo</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <div className="md:col-span-2">
              <h2 className="text-xl sm:text-2xl font-display font-bold mb-4">About this home</h2>
              <div className="prose prose-lg text-muted-foreground max-w-none mb-8">
                {(property.description || 'No description available.').split('\n').map((paragraph, i) => (
                  <p key={i} className="mb-4 leading-relaxed">{paragraph}</p>
                ))}
              </div>

              {(listingAgentName || listingBrokerage) && (
                <div className="flex items-center gap-3 pt-6 border-t border-border" data-testid="detail-listing-attribution">
                  <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center border border-border overflow-hidden flex-shrink-0">
                    {listingAgentImage ? (
                      <img src={listingAgentImage} alt={listingAgentName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {(listingAgentName[0] || "A").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Listed by <span className="font-medium text-foreground/80">{listingAgentName || "Agent"}</span>
                      {listingBrokerage && <> · {listingBrokerage}</>}
                    </p>
                    {(listingAgentEmail || listingAgentPhone) && (
                      <p className="text-xs text-muted-foreground">
                        {listingAgentPhone && <span>{formatPhone(listingAgentPhone)}</span>}
                        {listingAgentPhone && listingAgentEmail && <span> · </span>}
                        {listingAgentEmail && (
                          <a href={`mailto:${listingAgentEmail}`} className="text-primary/70 hover:text-primary hover:underline">{listingAgentEmail}</a>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <ContactCard
                contactName={contactName}
                contactPhone={contactPhone}
                contactEmail={contactEmail}
                contactTitle={contactTitle}
                contactBrokerage={contactBrokerage}
                contactImage={contactImage}
                propertyAddress={propertyAddress}
                propertyId={property.id}
                onAskQuestion={handleAskQuestion}
                onRequestShowing={handleRequestShowing}
                onRequestInfo={handleRequestInfo}
              />

              <SectionErrorBoundary name="MapView">
                <div className="mt-8 bg-muted rounded-2xl sm:rounded-3xl border border-border overflow-hidden h-48 sm:h-64">
                  <MapView
                    properties={[property]}
                    center={
                      property.lat && property.lng
                        ? [parseFloat(property.lng as string), parseFloat(property.lat as string)]
                        : [-122.4194, 37.7749]
                    }
                    zoom={15}
                  />
                </div>
              </SectionErrorBoundary>
            </div>
          </div>

          {property.virtualTourUrl && (
            <SectionErrorBoundary name="VirtualTourSection">
              <VirtualTourSection url={property.virtualTourUrl} />
            </SectionErrorBoundary>
          )}

          <SectionErrorBoundary name="AgentMLSPanel">
            <SpotlightTour pageKey="property" isAuthenticated={isAuthenticated} />
            <div data-tour="agent-mls-panel" className="contents" />
            <AgentMLSPanel propertyId={property.id} isAgent={!!(user?.role === 'agent' && user?.agentVerified)} />
          </SectionErrorBoundary>

          <SectionErrorBoundary name="SchoolsSection">
            <SchoolsSection propertyId={property.id} />
          </SectionErrorBoundary>

          <SectionErrorBoundary name="NeighborhoodSection">
            <NeighborhoodSection propertyId={property.id} />
          </SectionErrorBoundary>

          <SectionErrorBoundary name="MortgageCalculator">
            <MortgageCalculator price={property.price} hoaFee={property.hoaFee} />
          </SectionErrorBoundary>

          <SectionErrorBoundary name="PropertyReviewSection">
            <PropertyReviewSection
              propertyId={property.id}
              isListingAgent={!!(user && property.agentId && property.agentId === (user as any).id)}
              isAdmin={!!(user && (user as any)?.isAdmin)}
            />
          </SectionErrorBoundary>

          <SectionErrorBoundary name="PriceHistorySection">
            <PriceHistorySection property={property} daysOnMarket={daysOnMarket} />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="ListingActivitySection">
            <ListingActivitySection property={property} daysOnMarket={daysOnMarket} />
          </SectionErrorBoundary>

          <SectionErrorBoundary name="SimilarHomesSection">
            <SimilarHomesSection propertyId={property.id} />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="SoldNearbySection">
            <SoldNearbySection propertyId={property.id} />
          </SectionErrorBoundary>

          <SectionErrorBoundary name="ZoningPanel">
            <ZoningPanel propertyId={property.id} />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="PublicRecordsPanel">
            <PublicRecordsPanel propertyId={property.id} />
          </SectionErrorBoundary>
          <SdmlsDisclaimer />
        </div>
      </div>

      <MobileContactBar
        contactName={contactName}
        contactPhone={contactPhone}
        contactEmail={contactEmail}
        propertyAddress={propertyAddress}
        onAskQuestion={handleAskQuestion}
        onRequestShowing={handleRequestShowing}
        onRequestInfo={handleRequestInfo}
      />
    </div>
    </>
  );
}
