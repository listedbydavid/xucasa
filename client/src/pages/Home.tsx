import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search, Map, Home as HomeIcon, DollarSign, TrendingUp,
  Heart, Users, ArrowRight, Sparkles,
  Building2, BarChart3, Shield
} from "lucide-react";
import { useProperties } from "@/hooks/use-properties";
import { PropertyCard } from "@/components/PropertyCard";
import { SdmlsDisclaimer } from "@/components/SdmlsDisclaimer";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

type HeroTab = "buy" | "sell" | "estimate";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: propertiesData, isLoading } = useProperties({ limit: 20 });
  const currentQueryRef = useRef("");
  const sellAddressRef = useRef("");
  const estimateAddressRef = useRef("");
  const [activeTab, setActiveTab] = useState<HeroTab>("buy");

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

  const navigateToSearch = (q: string) => {
    if (q.trim()) {
      setLocation(`/search?location=${encodeURIComponent(q)}`);
    } else {
      setLocation("/search");
    }
  };

  const featuredProperties = propertiesData?.properties?.filter(p => p.status === 'active').slice(0, 4) || [];

  const heroTabs = [
    { id: "buy" as HeroTab, label: "Buy", icon: HomeIcon },
    { id: "sell" as HeroTab, label: "Sell", icon: DollarSign },
    { id: "estimate" as HeroTab, label: "Home Report", icon: TrendingUp },
  ];

  const headlineByTab: Record<HeroTab, string> = {
    buy: "Find a home that suits your lifestyle.",
    sell: "Sell your home with confidence.",
    estimate: "Your complete home report.",
  };

  const subtitleByTab: Record<HeroTab, string> = {
    buy: "Search thousands of listings by address, city, or ZIP code.",
    sell: "Get a free valuation and connect with qualified buyers instantly.",
    estimate: "Get a full property report with valuation, equity, zoning, and more.",
  };

  const features = [
    {
      icon: Search,
      title: "Smart Search",
      description: "Filter by price, beds, baths, property type and more. View results on an interactive map or in a list.",
      action: () => setLocation("/search"),
      actionLabel: "Search now",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: Heart,
      title: "Swipe to Discover",
      description: "Browse homes like a feed. Swipe right to save your favorites, left to pass. Finding your next home should be fun.",
      action: () => setLocation("/swipe"),
      actionLabel: "Start swiping",
      color: "bg-destructive/10 text-destructive",
    },
    {
      icon: DollarSign,
      title: "Sell Your Home",
      description: "Get a free instant valuation, see comparable sales, and pitch directly to pre-approved buyers in our marketplace.",
      action: () => setLocation("/sell"),
      actionLabel: "Get your estimate",
      color: "bg-accent text-accent-foreground",
    },
    {
      icon: Users,
      title: "Buyer Marketplace",
      description: "Create a buyer profile with your criteria and get matched with listings and agents who fit your needs.",
      action: () => setLocation("/buyers"),
      actionLabel: "Browse buyers",
      color: "bg-secondary text-secondary-foreground",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Search or Swipe",
      description: "Use our map search, filters, or swipe feed to discover properties that match your lifestyle.",
    },
    {
      number: "02",
      title: "Save & Compare",
      description: "Save your favorite listings, track price changes, and compare homes side by side from your dashboard.",
    },
    {
      number: "03",
      title: "Get Matched",
      description: "Create a buyer profile and get automatically matched with new listings and sellers looking for buyers like you.",
    },
    {
      number: "04",
      title: "Connect & Close",
      description: "Work with verified agents, schedule open houses, and plan visit routes all in one place.",
    },
  ];

  const stats = [
    { value: "Real-Time", label: "MLS Listings" },
    { value: "100%", label: "Free to Use" },
    { value: "San Diego", label: "& Surrounding Areas" },
    { value: "24/7", label: "Access Anytime" },
  ];

  return (
    <div className="min-h-screen">
      <div className="relative min-h-[620px] md:min-h-[660px] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1920&h=1080&fit=crop"
            alt="Modern luxury home with large windows and landscaped yard"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-background" />
        </div>

        <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center animate-in pt-8">
          <h1
            data-testid="text-hero-headline"
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white text-center mb-3 tracking-tight transition-all duration-300"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)" }}
          >
            {headlineByTab[activeTab]}
          </h1>
          <p
            data-testid="text-hero-subtitle"
            className="text-lg md:text-xl text-white text-center mb-8 max-w-2xl transition-all duration-300"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.4)" }}
          >
            {subtitleByTab[activeTab]}
          </p>

          <div className="w-full max-w-2xl">
            <div className="flex gap-0 bg-black/40 backdrop-blur-lg rounded-t-2xl border border-white/25 border-b-0 overflow-hidden">
              {heroTabs.map((tab) => (
                <button
                  key={tab.id}
                  data-testid={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 font-semibold text-sm md:text-base transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-white hover:bg-white/15"
                  }`}
                  style={activeTab !== tab.id ? { textShadow: "0 1px 4px rgba(0,0,0,0.5)" } : undefined}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-background rounded-b-2xl p-4 shadow-2xl">
              {activeTab === "buy" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1">
                    <AddressAutocomplete
                      variant="hero"
                      placeholder="Search by address, city, or ZIP"
                      onSearch={navigateToSearch}
                      onQueryChange={(q) => { currentQueryRef.current = q; }}
                    />
                  </div>
                  <button
                    data-testid="button-hero-search"
                    onClick={() => navigateToSearch(currentQueryRef.current)}
                    className="bg-primary text-primary-foreground px-6 md:px-8 py-3.5 rounded-full font-bold transition-all active:scale-95 flex-shrink-0 shadow-lg shadow-primary/30"
                  >
                    Search
                  </button>
                </div>
              )}

              {activeTab === "sell" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1">
                    <AddressAutocomplete
                      variant="hero"
                      placeholder="Enter your home address"
                      onQueryChange={(q) => { sellAddressRef.current = q; }}
                      onSearch={(q) => { if (q.trim()) setLocation(`/sell?address=${encodeURIComponent(q)}`); }}
                      onSelect={(p) => setLocation(`/sell?address=${encodeURIComponent(p.title)}`)}
                    />
                  </div>
                  <button
                    data-testid="button-sell-start"
                    onClick={() => setLocation(sellAddressRef.current.trim() ? `/sell?address=${encodeURIComponent(sellAddressRef.current)}` : "/sell")}
                    className="bg-primary text-primary-foreground px-6 md:px-8 py-3.5 rounded-full font-bold transition-all active:scale-95 flex-shrink-0 shadow-lg shadow-primary/30"
                  >
                    Get Started
                  </button>
                </div>
              )}

              {activeTab === "estimate" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1">
                    <AddressAutocomplete
                      variant="hero"
                      placeholder="Enter your address for a free home report"
                      onQueryChange={(q) => { estimateAddressRef.current = q; }}
                      onSearch={(q) => { if (q.trim()) setLocation(`/home-report?address=${encodeURIComponent(q)}`); }}
                      onSelect={(p) => setLocation(`/home-report?address=${encodeURIComponent(p.title)}`)}
                    />
                  </div>
                  <button
                    data-testid="button-estimate-start"
                    onClick={() => setLocation(estimateAddressRef.current.trim() ? `/home-report?address=${encodeURIComponent(estimateAddressRef.current)}` : "/home-report")}
                    className="bg-primary text-primary-foreground px-6 md:px-8 py-3.5 rounded-full font-bold transition-all active:scale-95 flex-shrink-0 shadow-lg shadow-primary/30"
                  >
                    Get Report
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleMapSearch}
            data-testid="button-map-search"
            className="mt-4 flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-6 py-3 rounded-full font-bold transition-all border border-white/30 active:scale-95 shadow-xl"
          >
            <Map className="w-5 h-5" aria-hidden="true" />
            Explore the Map
          </button>
        </div>
      </div>

      <div className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                <p className="text-2xl md:text-3xl font-display font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Sparkles className="w-4 h-4" />
            Everything you need
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground" data-testid="text-features-heading">
            Discover what xucasa can do for you
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto text-lg">
            Whether you're buying, selling, or just exploring, xucasa gives you powerful tools to make confident real estate decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, idx) => (
            <div
              key={feature.title}
              data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
              className="group bg-card border border-border rounded-2xl p-6 md:p-8 hover:border-primary/30 hover:shadow-lg transition-all duration-300 animate-in-delayed cursor-pointer"
              style={{ animationDelay: `${idx * 100}ms` }}
              onClick={feature.action}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.color}`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">{feature.description}</p>
              <span className="inline-flex items-center gap-1.5 text-primary font-semibold text-sm group-hover:gap-2.5 transition-all">
                {feature.actionLabel}
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground" data-testid="text-howit-heading">
              How it works
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-lg">
              From first search to closing day, xucasa is with you every step of the way.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, idx) => (
              <div
                key={step.number}
                data-testid={`step-${step.number}`}
                className="relative animate-in-delayed"
                style={{ animationDelay: `${idx * 120}ms` }}
              >
                {idx < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-border" />
                )}
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-display font-bold mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-display font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground" data-testid="text-featured-heading">
              Featured Homes
            </h2>
            <p className="text-muted-foreground mt-2">Explore the newest listings hitting the market.</p>
          </div>
          <button
            onClick={() => setLocation("/search")}
            data-testid="link-view-all"
            className="text-primary font-semibold hover:underline hidden sm:flex items-center gap-1"
          >
            View all listings
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card border border-border rounded-2xl h-[350px] animate-pulse" />
            ))}
          </div>
        ) : featuredProperties.length === 0 ? (
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

        <SdmlsDisclaimer />
      </section>

      <section className="bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-center">
          <h2
            className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-4"
            data-testid="text-cta-heading"
          >
            Ready to find your next home?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
            Join xucasa today and get access to real-time listings, personalized matches, and powerful tools to make your move.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              data-testid="button-cta-search"
              onClick={() => setLocation("/search")}
              className="bg-white text-primary hover:bg-white/90 px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              Start Searching
            </button>
            <button
              data-testid="button-cta-buyers"
              onClick={() => setLocation("/buyers")}
              className="bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 border border-primary-foreground/30 px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95"
            >
              Create Buyer Profile
            </button>
          </div>
        </div>
      </section>

      <section className="bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4" data-testid="trust-mls-data">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">MLS-Powered Listings</h3>
                <p className="text-sm text-muted-foreground mt-1">All listings are synced directly from the MLS, so you always see accurate, up-to-date data.</p>
              </div>
            </div>
            <div className="flex items-start gap-4" data-testid="trust-public-records">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">Public Records & Insights</h3>
                <p className="text-sm text-muted-foreground mt-1">Every listing is enriched with neighborhood data, flood zones, nearby schools, and more.</p>
              </div>
            </div>
            <div className="flex items-start gap-4" data-testid="trust-fair-housing">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">Fair Housing Committed</h3>
                <p className="text-sm text-muted-foreground mt-1">xucasa is committed to equal housing opportunity and fair, transparent real estate for everyone.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
