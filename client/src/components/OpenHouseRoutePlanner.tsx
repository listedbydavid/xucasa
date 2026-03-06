import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import {
  CalendarDays,
  Home,
  MapPin,
  Navigation,
  ExternalLink,
  Copy,
  Check,
  Share2,
  X,
  Route,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OpenHouseProperty {
  id: number;
  title: string;
  location: string;
  price: number;
  imageUrl: string | null;
  lat: string | null;
  lng: string | null;
  openHouseDate: string | null;
  openHouseTime: string | null;
  addressStreetNumber?: string;
  addressStreetName?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getFullAddress(p: OpenHouseProperty): string {
  const street = p.addressStreetNumber && p.addressStreetName
    ? `${p.addressStreetNumber} ${p.addressStreetName}`
    : (p.title || "");

  const parts: string[] = [];
  if (street) parts.push(street);
  if (p.addressCity) parts.push(p.addressCity);
  if (p.addressState) parts.push(p.addressZip ? `${p.addressState} ${p.addressZip}` : p.addressState);
  else if (p.addressZip) parts.push(p.addressZip);

  if (parts.length >= 2) {
    return parts.join(", ");
  }

  if (street && p.location) {
    return `${street}, ${p.location}`;
  }

  return street || p.location || "";
}

function buildGoogleMapsUrl(selected: OpenHouseProperty[]): string {
  if (selected.length === 0) return "";

  if (selected.length === 1) {
    const p = selected[0];
    const addr = getFullAddress(p);
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
  }

  const destination = selected[selected.length - 1];
  const waypoints = selected.slice(0, -1);

  const destAddr = getFullAddress(destination);
  const waypointAddrs = waypoints.map(p => getFullAddress(p)).join("|");

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destAddr)}&waypoints=${encodeURIComponent(waypointAddrs)}&travelmode=driving`;
}

function buildAppleMapsUrl(selected: OpenHouseProperty[]): string {
  if (selected.length === 0) return "";
  const addresses = selected.map(p => getFullAddress(p));
  if (addresses.length === 1) {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(addresses[0])}`;
  }
  const daddr = addresses.join("+to:");
  return `https://maps.apple.com/?daddr=${encodeURIComponent(daddr)}`;
}

export function OpenHouseRoutePlanner({
  openHouses,
  isLoading,
  variant = "buyer",
}: {
  openHouses: OpenHouseProperty[];
  isLoading: boolean;
  variant?: "buyer" | "agent";
}) {
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<number[]>([]);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedOrder(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    if (selectedOrder.length === openHouses.length) {
      setSelectedOrder([]);
    } else {
      setSelectedOrder(openHouses.map(p => p.id));
    }
  }, [openHouses, selectedOrder.length]);

  const selectedHouses = useMemo(() => {
    const byId = new Map(openHouses.map(p => [p.id, p]));
    return selectedOrder.map(id => byId.get(id)).filter(Boolean) as OpenHouseProperty[];
  }, [openHouses, selectedOrder]);

  const googleMapsUrl = useMemo(() => buildGoogleMapsUrl(selectedHouses), [selectedHouses]);
  const appleMapsUrl = useMemo(() => buildAppleMapsUrl(selectedHouses), [selectedHouses]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(googleMapsUrl);
      setCopied(true);
      toast({ title: "Link copied", description: "Google Maps route link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  }, [googleMapsUrl, toast]);

  const handleShare = useCallback(async () => {
    const shareText = `Open House Route (${selectedHouses.length} stops):\n${selectedHouses.map((p, i) => `${i + 1}. ${p.title}`).join("\n")}\n\nRoute: ${googleMapsUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Open House Route — ${selectedHouses.length} stops`,
          text: shareText,
          url: googleMapsUrl,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  }, [selectedHouses, googleMapsUrl, handleCopyLink]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
            <div className="flex gap-4">
              <div className="w-32 flex-shrink-0 bg-muted h-28" />
              <div className="flex-1 p-4 space-y-3">
                <div className="h-5 bg-muted rounded-md w-48" />
                <div className="h-4 bg-muted rounded-md w-36" />
                <div className="h-5 bg-muted rounded-md w-28" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (openHouses.length === 0) {
    return (
      <div className="text-center py-16 bg-card border border-border rounded-3xl">
        <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="font-display font-bold text-xl mb-2">No upcoming open houses</h3>
        <p className="text-muted-foreground text-sm mb-6">
          {variant === "agent"
            ? "Set an open house date on any listing by editing it."
            : "Check back soon — agents will post open house dates here."}
        </p>
        {variant === "buyer" && (
          <Link href="/search" className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold hover:bg-primary hover:text-white transition-colors" data-testid="link-browse-listings">
            Browse Listings
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with select all */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Select open houses to plan your visiting route
          </p>
        </div>
        <button
          onClick={selectAll}
          className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/5"
          data-testid="button-select-all-open-houses"
        >
          {selectedOrder.length === openHouses.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* Open house cards with checkboxes */}
      <div className={`grid grid-cols-1 ${variant === "agent" ? "sm:grid-cols-2" : ""} gap-3`}>
        {openHouses.map((property) => {
          const isSelected = selectedSet.has(property.id);
          return (
            <div
              key={property.id}
              className={`bg-card border rounded-2xl overflow-hidden transition-all flex gap-3 cursor-pointer ${
                isSelected
                  ? "border-primary ring-2 ring-primary/20 shadow-md"
                  : "border-border hover:border-muted-foreground/30 hover:shadow-sm"
              }`}
              onClick={() => toggleSelect(property.id)}
              data-testid={`card-openhouse-selectable-${property.id}`}
            >
              {/* Checkbox area */}
              <div className="flex items-center pl-3">
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/40 hover:border-primary"
                  }`}
                  data-testid={`checkbox-openhouse-${property.id}`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
              </div>

              {/* Image */}
              <div className={`${variant === "agent" ? "w-24" : "w-32"} flex-shrink-0 bg-muted relative`}>
                {property.imageUrl ? (
                  <img src={property.imageUrl} alt={property.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center min-h-[88px]">
                    <Home className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute top-1.5 left-1.5 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  OPEN
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-3 min-w-0">
                <h3 className="font-bold text-foreground truncate text-sm">{property.title}</h3>
                <p className="text-xs text-muted-foreground truncate">{property.location}</p>
                <p className="font-bold text-foreground text-sm mt-1">${property.price?.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1.5 text-primary text-xs font-semibold">
                  <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {property.openHouseDate ? formatDate(property.openHouseDate) : ""}
                  </span>
                  {property.openHouseTime && (
                    <span className="text-muted-foreground font-normal">· {property.openHouseTime}</span>
                  )}
                </div>
              </div>

              {/* View listing link */}
              <div className="flex items-center pr-3">
                <Link
                  href={`/property/${property.id}`}
                  className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-colors"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  data-testid={`link-view-openhouse-${property.id}`}
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky route action bar */}
      {selectedOrder.length > 0 && (
        <div className="sticky bottom-4 z-40">
          <div className="bg-foreground text-background rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-white p-2 rounded-xl">
                <Route className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">
                  {selectedOrder.length} open house{selectedOrder.length !== 1 ? "s" : ""} selected
                </p>
                <p className="text-xs opacity-70">Ready to plan your route</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showRoutePanel ? (
                <button
                  onClick={() => setShowRoutePanel(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-background/10 transition-colors"
                  data-testid="button-hide-route"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              ) : (
                <button
                  onClick={() => setShowRoutePanel(true)}
                  className="flex items-center gap-1.5 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-lg"
                  data-testid="button-plan-route"
                >
                  <Navigation className="w-4 h-4" />
                  Plan Route
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Route planning panel */}
      {showRoutePanel && selectedHouses.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg" data-testid="panel-route-planner">
          <div className="p-5 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-primary" />
                <h3 className="font-display font-bold text-lg">Your Open House Route</h3>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {selectedHouses.length} stop{selectedHouses.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Stop list */}
          <div className="divide-y divide-border">
            {selectedHouses.map((property, idx) => (
              <div key={property.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {idx + 1}
                  </div>
                  {idx < selectedHouses.length - 1 && (
                    <div className="w-0.5 h-4 bg-border" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{property.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {property.openHouseDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(property.openHouseDate)}
                        {property.openHouseTime ? ` · ${property.openHouseTime}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleSelect(property.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                  data-testid={`button-remove-stop-${property.id}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Route preview map */}
          <div className="border-t border-border">
            {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
              <iframe
                src={`https://www.google.com/maps/embed/v1/directions?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&origin=${encodeURIComponent(getFullAddress(selectedHouses[0]))}&destination=${encodeURIComponent(getFullAddress(selectedHouses[selectedHouses.length - 1]))}${selectedHouses.length > 2 ? `&waypoints=${selectedHouses.slice(1, -1).map(p => encodeURIComponent(getFullAddress(p))).join("|")}` : ""}&mode=driving`}
                className="w-full h-64 sm:h-80"
                allowFullScreen
                loading="lazy"
                title="Open house route preview"
                data-testid="map-route-preview"
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center bg-muted text-muted-foreground text-sm">
                <MapPin className="w-5 h-5 mr-2" />
                Route preview unavailable — open in Google Maps to see directions
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-border bg-muted/30">
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-md text-sm"
                data-testid="button-open-google-maps"
              >
                <Navigation className="w-4 h-4" />
                Open in Google Maps
              </a>

              <a
                href={appleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background px-5 py-3 rounded-xl font-bold hover:bg-foreground/90 transition-all active:scale-95 shadow-md text-sm"
                data-testid="button-open-apple-maps"
              >
                <MapPin className="w-4 h-4" />
                Open in Apple Maps
              </a>

              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border border-border hover:bg-muted transition-colors text-sm"
                data-testid="button-copy-route-link"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>

              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border border-border hover:bg-muted transition-colors text-sm"
                data-testid="button-share-route"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-3">
              Opens directly in the Maps app on your phone. Save to your Google account from there.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
