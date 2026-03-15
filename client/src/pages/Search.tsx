import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { PropertyCard } from "@/components/PropertyCard";
import { useProperties } from "@/hooks/use-properties";
import { useCreateSavedSearch } from "@/hooks/use-saved";
import { useAddSearchHistory } from "@/hooks/use-client-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { Search as SearchIcon, MapPin, Map, BookmarkPlus, X, Check, SlidersHorizontal, ChevronDown, BedDouble, Bath, Maximize, Heart } from "lucide-react";
import { MapView } from "@/components/MapView";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import queryString from "query-string";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import { SdmlsDisclaimer } from "@/components/SdmlsDisclaimer";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import type { Property } from "@shared/schema";

function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    const m = price / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  return `$${price.toLocaleString()}`;
}

export default function Search() {
  const [location, setNavigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);

  const cityParam = searchParams.get("city") || "";
  const countyParam = searchParams.get("county") || "";
  const locationParam = searchParams.get("location") || "";
  const initialLocationLabel = cityParam ? `${cityParam}, CA` : countyParam ? `${countyParam}, CA` : locationParam;
  const [locationInput, setLocationInput] = useState(initialLocationLabel);
  const [cityFilter, setCityFilter] = useState(cityParam);
  const [countyFilter, setCountyFilter] = useState(countyParam);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("city") || "";
    const co = sp.get("county") || "";
    const loc = sp.get("location") || "";
    setCityFilter(c);
    setCountyFilter(co);
    setLocationInput(c ? `${c}, CA` : co ? `${co}, CA` : loc);
  }, [location]);

  const [filters, setFilters] = useState({
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    beds: searchParams.get("beds") || "",
    baths: searchParams.get("baths") || "",
    propertyType: searchParams.get("propertyType") || "",
    isOffMarket: searchParams.get("isOffMarket") || "",
    status: searchParams.get("status") || "",
    sort: searchParams.get("sort") || "",
  });

  const [activeQuery, setActiveQuery] = useState<Record<string, any>>({});
  const [mapCenter, setMapCenter] = useState<[number, number]>([-122.4194, 37.7749]);
  const [mapZoom, setMapZoom] = useState(12);
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">("split");
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);
  const [highlightedPropertyId, setHighlightedPropertyId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { isLoaded } = useGoogleMaps();

  useEffect(() => {
    if (!isLoaded || !locationInput || locationInput.length < 3) return;
    const timer = setTimeout(() => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: locationInput, componentRestrictions: { country: 'us' } }, (results, status) => {
        if (status === 'OK' && results && results[0]?.geometry?.location) {
          const lat = results[0].geometry.location.lat();
          const lng = results[0].geometry.location.lng();
          setMapCenter([lng, lat]);
          setMapZoom(14);
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [isLoaded, locationInput]);

  useEffect(() => {
    const query: Record<string, any> = {};
    if (cityFilter) {
      query.city = cityFilter;
    } else if (countyFilter) {
      query.county = countyFilter;
    } else if (locationInput) {
      query.location = locationInput;
    }
    if (filters.minPrice) query.minPrice = Number(filters.minPrice);
    if (filters.maxPrice) query.maxPrice = Number(filters.maxPrice);
    if (filters.beds) query.minBeds = Number(filters.beds);
    if (filters.baths) query.minBaths = Number(filters.baths);
    if (filters.propertyType) query.propertyType = filters.propertyType;
    if (filters.isOffMarket) query.isOffMarket = filters.isOffMarket;
    if (filters.status) query.status = filters.status;
    if (filters.sort) query.sort = filters.sort;
    setActiveQuery(query);

    const mapFlag = searchParams.get("map");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (mapFlag === "true" && lat && lng) {
      setMapCenter([Number(lng), Number(lat)]);
      setMapZoom(14);
    }
  }, [locationInput, cityFilter, countyFilter, filters]);

  const [page, setPage] = useState(0);
  const activeQueryKey = JSON.stringify(activeQuery);
  useEffect(() => { setPage(0); }, [activeQueryKey]);
  const { data: propertiesData, isLoading } = useProperties({ ...activeQuery, limit: 50, offset: page * 50 });
  const properties = propertiesData?.properties || [];
  const totalProperties = propertiesData?.total || 0;
  const { mutate: saveSearch, isPending: isSavingSearch } = useCreateSavedSearch();
  const { isAuthenticated } = useAuth();
  const { mutate: addHistory } = useAddSearchHistory();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showSaveNameInput, setShowSaveNameInput] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !locationInput || locationInput.length < 3) return;
    const timer = setTimeout(() => {
      addHistory({ query: locationInput, criteria: activeQuery });
    }, 2000);
    return () => clearTimeout(timer);
  }, [locationInput, isAuthenticated]);

  const handleSaveSearch = () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    const defaultName = locationInput ? `Search in ${locationInput}` : "General Search";
    setSaveSearchName(defaultName);
    setShowSaveNameInput(true);
  };

  const confirmSaveSearch = () => {
    const name = saveSearchName.trim() || (locationInput ? `Search in ${locationInput}` : "General Search");
    saveSearch({ name, criteria: activeQuery });
    setShowSaveNameInput(false);
    setSaveSearchName("");
  };

  useEffect(() => {
    if (!properties?.length) return;
    const geoProps = properties.filter(p => p.lat && p.lng);
    if (geoProps.length === 0) return;

    const lats = geoProps.map(p => parseFloat(p.lat as string));
    const lngs = geoProps.map(p => parseFloat(p.lng as string));
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    const mapFlag = searchParams.get("map");
    if (!mapFlag) {
      setMapCenter([midLng, midLat]);
    }
  }, [properties]);

  const handleCardHover = useCallback((property: Property | null) => {
    setHoveredProperty(property);
    setHighlightedPropertyId(property?.id || null);
  }, []);

  const handleMarkerHover = useCallback((property: Property | null) => {
    setHoveredProperty(property);
    setHighlightedPropertyId(property?.id || null);
  }, []);

  const showMap = viewMode === "split" || viewMode === "map";
  const showList = viewMode === "split" || viewMode === "list";

  return (
    <>
      {showAuthPrompt && (
        <AuthPromptModal feature="save-search" onClose={() => setShowAuthPrompt(false)} />
      )}
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      <div className="bg-card border-b border-border px-3 py-2.5 z-10 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-md">
            <AddressAutocomplete
              variant="inline"
              placeholder="Search by address, city, ZIP..."
              defaultValue={locationInput}
              inputRef={inputRef}
              onSelect={(property) => {
                setLocationInput(property.title);
                setNavigate(`/property/${property.id}`);
              }}
              onSearch={(q) => {
                setLocationInput(q);
                setCityFilter("");
                setCountyFilter("");
              }}
            />
          </div>

          <select
            className="bg-background border border-border rounded-md px-2.5 py-1.5 font-medium text-xs outline-none focus:border-primary transition-colors"
            value={filters.minPrice}
            onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
            data-testid="select-min-price"
            aria-label="Filter by minimum price"
          >
            <option value="">Min Price</option>
            <option value="100000">$100k+</option>
            <option value="200000">$200k+</option>
            <option value="300000">$300k+</option>
            <option value="500000">$500k+</option>
            <option value="750000">$750k+</option>
            <option value="1000000">$1M+</option>
            <option value="1500000">$1.5M+</option>
            <option value="2000000">$2M+</option>
          </select>

          <select
            className="bg-background border border-border rounded-md px-2.5 py-1.5 font-medium text-xs outline-none focus:border-primary transition-colors"
            value={filters.maxPrice}
            onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
            data-testid="select-max-price"
            aria-label="Filter by maximum price"
          >
            <option value="">Max Price</option>
            <option value="300000">$300k</option>
            <option value="500000">$500k</option>
            <option value="750000">$750k</option>
            <option value="1000000">$1M</option>
            <option value="1500000">$1.5M</option>
            <option value="2000000">$2M</option>
            <option value="3000000">$3M</option>
            <option value="5000000">$5M</option>
          </select>

          <select
            className="bg-background border border-border rounded-md px-2.5 py-1.5 font-medium text-xs outline-none focus:border-primary transition-colors"
            value={filters.beds}
            onChange={(e) => setFilters(prev => ({ ...prev, beds: e.target.value }))}
            data-testid="select-beds"
            aria-label="Filter by bedrooms"
          >
            <option value="">Beds</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
          </select>

          <select
            className="bg-background border border-border rounded-md px-2.5 py-1.5 font-medium text-xs outline-none focus:border-primary transition-colors"
            value={filters.baths}
            onChange={(e) => setFilters(prev => ({ ...prev, baths: e.target.value }))}
            data-testid="select-baths"
            aria-label="Filter by bathrooms"
          >
            <option value="">Baths</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>

          <select
            className="bg-background border border-border rounded-md px-2.5 py-1.5 font-medium text-xs outline-none focus:border-primary transition-colors"
            value={filters.propertyType}
            onChange={(e) => setFilters(prev => ({ ...prev, propertyType: e.target.value }))}
            data-testid="select-property-type"
            aria-label="Filter by property type"
          >
            <option value="">Type</option>
            <option value="Single Family">House</option>
            <option value="Condo">Condo</option>
            <option value="Townhouse,Townhome">Townhome</option>
            <option value="Multi-Family">Multi-Family</option>
            <option value="Land">Land</option>
          </select>

          <select
            className="bg-background border border-border rounded-md px-2.5 py-1.5 font-medium text-xs outline-none focus:border-primary transition-colors"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            data-testid="select-status"
            aria-label="Filter by status"
          >
            <option value="">Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="sold">Sold</option>
          </select>

          <select
            className="bg-background border border-border rounded-md px-2.5 py-1.5 font-medium text-xs outline-none focus:border-primary transition-colors"
            value={filters.isOffMarket}
            onChange={(e) => setFilters(prev => ({ ...prev, isOffMarket: e.target.value }))}
            data-testid="select-listing-type"
            aria-label="Filter by listing type"
          >
            <option value="">All Types</option>
            <option value="false">MLS</option>
            <option value="true">Buy it Now</option>
          </select>

          <select
            className="bg-background border border-border rounded-md px-2.5 py-1.5 font-medium text-xs outline-none focus:border-primary transition-colors"
            value={filters.sort}
            onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
            data-testid="select-sort"
            aria-label="Sort results"
          >
            <option value="">Newest</option>
            <option value="price_asc">Price: Low</option>
            <option value="price_desc">Price: High</option>
            <option value="sqft_desc">Sqft</option>
          </select>

          {showSaveNameInput ? (
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-md px-2.5 py-1 shadow-md">
              <input
                className="text-xs bg-transparent outline-none w-32 placeholder-muted-foreground text-foreground"
                placeholder="Name your search..."
                value={saveSearchName}
                onChange={e => setSaveSearchName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") confirmSaveSearch();
                  if (e.key === "Escape") { setShowSaveNameInput(false); setSaveSearchName(""); }
                }}
                autoFocus
                data-testid="input-save-search-name"
              />
              <button onClick={confirmSaveSearch} disabled={isSavingSearch} className="p-0.5 text-green-600 hover:text-green-700 disabled:opacity-40" data-testid="button-confirm-save-search">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setShowSaveNameInput(false); setSaveSearchName(""); }} className="p-0.5 text-muted-foreground hover:text-foreground" data-testid="button-cancel-save-search">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSaveSearch}
              disabled={isSavingSearch}
              className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1.5 rounded-md font-bold text-xs transition-colors hover:bg-primary/20"
              data-testid="button-save-search"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save</span>
            </button>
          )}

          <div className="flex items-center border border-border rounded-md overflow-hidden ml-auto">
            <button
              onClick={() => setViewMode("split")}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "split" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              data-testid="button-view-split"
            >
              Split
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors border-x border-border ${viewMode === "list" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              data-testid="button-view-list"
            >
              List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "map" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              data-testid="button-view-map"
            >
              Map
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showMap && (
          <div className={`flex flex-col ${showList ? 'hidden lg:flex lg:w-1/2 xl:w-[55%]' : 'w-full'} h-full border-r border-border`}>
            <div className="flex-1 relative">
              <MapView
                properties={properties || []}
                center={mapCenter}
                zoom={mapZoom}
                highlightedPropertyId={highlightedPropertyId}
                onMarkerHover={handleMarkerHover}
              />
            </div>

            {hoveredProperty && (
              <div className="border-t border-border bg-card px-4 py-3 animate-in slide-in-from-bottom-2 duration-200" data-testid="hover-preview-panel">
                <div className="flex gap-3">
                  <img
                    src={hoveredProperty.imageUrl || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop"}
                    alt={hoveredProperty.title}
                    className="w-28 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-primary text-base" data-testid="preview-price">{formatPrice(hoveredProperty.price)}</p>
                    <p className="text-sm font-medium text-foreground truncate" data-testid="preview-address">{hoveredProperty.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{hoveredProperty.location || `${hoveredProperty.addressCity}, ${hoveredProperty.addressState}`}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {hoveredProperty.beds && (
                        <span className="flex items-center gap-1"><BedDouble className="w-3 h-3" />{hoveredProperty.beds} bd</span>
                      )}
                      {hoveredProperty.baths && (
                        <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{hoveredProperty.baths} ba</span>
                      )}
                      {hoveredProperty.sqft && hoveredProperty.sqft > 0 && (
                        <span className="flex items-center gap-1"><Maximize className="w-3 h-3" />{hoveredProperty.sqft.toLocaleString()} sqft</span>
                      )}
                      {hoveredProperty.propertyType && (
                        <span className="text-muted-foreground/70">{hoveredProperty.propertyType}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setNavigate(`/property/${hoveredProperty.id}`)}
                    className="self-center px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0"
                    data-testid="preview-view-button"
                  >
                    View
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showList && (
          <div ref={listRef} className={`${showMap ? 'w-full lg:w-1/2 xl:w-[45%]' : 'w-full'} h-full overflow-y-auto bg-background`}>
            <div className="px-3 py-2.5 border-b border-border bg-card/50 sticky top-0 z-[5]">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-sm text-foreground" data-testid="text-results-count">
                  {isLoading ? (
                    <span className="inline-block h-4 w-20 bg-muted animate-pulse rounded-md align-middle" />
                  ) : `${totalProperties.toLocaleString()} homes`}
                </h2>
                {totalProperties > 50 && (
                  <span className="text-xs text-muted-foreground" data-testid="text-page-info">
                    Page {page + 1} of {Math.ceil(totalProperties / 50)}
                  </span>
                )}
              </div>
            </div>

            <div className="p-2">
              {isLoading ? (
                <div className="space-y-2">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="flex gap-3 p-2 rounded-lg border border-border bg-card animate-pulse" data-testid={`skeleton-property-card-${i}`}>
                      <div className="w-32 h-24 bg-muted rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-muted rounded w-24" />
                        <div className="h-3 bg-muted rounded w-full" />
                        <div className="flex gap-3">
                          <div className="h-3 bg-muted rounded w-12" />
                          <div className="h-3 bg-muted rounded w-12" />
                          <div className="h-3 bg-muted rounded w-16" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : properties?.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-xl mt-4">
                  <MapPin className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
                  <h3 className="font-display font-bold text-base text-foreground mb-1">No exact matches</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">Try changing or removing some filters.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {properties?.map(property => (
                    <CompactPropertyCard
                      key={property.id}
                      property={property}
                      isHighlighted={highlightedPropertyId === property.id}
                      onHover={handleCardHover}
                    />
                  ))}
                </div>
              )}

              {totalProperties > 50 && (
                <div className="flex items-center justify-center gap-3 py-4" data-testid="pagination-controls">
                  <button
                    onClick={() => { setPage(p => Math.max(0, p - 1)); listRef.current?.scrollTo(0, 0); }}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary hover:text-white transition-colors"
                    data-testid="button-prev-page"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground font-medium" data-testid="text-page-info-bottom">
                    Page {page + 1} of {Math.ceil(totalProperties / 50)}
                  </span>
                  <button
                    onClick={() => { setPage(p => p + 1); listRef.current?.scrollTo(0, 0); }}
                    disabled={(page + 1) * 50 >= totalProperties}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary hover:text-white transition-colors"
                    data-testid="button-next-page"
                  >
                    Next
                  </button>
                </div>
              )}

              <div className="px-1 pb-3">
                <SdmlsDisclaimer />
              </div>
            </div>
          </div>
        )}

        {viewMode === "map" && !showList && (
          <div className="hidden" />
        )}
      </div>
    </div>
    </>
  );
}

const FALLBACK = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop";

function CompactPropertyCard({ property, isHighlighted, onHover }: {
  property: any;
  isHighlighted: boolean;
  onHover: (property: any | null) => void;
}) {
  const [, navigate] = useLocation();

  const photos: string[] = property.photos?.length > 0 ? property.photos : [property.imageUrl || FALLBACK];
  const mainPhoto = photos[0] || FALLBACK;

  const daysOnMarket = (() => {
    const ref = property.listDate ? new Date(property.listDate) : property.createdAt ? new Date(property.createdAt) : null;
    if (!ref || isNaN(ref.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - ref.getTime()) / (1000 * 60 * 60 * 24)));
  })();

  const isNew = daysOnMarket !== null && daysOnMarket <= 7;

  return (
    <div
      className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-all duration-150 border ${
        isHighlighted
          ? "border-primary bg-primary/5 shadow-md"
          : "border-transparent hover:border-border hover:bg-card hover:shadow-sm"
      }`}
      onMouseEnter={() => onHover(property)}
      onMouseLeave={() => onHover(null)}
      onClick={() => navigate(`/property/${property.id}`)}
      data-testid={`card-property-${property.id}`}
    >
      <div className="relative w-36 h-[100px] flex-shrink-0 rounded-lg overflow-hidden">
        <img
          src={mainPhoto}
          alt={property.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isNew && (
          <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            NEW
          </span>
        )}
        {photos.length > 1 && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
            1/{photos.length}
          </span>
        )}
        {property.isOffMarket && (
          <span className="absolute top-1.5 right-1.5 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
            OFF MKT
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-bold text-primary text-[15px] leading-tight" data-testid={`text-price-${property.id}`}>
          {formatPrice(property.price)}
          {property.hoaFee && (
            <span className="text-[10px] text-muted-foreground font-normal ml-1">+ ${property.hoaFee}/mo HOA</span>
          )}
        </p>
        <div className="flex items-center gap-2.5 mt-1 text-xs text-muted-foreground">
          {property.beds && (
            <span className="flex items-center gap-0.5 font-medium"><BedDouble className="w-3 h-3" />{property.beds} bd</span>
          )}
          {property.baths && (
            <span className="flex items-center gap-0.5 font-medium"><Bath className="w-3 h-3" />{property.baths} ba</span>
          )}
          {property.sqft && property.sqft > 0 && (
            <span className="flex items-center gap-0.5 font-medium"><Maximize className="w-3 h-3" />{property.sqft.toLocaleString()}</span>
          )}
          {property.lotSize && property.lotSize > 0 && (
            <span className="text-muted-foreground/60">{property.lotSize.toLocaleString()} lot</span>
          )}
        </div>
        <p className="text-xs text-foreground mt-1 truncate font-medium" data-testid={`text-address-${property.id}`}>
          {property.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] text-muted-foreground truncate">
            {property.propertyType && <span>{property.propertyType}</span>}
            {property.listingBrokerage && <span className="ml-1">- {property.listingBrokerage}</span>}
          </p>
          {daysOnMarket !== null && daysOnMarket > 0 && (
            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{daysOnMarket}d ago</span>
          )}
        </div>
      </div>
    </div>
  );
}
