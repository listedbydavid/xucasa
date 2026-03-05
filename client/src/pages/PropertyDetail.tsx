import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useProperty, useProperties } from "@/hooks/use-properties";
import { useSavedProperties, useToggleSavedProperty } from "@/hooks/use-saved";
import { BedDouble, Bath, Maximize, MapPin, Heart, Sparkles, Building, Briefcase, ChevronLeft, ChevronRight, Phone, Mail, MessageSquare, Camera } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { MapView } from "@/components/MapView";
import { PublicRecordsPanel } from "@/components/PublicRecordsPanel";
import { ZoningPanel } from "@/components/ZoningPanel";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import { SdmlsDisclaimer } from "@/components/SdmlsDisclaimer";

const FALLBACK = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=900&fit=crop";

const ADMIN_CONTACT = {
  name: "David Hussain",
  phone: "6198886283",
  email: "david@listedbydavid.com",
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
}: {
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactTitle?: string;
  contactBrokerage?: string;
  contactImage?: string | null;
  propertyAddress: string;
}) {
  const subject = encodeURIComponent(`Inquiry about ${propertyAddress}`);
  const body = encodeURIComponent(`Hi ${contactName.split(" ")[0]},\n\nI'm interested in learning more about the property at ${propertyAddress}.\n\nPlease get back to me at your earliest convenience.\n\nThank you!`);

  return (
    <div className="bg-muted p-6 rounded-3xl border border-border sticky top-24" data-testid="contact-card">
      <h3 className="font-display font-bold text-lg mb-4">Contact for this listing</h3>
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
    }, 2500);
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
      <div className="w-full h-[45vh] md:h-[58vh] flex gap-1 bg-black">
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

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: property, isLoading } = useProperty(Number(id));
  const { data: savedProps = [] } = useSavedProperties();
  const { mutate: toggleSave, isPending: isSaving } = useToggleSavedProperty();
  const { user, isAuthenticated } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const { data: agentLink } = useQuery<{ agentId: string; agentEmail: string; status: string } | null>({
    queryKey: ["/api/agent-invite"],
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
    return <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading property details"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true"></div><span className="sr-only">Loading property details</span></div>;
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

  const photos: string[] =
    property.photos && (property.photos as string[]).length > 0
      ? (property.photos as string[])
      : [property.imageUrl || FALLBACK];

  const listingAgentName = property.listingAgentName || (property.agent ? `${property.agent.firstName || ""} ${property.agent.lastName || ""}`.trim() : "");
  const listingBrokerage = property.listingBrokerage || property.agent?.brokerageName || "";
  const listingAgentEmail = property.listingAgentEmail || property.agent?.email || "";
  const listingAgentPhone = property.listingAgentPhone || "";
  const listingAgentImage = property.agent?.profileImageUrl || null;

  const userHasAgent = !!agentLink && agentLink.status === "active";
  const listingAgentHasContact = !!(listingAgentPhone || listingAgentEmail);
  const showListingAgent = userHasAgent && listingAgentHasContact;

  const contactName = showListingAgent ? listingAgentName || "Listing Agent" : ADMIN_CONTACT.name;
  const contactPhone = showListingAgent ? (listingAgentPhone || null) : ADMIN_CONTACT.phone;
  const contactEmail = showListingAgent ? (listingAgentEmail || null) : ADMIN_CONTACT.email;
  const contactTitle = showListingAgent ? "Listing Agent" : ADMIN_CONTACT.title;
  const contactBrokerage = showListingAgent ? listingBrokerage : ADMIN_CONTACT.brokerage;
  const contactImage = showListingAgent ? listingAgentImage : null;

  const propertyAddress = `${property.title}, ${property.location}`;

  return (
    <>
      {showAuthPrompt && (
        <AuthPromptModal feature="favorite" onClose={() => setShowAuthPrompt(false)} />
      )}
    <div className="min-h-screen bg-background pb-20 relative">

      {prevListing && (
        <button
          onClick={() => navigate(`/property/${prevListing.id}`)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 group"
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
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 group"
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
        <div className="bg-card rounded-3xl p-6 sm:p-10 shadow-2xl border border-border">

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-border pb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 rounded-full font-bold text-xs ${
                  property.status === 'active' ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {property.status === 'active' ? 'For Sale' : property.status.toUpperCase()}
                </span>
                {property.isOffMarket && (
                  <span className="bg-foreground text-background px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-yellow-400" />
                    Buy it Now
                  </span>
                )}
              </div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-3">
                ${property.price.toLocaleString()}
              </h1>
              <div className="flex items-center text-muted-foreground font-medium text-lg gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {property.title} · {property.location}
              </div>
              <div className="flex items-center gap-5 mt-3 text-sm font-semibold text-foreground">
                <span>{property.beds} Beds</span>
                <span className="text-muted-foreground">|</span>
                <span>{property.baths} Baths</span>
                <span className="text-muted-foreground">|</span>
                <span>{property.sqft.toLocaleString()} Sq Ft</span>
                {property.lotSize && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span>{property.lotSize.toLocaleString()} Lot Sq Ft</span>
                  </>
                )}
              </div>
            </div>
            
            <button 
              onClick={handleSave}
              disabled={isSaving}
              aria-pressed={isSaved}
              data-testid="button-save-property"
              className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg active:scale-95 ${
                isSaved 
                  ? "bg-primary text-white hover:bg-primary/90 hover:shadow-primary/30" 
                  : "bg-muted text-foreground hover:bg-muted/80 border border-border"
              }`}
            >
              <Heart className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} aria-hidden="true" />
              {isSaved ? "Saved" : "Save Home"}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-2xl border border-border">
              <BedDouble className="w-8 h-8 text-primary mb-2" />
              <span className="text-2xl font-bold">{property.beds}</span>
              <span className="text-sm font-medium text-muted-foreground">Beds</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-2xl border border-border">
              <Bath className="w-8 h-8 text-primary mb-2" />
              <span className="text-2xl font-bold">{property.baths}</span>
              <span className="text-sm font-medium text-muted-foreground">Baths</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-2xl border border-border">
              <Maximize className="w-8 h-8 text-primary mb-2" />
              <span className="text-2xl font-bold">{property.sqft.toLocaleString()}</span>
              <span className="text-sm font-medium text-muted-foreground">Sq Ft</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-2xl border border-border">
              <Building className="w-8 h-8 text-primary mb-2" />
              <span className="text-xl font-bold mt-1">
                {property.hoaFee ? `$${property.hoaFee}` : 'None'}
              </span>
              <span className="text-sm font-medium text-muted-foreground">HOA/mo</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="md:col-span-2">
              <h2 className="text-2xl font-display font-bold mb-4">About this home</h2>
              <div className="prose prose-lg text-muted-foreground max-w-none mb-8">
                {property.description.split('\n').map((paragraph, i) => (
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
              />

              <div className="mt-8 bg-muted rounded-3xl border border-border overflow-hidden h-64">
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
            </div>
          </div>

          <ZoningPanel propertyId={property.id} />
          <PublicRecordsPanel propertyId={property.id} />
          <SdmlsDisclaimer />
        </div>
      </div>
    </div>
    </>
  );
}
