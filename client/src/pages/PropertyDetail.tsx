import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useProperty } from "@/hooks/use-properties";
import { useSavedProperties, useToggleSavedProperty } from "@/hooks/use-saved";
import { BedDouble, Bath, Maximize, MapPin, Heart, Sparkles, Building, Briefcase, ChevronLeft, ChevronRight, X, Camera, Grid3X3 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { MapView } from "@/components/MapView";
import { PublicRecordsPanel } from "@/components/PublicRecordsPanel";
import { ZoningPanel } from "@/components/ZoningPanel";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import { SdmlsDisclaimer } from "@/components/SdmlsDisclaimer";

const FALLBACK = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=900&fit=crop";

function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const goNext = useCallback(() => {
    setLightboxIndex(prev => (prev + 1) % photos.length);
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex(prev => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, goNext, goPrev]);

  if (photos.length === 0) return null;

  const heroPhoto = photos[0];
  const sidePhotos = photos.slice(1, 5);
  const hasMore = photos.length > 5;

  return (
    <>
      <div
        className="w-full relative cursor-pointer"
        data-testid="photo-gallery"
      >
        {photos.length === 1 ? (
          <div className="w-full h-[50vh] md:h-[60vh]" onClick={() => openLightbox(0)}>
            <img
              src={heroPhoto}
              alt={`${title} - Main photo`}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-[40vh] md:h-[55vh] flex gap-1">
            <div className="flex-1 min-w-0 relative" onClick={() => openLightbox(0)}>
              <img
                src={heroPhoto}
                alt={`${title} - Main photo`}
                className="w-full h-full object-cover hover:brightness-90 transition-all"
              />
            </div>

            <div className={`hidden md:grid gap-1 w-[35%] ${sidePhotos.length <= 2 ? 'grid-rows-2' : 'grid-rows-2 grid-cols-2'}`}>
              {sidePhotos.map((photo, i) => (
                <div
                  key={i}
                  className="relative overflow-hidden"
                  onClick={() => openLightbox(i + 1)}
                >
                  <img
                    src={photo}
                    alt={`${title} - Photo ${i + 2}`}
                    className="w-full h-full object-cover hover:brightness-90 transition-all"
                    loading="lazy"
                  />
                  {i === sidePhotos.length - 1 && hasMore && (
                    <div
                      className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/50 transition-colors"
                      onClick={(e) => { e.stopPropagation(); openLightbox(5); }}
                    >
                      <span className="text-white font-bold text-lg">+{photos.length - 5} more</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          data-testid="button-view-all-photos"
          onClick={() => openLightbox(0)}
          className="absolute bottom-4 right-4 bg-white dark:bg-zinc-900 text-foreground px-4 py-2 rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2 border border-border"
        >
          <Camera className="w-4 h-4" />
          {photos.length} Photos
        </button>
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black flex flex-col"
          data-testid="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo gallery for ${title}`}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm">
            <span className="text-white font-medium text-sm">
              {lightboxIndex + 1} / {photos.length}
            </span>
            <h3 className="text-white font-semibold text-sm truncate max-w-[60%] hidden sm:block">
              {title}
            </h3>
            <button
              data-testid="button-close-lightbox"
              onClick={closeLightbox}
              className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close photo gallery"
              autoFocus
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div
            className="flex-1 relative flex items-center justify-center overflow-hidden"
            onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
          >
            <button
              onClick={goPrev}
              className="absolute left-2 sm:left-4 z-10 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
              aria-label="Previous photo"
              data-testid="lightbox-prev"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="w-full h-full flex items-center justify-center px-16">
              <img
                src={photos[lightboxIndex]}
                alt={`${title} - Photo ${lightboxIndex + 1}`}
                className="max-w-full max-h-full object-contain transition-opacity duration-200"
                data-testid={`lightbox-photo-${lightboxIndex}`}
              />
            </div>

            <button
              onClick={goNext}
              className="absolute right-2 sm:right-4 z-10 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
              aria-label="Next photo"
              data-testid="lightbox-next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-black/80 backdrop-blur-sm px-4 py-3 overflow-x-auto">
            <div className="flex items-center gap-2 justify-center">
              {photos.map((photo, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  aria-current={i === lightboxIndex ? "true" : undefined}
                  className={`flex-shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-all ${
                    i === lightboxIndex
                      ? "border-white opacity-100 scale-105"
                      : "border-transparent opacity-50 hover:opacity-80"
                  }`}
                >
                  <img
                    src={photo}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading } = useProperty(Number(id));
  const { data: savedProps = [] } = useSavedProperties();
  const { mutate: toggleSave, isPending: isSaving } = useToggleSavedProperty();
  const { isAuthenticated } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

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

  return (
    <>
      {showAuthPrompt && (
        <AuthPromptModal feature="favorite" onClose={() => setShowAuthPrompt(false)} />
      )}
    <div className="min-h-screen bg-background pb-20">
      <PhotoGallery photos={photos} title={property.title} />

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

          {(() => {
            const agentName = property.listingAgentName || (property.agent ? `${property.agent.firstName || ""} ${property.agent.lastName || ""}`.trim() : "");
            const brokerage = property.listingBrokerage || "";
            const contact = property.listingAgentEmail || property.listingAgentPhone || property.agent?.email || "";
            if (agentName || brokerage) {
              return (
                <div className="flex items-center gap-2 mb-8 px-1" data-testid="detail-listing-attribution">
                  <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Listed by <span className="font-medium text-foreground">{agentName || "Agent"}</span>
                    {brokerage && <> — <span className="font-medium text-foreground">{brokerage}</span></>}
                    {contact && <> · <a href={contact.includes("@") ? `mailto:${contact}` : `tel:${contact}`} className="text-primary hover:underline">{contact}</a></>}
                  </p>
                </div>
              );
            }
            return null;
          })()}

          <div className="grid md:grid-cols-3 gap-12">
            <div className="md:col-span-2">
              <h2 className="text-2xl font-display font-bold mb-4">About this home</h2>
              <div className="prose prose-lg text-muted-foreground max-w-none">
                {property.description.split('\n').map((paragraph, i) => (
                  <p key={i} className="mb-4 leading-relaxed">{paragraph}</p>
                ))}
              </div>
            </div>

            <div>
              <div className="bg-muted p-6 rounded-3xl border border-border sticky top-24">
                <h3 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Listing Agent
                </h3>
                {property.agent ? (
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-background rounded-full flex items-center justify-center border-2 border-primary overflow-hidden shadow-sm">
                      {property.agent.profileImageUrl ? (
                        <img src={property.agent.profileImageUrl} alt="Agent" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-primary">
                          {(property.agent.firstName?.[0] || 'A').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-lg">
                        {property.agent.firstName} {property.agent.lastName}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground">Realtor</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground mb-6 font-medium">Agent details unavailable.</p>
                )}
                <button className="w-full bg-foreground text-background py-3.5 rounded-xl font-bold hover:bg-primary transition-colors shadow-md hover:shadow-xl active:scale-95" data-testid="button-contact-agent">
                  Contact Agent
                </button>
              </div>

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
