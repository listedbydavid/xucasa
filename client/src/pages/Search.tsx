import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PropertyCard } from "@/components/PropertyCard";
import { useProperties } from "@/hooks/use-properties";
import { useCreateSavedSearch } from "@/hooks/use-saved";
import { Search as SearchIcon, Filter, MapPin, Map, BookmarkPlus } from "lucide-react";
import { MapView } from "@/components/MapView";
import queryString from "query-string";

export default function Search() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const [filters, setFilters] = useState({
    location: searchParams.get("location") || "",
    minPrice: searchParams.get("minPrice") || "",
    beds: searchParams.get("beds") || "",
    isOffMarket: searchParams.get("isOffMarket") || "",
  });

  const [activeQuery, setActiveQuery] = useState({});
  const [mapCenter, setMapCenter] = useState<[number, number]>([-122.4194, 37.7749]); // [lng, lat] for Mapbox
  const [mapZoom, setMapZoom] = useState(12);

  useEffect(() => {
    const query: any = {};
    if (filters.location) query.location = filters.location;
    if (filters.minPrice) query.minPrice = Number(filters.minPrice);
    if (filters.beds) query.minBeds = Number(filters.beds);
    if (filters.isOffMarket) query.isOffMarket = filters.isOffMarket;
    setActiveQuery(query);

    // Geocoding logic for zip codes (mock or simple logic)
    if (filters.location.match(/^\d{5}$/)) {
      const zip = parseInt(filters.location);
      if (zip >= 90000 && zip <= 96162) { // CA
        setMapCenter([-119.4179, 36.7783]);
      } else if (zip >= 10001 && zip <= 14905) { // NY
        setMapCenter([-74.0060, 40.7128]);
      } else if (zip >= 60601 && zip <= 60699) { // Chicago
        setMapCenter([-87.6298, 41.8781]);
      } else if (zip >= 33101 && zip <= 33299) { // Miami
        setMapCenter([-80.1918, 25.7617]);
      } else {
        setMapCenter([-98.5795 + (Math.random() - 0.5) * 5, 39.8283 + (Math.random() - 0.5) * 5]);
      }
      setMapZoom(12);
    }
  }, [filters]);

  const { data: properties, isLoading } = useProperties(activeQuery);
  const { mutate: saveSearch, isPending: isSavingSearch } = useCreateSavedSearch();

  const handleSaveSearch = () => {
    const name = filters.location 
      ? `Search in ${filters.location}` 
      : "General Search";
    saveSearch({ name, criteria: activeQuery });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Search Header Bar */}
      <div className="bg-card border-b border-border p-4 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 flex items-center bg-muted rounded-xl px-4 py-2 border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <SearchIcon className="w-5 h-5 text-muted-foreground mr-2" />
            <input 
              type="text" 
              placeholder="Search location..."
              className="w-full bg-transparent border-none outline-none font-medium text-foreground"
              value={filters.location}
              onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <select 
              className="bg-background border border-border rounded-xl px-4 py-2.5 font-medium text-sm outline-none focus:border-primary hover:border-primary/50 transition-colors"
              value={filters.minPrice}
              onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
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
            >
              <option value="">All Types</option>
              <option value="false">Active Only</option>
              <option value="true">Make Me Move Only</option>
            </select>

            <button 
              onClick={handleSaveSearch}
              disabled={isSavingSearch}
              className="ml-auto sm:ml-0 flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span className="hidden lg:inline">Save Search</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left List Pane */}
        <div className="w-full lg:w-3/5 xl:w-1/2 h-full overflow-y-auto p-4 sm:p-6 bg-background">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-xl text-foreground">
              {isLoading ? "Searching..." : `${properties?.length || 0} Homes for Sale`}
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[1,2,3,4].map(i => <div key={i} className="h-80 bg-muted animate-pulse rounded-2xl"></div>)}
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

        {/* Right Map Pane */}
        <div className="hidden lg:flex lg:w-2/5 xl:w-1/2 bg-muted relative border-l border-border overflow-hidden">
          <MapView properties={properties || []} center={mapCenter} zoom={mapZoom} />
        </div>
      </div>
    </div>
  );
}
