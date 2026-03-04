import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { PropertyCard } from "@/components/PropertyCard";
import { useProperties } from "@/hooks/use-properties";
import { useCreateSavedSearch } from "@/hooks/use-saved";
import { useAddSearchHistory } from "@/hooks/use-client-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { Search as SearchIcon, MapPin, Map, BookmarkPlus, X, Check } from "lucide-react";
import { MapView } from "@/components/MapView";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import queryString from "query-string";
import { AuthPromptModal } from "@/components/AuthPromptModal";

export default function Search() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);

  const [locationInput, setLocationInput] = useState(searchParams.get("location") || "");
  const [filters, setFilters] = useState({
    minPrice: searchParams.get("minPrice") || "",
    beds: searchParams.get("beds") || "",
    isOffMarket: searchParams.get("isOffMarket") || "",
  });

  const [activeQuery, setActiveQuery] = useState<Record<string, any>>({});
  const [mapCenter, setMapCenter] = useState<[number, number]>([-122.4194, 37.7749]);
  const [mapZoom, setMapZoom] = useState(12);
  const [isMapVisible, setIsMapVisible] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useGoogleMaps();

  // Initialize Places Autocomplete once API is ready
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'us' },
      fields: ['geometry', 'address_components', 'formatted_address', 'name'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setMapCenter([lng, lat]);
      setMapZoom(15);

      // Extract city/locality for the filter
      const components = place.address_components || [];
      const city = components.find(c => c.types.includes('locality'))?.long_name
        || components.find(c => c.types.includes('sublocality'))?.long_name
        || components.find(c => c.types.includes('administrative_area_level_2'))?.long_name
        || '';

      // Use the full typed/selected text as the filter (searches across all address fields)
      const filterValue = place.formatted_address || place.name || inputRef.current?.value || '';
      setLocationInput(filterValue);
    });

    autocompleteRef.current = ac;
  }, [isLoaded]);

  // Sync location input → activeQuery and mapCenter
  useEffect(() => {
    const query: Record<string, any> = {};
    if (locationInput) query.location = locationInput;
    if (filters.minPrice) query.minPrice = Number(filters.minPrice);
    if (filters.beds) query.minBeds = Number(filters.beds);
    if (filters.isOffMarket) query.isOffMarket = filters.isOffMarket;
    setActiveQuery(query);

    // Handle geolocation from map search button (Home page)
    const mapFlag = searchParams.get("map");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (mapFlag === "true" && lat && lng) {
      setMapCenter([Number(lng), Number(lat)]);
      setMapZoom(14);
    }
  }, [locationInput, filters]);

  const { data: properties, isLoading } = useProperties(activeQuery);
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
          <div className="flex-1 flex items-center bg-muted rounded-xl px-4 py-2 border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <SearchIcon className="w-5 h-5 text-muted-foreground mr-2 flex-shrink-0" aria-hidden="true" />
            <label htmlFor="search-location" className="sr-only">Search by address, city, or ZIP code</label>
            <input
              id="search-location"
              ref={inputRef}
              type="text"
              placeholder="Search by address, city, ZIP..."
              className="w-full bg-transparent border-none outline-none font-medium text-foreground"
              data-testid="input-search-location"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <select
              className="bg-background border border-border rounded-xl px-4 py-2.5 font-medium text-sm outline-none focus:border-primary hover:border-primary/50 transition-colors"
              value={filters.minPrice}
              onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
              data-testid="select-min-price"
              aria-label="Filter by minimum price"
            >
              <option value="">Any Price</option>
              <option value="500000">$500k+</option>
              <option value="1000000">$1M+</option>
              <option value="1500000">$1.5M+</option>
            </select>

            <select
              className="bg-background border border-border rounded-xl px-4 py-2.5 font-medium text-sm outline-none focus:border-primary hover:border-primary/50 transition-colors"
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
            </select>

            <select
              className="bg-background border border-border rounded-xl px-4 py-2.5 font-medium text-sm outline-none focus:border-primary hover:border-primary/50 transition-colors"
              value={filters.isOffMarket}
              onChange={(e) => setFilters(prev => ({ ...prev, isOffMarket: e.target.value }))}
              data-testid="select-listing-type"
              aria-label="Filter by listing type"
            >
              <option value="">All Types</option>
              <option value="false">Active Only</option>
              <option value="true">Buy it Now Only</option>
            </select>

            {showSaveNameInput ? (
              <div className="ml-auto sm:ml-0 flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-1.5 shadow-md">
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
                className="ml-auto sm:ml-0 flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                data-testid="button-save-search"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span className="hidden lg:inline">Save Search</span>
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
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="font-display font-bold text-xl text-foreground">
                  {isLoading ? "Searching..." : `${properties?.length || 0} Homes`}
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
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[1,2,3,4].map(i => <div key={i} className="h-80 bg-muted animate-pulse rounded-2xl" />)}
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
