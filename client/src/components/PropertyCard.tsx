import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { BedDouble, Bath, Maximize, Heart, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import type { PropertyResponse } from "@shared/schema";
import { useSavedProperties, useToggleSavedProperty } from "@/hooks/use-saved";
import { useAuth } from "@/hooks/use-auth";
import { AuthPromptModal } from "@/components/AuthPromptModal";

interface PropertyCardProps {
  property: PropertyResponse;
}

const FALLBACK = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop";

export function PropertyCard({ property }: PropertyCardProps) {
  const [, navigate] = useLocation();
  const { data: savedProps = [] } = useSavedProperties();
  const { mutate: toggleSave, isPending } = useToggleSavedProperty();
  const { isAuthenticated } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const hasDragged = useRef(false);

  const photos: string[] =
    property.photos && property.photos.length > 0
      ? (property.photos as string[])
      : [property.imageUrl || FALLBACK];

  const isSaved = savedProps.some((sp) => sp.propertyId === property.id);

  const goTo = (idx: number, e?: React.MouseEvent | React.PointerEvent) => {
    e?.stopPropagation();
    if (transitioning) return;
    const next = Math.max(0, Math.min(photos.length - 1, idx));
    if (next === photoIndex) return;
    setTransitioning(true);
    setPhotoIndex(next);
    setTimeout(() => setTransitioning(false), 300);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    toggleSave({ propertyId: property.id, isSaved });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    pointerStart.current = null;

    if (dist < 8) {
      // tap — navigate to property detail
      navigate(`/property/${property.id}`);
      return;
    }

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      hasDragged.current = true;
      if (dx < 0) goTo(photoIndex + 1);
      else goTo(photoIndex - 1);
    }
  };

  return (
    <>
      {showAuthPrompt && (
        <AuthPromptModal feature="favorite" onClose={() => setShowAuthPrompt(false)} />
      )}

      <div
        className="group block bg-card rounded-2xl overflow-hidden hover-card-effect border border-border cursor-pointer"
        data-testid={`card-property-${property.id}`}
      >
        {/* Image carousel area */}
        <div
          className="relative aspect-[4/3] overflow-hidden select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          {/* Sliding photo strip */}
          <div
            className="absolute inset-0 flex"
            style={{
              width: `${photos.length * 100}%`,
              transform: `translateX(-${(photoIndex / photos.length) * 100}%)`,
              transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {photos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${property.title} photo ${i + 1}`}
                draggable={false}
                className="object-cover h-full"
                style={{ width: `${100 / photos.length}%` }}
              />
            ))}
          </div>

          {/* Subtle dark gradient at top and bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

          {/* Left / right arrow buttons — desktop hover */}
          {photos.length > 1 && (
            <>
              <button
                data-testid={`btn-photo-prev-${property.id}`}
                onClick={(e) => goTo(photoIndex - 1, e)}
                aria-label="Previous photo"
                className={`absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 text-foreground shadow transition-all
                  opacity-0 group-hover:opacity-100 focus:opacity-100 ${photoIndex === 0 ? "invisible" : ""}`}
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                data-testid={`btn-photo-next-${property.id}`}
                onClick={(e) => goTo(photoIndex + 1, e)}
                aria-label="Next photo"
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 text-foreground shadow transition-all
                  opacity-0 group-hover:opacity-100 focus:opacity-100 ${photoIndex === photos.length - 1 ? "invisible" : ""}`}
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={`rounded-full transition-all duration-200 ${
                    i === photoIndex
                      ? "bg-white w-2 h-2"
                      : "bg-white/50 w-1.5 h-1.5"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Save button */}
          <div className="absolute top-4 right-4 pointer-events-auto">
            <button
              data-testid={`btn-save-${property.id}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleSave}
              disabled={isPending}
              aria-label={isSaved ? "Remove from saved properties" : "Save property"}
              aria-pressed={isSaved}
              className={`p-2.5 rounded-full backdrop-blur-md shadow-sm transition-all active:scale-95 ${
                isSaved
                  ? "bg-white text-primary"
                  : "bg-white/70 text-foreground hover:bg-white"
              }`}
            >
              <Heart className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} aria-hidden="true" />
            </button>
          </div>

          {/* Status badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
            {property.isOffMarket && (
              <span className="bg-foreground text-background text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                Buy it Now
              </span>
            )}
            {property.openHouseDate && new Date(property.openHouseDate) > new Date() && (
              <span className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-2xl flex items-center gap-1 shadow-lg leading-tight">
                🏠
                <span>
                  {new Date(property.openHouseDate).toLocaleDateString("en-US", { weekday: "short" })}
                  {property.openHouseTime && ` ${property.openHouseTime}`}
                </span>
              </span>
            )}
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ${
                property.isOffMarket
                  ? "bg-yellow-500/90 text-white"
                  : property.status === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {property.isOffMarket
                ? "Private Listing"
                : property.status === "active"
                ? "Active"
                : property.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div
          className="p-5 cursor-pointer"
          onClick={() => navigate(`/property/${property.id}`)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/property/${property.id}`); } }}
          role="link"
          tabIndex={0}
          aria-label={`View details for ${property.title || property.location}, $${property.price.toLocaleString()}`}
        >
          <div className="flex items-end gap-2 mb-2">
            <h3 className="font-display font-bold text-2xl tracking-tight text-foreground">
              ${property.price.toLocaleString()}
            </h3>
          </div>

          <div className="flex items-center gap-4 text-sm font-medium text-foreground mb-3">
            <span className="flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-muted-foreground" />
              {property.beds}{" "}
              <span className="text-muted-foreground font-normal">Beds</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Bath className="w-4 h-4 text-muted-foreground" />
              {property.baths}{" "}
              <span className="text-muted-foreground font-normal">Baths</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Maximize className="w-4 h-4 text-muted-foreground" />
              {property.sqft.toLocaleString()}{" "}
              <span className="text-muted-foreground font-normal">Sq Ft</span>
            </span>
          </div>

          <p className="text-muted-foreground text-sm font-medium truncate">
            {property.location}
          </p>

          {(() => {
            const agentName = property.listingAgentName || (property.agent ? `${property.agent.firstName || ""} ${property.agent.lastName || ""}`.trim() : "");
            const brokerage = property.listingBrokerage || "";
            const contact = property.listingAgentEmail || property.listingAgentPhone || property.agent?.email || "";
            if (agentName || brokerage) {
              return (
                <p className="text-xs text-muted-foreground mt-2 truncate" data-testid={`text-listing-attribution-${property.id}`}>
                  Listed by {agentName}{brokerage ? ` — ${brokerage}` : ""}{contact ? ` · ${contact}` : ""}
                </p>
              );
            }
            return null;
          })()}
        </div>
      </div>
    </>
  );
}
