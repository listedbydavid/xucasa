import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { PropertyCard } from "@/components/PropertyCard";
import { useProperties } from "@/hooks/use-properties";
import { useCreateSavedSearch } from "@/hooks/use-saved";
import { useAddSearchHistory } from "@/hooks/use-client-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { Search as SearchIcon, MapPin, Map, BookmarkPlus, X, Check, SlidersHorizontal, ChevronDown } from "lucide-react";
import { MapView } from "@/components/MapView";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import queryString from "query-string";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import { SdmlsDisclaimer } from "@/components/SdmlsDisclaimer";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

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
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [activeQuery, setActiveQuery] = useState<Record<string, any>>({});
  const [mapCenter, setMapCenter] = useState<[number, number]>([-122.4194, 37.7749]);
  const [mapZoom, setMapZoom] = useState(12);
  const [isMapVisible, setIsMapVisible] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  const { isLoaded } = useGoogleMaps();

  // Use Google Geocoder for map centering when location changes
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

  // Sync location input → activeQuery and mapCenter
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

    // Handle geolocation from map search button (Home page)
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

  // When properties load with real coordinates, auto-fit the map to show all markers
  useEffect(() => {
    if (!properties?.length) return;
    const geoProps = properties.filter(p => p.lat && p.lng);
    if (geoProps.length === 0) return;

    // If all properties are in one city and we haven't explicitly moved the map, center on them
    const lats = geoProps.map(p => parseFloat(p.lat as string));
    const lngs = geoProps.map(p => parseFloat(p.lng as string));
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    // Only auto-center if not triggered by geolocation (map flag)
    const mapFlag = searchParams.get("map");
    if (!mapFlag) {
      setMapCenter([midLng, midLat]);
    }
  }, [properties]);

  return (
    <>
      {showAuthPrompt && (
        <AuthPromptModal feature="save-search" onClose={() => setShowAuthPrompt(false)} />
      )}
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Search Header Bar */}
      <div className="bg-card border-b border-border p-4 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
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

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <select
              className="bg-background border border-border rounded-md px-3 py-2 font-medium text-sm outline-none focus:border-primary transition-colors min-w-0"
              value={filters.minPrice}
              onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
              data-testid="select-min-price"
              aria-label="Filter by minimum price"
            >
              <option value="">Min Price</option>
              <option value="100000">$100k+</option>
              <option value="200000">$200k+</option>
              <option value="300000">$300k+</option>
              <option value="400000">$400k+</option>
              <option value="500000">$500k+</option>
              <option value="750000">$750k+</option>
              <option value="1000000">$1M+</option>
              <option value="1500000">$1.5M+</option>
              <option value="2000000">$2M+</option>
            </select>

            <select
              className="bg-background border border-border rounded-md px-3 py-2 font-medium text-sm outline-none focus:border-primary transition-colors min-w-0"
              value={filters.maxPrice}
              onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
              data-testid="select-max-price"
              aria-label="Filter by maximum price"
            >
              <option value="">Max Price</option>
              <option value="200000">Up to $200k</option>
              <option value="300000">Up to $300k</option>
              <option value="400000">Up to $400k</option>
              <option value="500000">Up to $500k</option>
              <option value="750000">Up to $750k</option>
              <option value="1000000">Up to $1M</option>
              <option value="1500000">Up to $1.5M</option>
              <option value="2000000">Up to $2M</option>
              <option value="3000000">Up to $3M</option>
              <option value="5000000">Up to $5M</option>
            </select>

            <select
              className="bg-background border border-border rounded-md px-3 py-2 font-medium text-sm outline-none focus:border-primary transition-colors min-w-0"
              value={filters.beds}
              onChange={(e) => setFilters(prev => ({ ...prev, beds: e.target.value }))}
              data-testid="select-beds"
              aria-label="Filter by number of bedrooms"
            >
              <option value="">Beds</option>
              <option value="1">1+ Beds</option>
              <option value="2">2+ Beds</option>
              <option value="3">3+ Beds</option>
              <option value="4">4+ Beds</option>
              <option value="5">5+ Beds</option>
            </select>

            <select
              className="bg-background border border-border rounded-md px-3 py-2 font-medium text-sm outline-none focus:border-primary transition-colors min-w-0"
              value={filters.baths}
              onChange={(e) => setFilters(prev => ({ ...prev, baths: e.target.value }))}
              data-testid="select-baths"
              aria-label="Filter by number of bathrooms"
            >
              <option value="">Baths</option>
              <option value="1">1+ Baths</option>
              <option value="2">2+ Baths</option>
              <option value="3">3+ Baths</option>
              <option value="4">4+ Baths</option>
            </select>

            <select
              className="bg-background border border-border rounded-md px-3 py-2 font-medium text-sm outline-none focus:border-primary transition-colors min-w-0"
              value={filters.propertyType}
              onChange={(e) => setFilters(prev => ({ ...prev, propertyType: e.target.value }))}
              data-testid="select-property-type"
              aria-label="Filter by property type"
            >
              <option value="">Property Type</option>
              <option value="Single Family">House</option>
              <option value="Condo">Condo</option>
              <option value="Townhouse,Townhome">Townhome</option>
              <option value="Multi-Family">Multi-Family</option>
              <option value="Land">Land</option>
            </select>

            <select
              className="bg-background border border-border rounded-md px-3 py-2 font-medium text-sm outline-none focus:border-primary transition-colors min-w-0"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              data-testid="select-status"
              aria-label="Filter by listing status"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
            </select>

            <select
              className="bg-background border border-border rounded-md px-3 py-2 font-medium text-sm outline-none focus:border-primary transition-colors min-w-0"
              value={filters.isOffMarket}
              onChange={(e) => setFilters(prev => ({ ...prev, isOffMarket: e.target.value }))}
              data-testid="select-listing-type"
              aria-label="Filter by listing type"
            >
              <option value="">All Types</option>
              <option value="false">MLS Listed</option>
              <option value="true">Buy it Now</option>
            </select>

            {showSaveNameInput ? (
              <div className="flex items-center gap-1.5 bg-card border border-border rounded-md px-3 py-1.5 shadow-md">
                <input
                  className="text-sm bg-transparent outline-none w-36 lg:w-48 placeholder-muted-foreground text-foreground"
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
                <button
                  onClick={confirmSaveSearch}
                  disabled={isSavingSearch}
                  className="p-1 text-green-600 hover:text-green-700 disabled:opacity-40"
                  data-testid="button-confirm-save-search"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowSaveNameInput(false); setSaveSearchName(""); }}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  data-testid="button-cancel-save-search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSaveSearch}
                disabled={isSavingSearch}
                className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-md font-bold text-sm transition-colors hover-elevate"
                data-testid="button-save-search"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span className="hidden lg:inline">Save</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left List Pane */}
        <div className="w-full lg:w-3/5 xl:w-1/2 h-full overflow-y-auto bg-background">
          {/* Map Preview */}
          <div className={`relative transition-all duration-500 ease-in-out border-b border-border overflow-hidden ${isMapVisible ? 'h-64 sm:h-80' : 'h-0'}`}>
            <MapView properties={properties || []} center={mapCenter} zoom={mapZoom} />
            <button
              onClick={() => setIsMapVisible(false)}
              className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-lg border border-border hover:bg-white transition-colors z-[10]"
              data-testid="button-hide-map"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-4 flex-wrap">
                <h2 className="font-display font-bold text-xl text-foreground" data-testid="text-results-count">
                  {isLoading ? (
                    <span className="inline-block h-6 w-28 bg-muted animate-pulse rounded-md align-middle" />
                  ) : `${totalProperties.toLocaleString()} Homes`}
                </h2>
                {!isMapVisible && (
                  <button
                    onClick={() => setIsMapVisible(true)}
                    className="flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                    data-testid="button-show-map"
                  >
                    <Map className="w-4 h-4" />
                    Show Map
                  </button>
                )}
              </div>
              <select
                className="bg-background border border-border rounded-md px-3 py-2 font-medium text-sm outline-none focus:border-primary transition-colors"
                value={filters.sort}
                onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
                data-testid="select-sort"
                aria-label="Sort results"
              >
                <option value="">Sort: Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="sqft_desc">Sqft: Largest</option>
              </select>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse" data-testid={`skeleton-property-card-${i}`}>
                    <div className="aspect-[4/3] bg-muted" />
                    <div className="p-4 space-y-3">
                      <div className="h-6 bg-muted rounded-md w-32" />
                      <div className="h-4 bg-muted rounded-md w-full" />
                      <div className="flex items-center gap-3">
                        <div className="h-4 bg-muted rounded-md w-16" />
                        <div className="h-4 bg-muted rounded-md w-16" />
                        <div className="h-4 bg-muted rounded-md w-20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : properties?.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-3xl mt-8">
                <MapPin className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="font-display font-bold text-lg text-foreground mb-2">No exact matches</h3>
                <p className="text-muted-foreground max-w-sm">Try changing or removing some of your filters to see more homes.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {properties?.map(property => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}

            {totalProperties > 50 && (
              <div className="flex items-center justify-center gap-4 mt-8 pb-4" data-testid="pagination-controls">
                <button
                  onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo(0, 0); }}
                  disabled={page === 0}
                  className="px-4 py-2 rounded-lg bg-primary/10 text-primary font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary hover:text-white transition-colors"
                  data-testid="button-prev-page"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground font-medium" data-testid="text-page-info">
                  Page {page + 1} of {Math.ceil(totalProperties / 50)}
                </span>
                <button
                  onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0); }}
                  disabled={(page + 1) * 50 >= totalProperties}
                  className="px-4 py-2 rounded-lg bg-primary/10 text-primary font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary hover:text-white transition-colors"
                  data-testid="button-next-page"
                >
                  Next
                </button>
              </div>
            )}

            <SdmlsDisclaimer />
          </div>
        </div>

        {/* Right Map Pane */}
        <div className="hidden lg:flex lg:w-2/5 xl:w-1/2 bg-muted relative border-l border-border overflow-hidden">
          <MapView properties={properties || []} center={mapCenter} zoom={mapZoom} />
        </div>
      </div>
    </div>
    </>
  );
}
