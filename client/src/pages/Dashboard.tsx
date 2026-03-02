import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PropertyCard } from "@/components/PropertyCard";
import { useSavedProperties, useSavedSearches, useDeleteSavedSearch } from "@/hooks/use-saved";
import { Link } from "wouter";
import { Heart, Search, Trash2 } from "lucide-react";

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'homes' | 'searches'>('homes');
  
  const { data: savedProps = [], isLoading: isLoadingHomes } = useSavedProperties();
  const { data: savedSearches = [], isLoading: isLoadingSearches } = useSavedSearches();
  const { mutate: deleteSearch } = useDeleteSavedSearch();

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Heart className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold mb-4">Log in to view saved homes</h1>
        <p className="text-muted-foreground mb-8 max-w-md">Create an account to save your favorite homes and searches across all your devices.</p>
        <a href="/api/login" className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-primary/30 transition-all hover:-translate-y-1">
          Log in or Sign up
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center border border-border shadow-sm text-2xl font-bold text-primary">
             {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Welcome back!</h1>
            <p className="text-muted-foreground font-medium">{user?.email}</p>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="flex space-x-1 bg-muted/50 p-1 rounded-2xl max-w-md mb-8 border border-border">
          <button
            onClick={() => setActiveTab('homes')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'homes' 
                ? 'bg-white text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
            }`}
          >
            Saved Homes ({savedProps.length})
          </button>
          <button
            onClick={() => setActiveTab('searches')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'searches' 
                ? 'bg-white text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
            }`}
          >
            Saved Searches ({savedSearches.length})
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'homes' && (
            <div className="animate-in">
              {isLoadingHomes ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1,2,3,4].map(i => <div key={i} className="h-80 bg-muted animate-pulse rounded-2xl"></div>)}
                </div>
              ) : savedProps.length === 0 ? (
                <div className="text-center py-20 bg-card border border-border rounded-3xl shadow-sm">
                  <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <h3 className="font-display font-bold text-xl mb-2">No saved homes</h3>
                  <p className="text-muted-foreground mb-6">Click the heart icon on any property to save it here.</p>
                  <Link href="/search" className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold transition-colors hover:bg-primary">
                    Start Browsing
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {savedProps.map(({ property }) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'searches' && (
            <div className="animate-in">
              {isLoadingSearches ? (
                <div className="space-y-4">
                  {[1,2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl"></div>)}
                </div>
              ) : savedSearches.length === 0 ? (
                <div className="text-center py-20 bg-card border border-border rounded-3xl shadow-sm">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <h3 className="font-display font-bold text-xl mb-2">No saved searches</h3>
                  <p className="text-muted-foreground mb-6">Save your filter preferences to get back to them quickly.</p>
                  <Link href="/search" className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold transition-colors hover:bg-primary">
                    Go to Map Search
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {savedSearches.map((search) => (
                    <div key={search.id} className="bg-card border border-border p-6 rounded-2xl hover:shadow-md transition-shadow group">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-display font-bold text-xl text-foreground mb-2">{search.name}</h3>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {Object.entries(search.criteria as any).map(([k, v]) => (
                              <span key={k} className="bg-muted text-muted-foreground text-xs font-bold px-2 py-1 rounded-md">
                                {k}: {v as string}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteSearch(search.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      <Link 
                        href={`/search?${new URLSearchParams(search.criteria as Record<string, string>).toString()}`}
                        className="inline-flex text-primary font-bold hover:underline"
                      >
                        View Results &rarr;
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
