import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Map } from "lucide-react";
import { useProperties } from "@/hooks/use-properties";
import { PropertyCard } from "@/components/PropertyCard";

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: properties, isLoading } = useProperties();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?location=${encodeURIComponent(searchQuery)}`);
    } else {
      setLocation("/search");
    }
  };

  const handleMapSearch = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setLocation(`/search?map=true&lat=${latitude}&lng=${longitude}`);
      }, () => {
        setLocation("/search?map=true");
      });
    } else {
      setLocation("/search?map=true");
    }
  };

  const featuredProperties = properties?.filter(p => p.status === 'active').slice(0, 4) || [];

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <div className="relative h-[600px] flex items-center justify-center">
        {/* hero landing real estate house modern beautiful sunny */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1920&h=1080&fit=crop" 
            alt="Beautiful home"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-background"></div>
        </div>

        <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center animate-in">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white text-center mb-6 tracking-tight drop-shadow-lg">
            Find a home that suits your lifestyle.
          </h1>
          
          <form 
            onSubmit={handleSearch}
            className="w-full max-w-2xl bg-background rounded-full p-2 flex items-center shadow-2xl hover:shadow-primary/20 transition-shadow duration-300 mb-4"
            role="search"
            aria-label="Property search"
          >
            <div className="flex-1 flex items-center pl-4 pr-2">
              <Search className="w-5 h-5 text-muted-foreground mr-3" aria-hidden="true" />
              <label htmlFor="home-search" className="sr-only">Search by city, neighborhood, or ZIP code</label>
              <input 
                id="home-search"
                type="text" 
                placeholder="City, Neighborhood, or ZIP"
                className="w-full bg-transparent border-none outline-none focus:ring-0 text-lg py-3 text-foreground placeholder:text-muted-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3.5 rounded-full font-bold transition-all hover:scale-105 active:scale-95 flex-shrink-0 shadow-lg shadow-primary/30"
            >
              Search
            </button>
          </form>

          <button 
            onClick={handleMapSearch}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-6 py-3 rounded-full font-bold transition-all border border-white/30 active:scale-95 shadow-xl"
          >
            <Map className="w-5 h-5" />
            Map Search
          </button>
        </div>
      </div>

      {/* Featured Properties Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 animate-in-delayed">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Featured Homes</h2>
            <p className="text-muted-foreground mt-2">Explore the newest listings hitting the market.</p>
          </div>
          <button 
            onClick={() => setLocation("/search")}
            className="text-primary font-semibold hover:underline hidden sm:block"
          >
            View all listings &rarr;
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card border border-border rounded-2xl h-[350px] animate-pulse"></div>
            ))}
          </div>
        ) : properties?.length === 0 ? (
          <div className="text-center py-20 bg-muted/50 rounded-3xl border border-border border-dashed">
            <p className="text-muted-foreground">No properties available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProperties.map((property, idx) => (
              <div key={property.id} className="animate-in-delayed" style={{ animationDelay: `${idx * 100}ms` }}>
                <PropertyCard property={property} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
