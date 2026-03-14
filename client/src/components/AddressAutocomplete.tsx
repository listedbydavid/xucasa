import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, MapPin, Home, ChevronRight, Loader2, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AutocompleteSuggestion {
  id: number;
  title: string;
  price: number;
  beds: number;
  baths: string;
  sqft: number | null;
  status: string;
  isOffMarket: boolean;
  imageUrl: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
}

interface LocationSuggestion {
  type: "city" | "county";
  label: string;
  value: string;
  state: string;
  count: number;
}

interface AddressAutocompleteProps {
  onSelect?: (property: AutocompleteSuggestion) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  variant?: "hero" | "inline";
  defaultValue?: string;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  onQueryChange?: (query: string) => void;
}

function formatPrice(price: number) {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
  return `$${price.toLocaleString()}`;
}

function statusLabel(status: string, isOffMarket: boolean) {
  if (isOffMarket) return { text: "Off Market", color: "bg-gray-500" };
  if (status === "active") return { text: "Active", color: "bg-green-500" };
  if (status === "sold") return { text: "Sold", color: "bg-red-500" };
  if (status === "pending") return { text: "Pending", color: "bg-yellow-500" };
  return { text: status.charAt(0).toUpperCase() + status.slice(1), color: "bg-blue-500" };
}

export function AddressAutocomplete({
  onSelect,
  onSearch,
  placeholder = "Search by address, city, or ZIP",
  variant = "inline",
  defaultValue = "",
  className = "",
  inputRef: externalInputRef,
  onQueryChange,
}: AddressAutocompleteProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState(defaultValue);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = externalInputRef || internalRef;
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    onQueryChange?.(query);
  }, [query]);

  const autocompleteUrl = debouncedQuery.length >= 2
    ? `/api/properties/autocomplete?q=${encodeURIComponent(debouncedQuery)}&limit=6`
    : null;

  const locationUrl = debouncedQuery.length >= 2
    ? `/api/locations/autocomplete?q=${encodeURIComponent(debouncedQuery)}&limit=5`
    : null;

  const { data: propertySuggestions = [], isLoading: isPropsLoading } = useQuery<AutocompleteSuggestion[]>({
    queryKey: [autocompleteUrl],
    enabled: !!autocompleteUrl,
    staleTime: 30000,
  });

  const { data: locationSuggestions = [], isLoading: isLocsLoading } = useQuery<LocationSuggestion[]>({
    queryKey: [locationUrl],
    enabled: !!locationUrl,
    staleTime: 30000,
  });

  const totalItems = locationSuggestions.length + propertySuggestions.length;
  const isLoading = isPropsLoading || isLocsLoading;

  useEffect(() => {
    setSelectedIndex(-1);
  }, [propertySuggestions, locationSuggestions]);

  const handleSelectProperty = useCallback((property: AutocompleteSuggestion) => {
    setQuery(property.title);
    setIsOpen(false);
    if (onSelect) {
      onSelect(property);
    } else {
      setLocation(`/property/${property.id}`);
    }
  }, [onSelect, setLocation]);

  const handleSelectLocation = useCallback((loc: LocationSuggestion) => {
    setQuery(loc.label);
    setIsOpen(false);
    if (loc.type === "county") {
      setLocation(`/search?county=${encodeURIComponent(loc.value)}`);
    } else {
      setLocation(`/search?city=${encodeURIComponent(loc.value)}`);
    }
  }, [setLocation]);

  const handleSearchSubmit = useCallback(() => {
    setIsOpen(false);
    if (onSearch) {
      onSearch(query);
    } else if (query.trim()) {
      setLocation(`/search?location=${encodeURIComponent(query)}`);
    } else {
      setLocation("/search");
    }
  }, [query, onSearch, setLocation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || totalItems === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearchSubmit();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < totalItems) {
        if (selectedIndex < locationSuggestions.length) {
          handleSelectLocation(locationSuggestions[selectedIndex]);
        } else {
          handleSelectProperty(propertySuggestions[selectedIndex - locationSuggestions.length]);
        }
      } else {
        handleSearchSubmit();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }, [isOpen, totalItems, selectedIndex, locationSuggestions, propertySuggestions, handleSelectLocation, handleSelectProperty, handleSearchSubmit]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        ref.current && !ref.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);

  const showDropdown = isOpen && debouncedQuery.length >= 2;

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="text"
          data-testid="input-address-autocomplete"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={
            variant === "hero"
              ? "w-full bg-transparent border-none outline-none focus:ring-0 text-lg py-3 pl-10 pr-4 text-foreground placeholder:text-muted-foreground"
              : "w-full bg-background border border-border rounded-lg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          }
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          role="listbox"
          data-testid="autocomplete-dropdown"
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-2xl overflow-hidden max-h-[480px] overflow-y-auto"
        >
          {isLoading && totalItems === 0 ? (
            <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </div>
          ) : totalItems === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              <MapPin className="w-5 h-5 mx-auto mb-2 opacity-50" />
              No matching results found
            </div>
          ) : (
            <>
              {locationSuggestions.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                    Places
                  </div>
                  {locationSuggestions.map((loc, index) => (
                    <button
                      key={`${loc.type}-${loc.value}`}
                      role="option"
                      aria-selected={index === selectedIndex}
                      data-testid={`autocomplete-location-${loc.type}-${loc.value}`}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer border-b border-border/50 last:border-0
                        ${index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"}`}
                      onClick={() => handleSelectLocation(loc)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {loc.type === "county" ? (
                          <Building2 className="w-5 h-5 text-primary" />
                        ) : (
                          <MapPin className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-foreground">{loc.label}</span>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {loc.count} {loc.count === 1 ? "listing" : "listings"} · {loc.type === "county" ? "County" : "City"}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {propertySuggestions.length > 0 && (
                <div>
                  {locationSuggestions.length > 0 && (
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                      Properties
                    </div>
                  )}
                  {propertySuggestions.map((property, index) => {
                    const globalIndex = locationSuggestions.length + index;
                    const st = statusLabel(property.status, property.isOffMarket);
                    return (
                      <button
                        key={property.id}
                        role="option"
                        aria-selected={globalIndex === selectedIndex}
                        data-testid={`autocomplete-item-${property.id}`}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer border-b border-border/50 last:border-0
                          ${globalIndex === selectedIndex ? "bg-accent" : "hover:bg-accent/50"}`}
                        onClick={() => handleSelectProperty(property)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        {property.imageUrl ? (
                          <img
                            src={property.imageUrl}
                            alt=""
                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Home className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground truncate">{property.title}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white ${st.color} flex-shrink-0`}>
                              {st.text}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-semibold text-foreground">{formatPrice(property.price)}</span>
                            <span>·</span>
                            <span>{property.beds} bd</span>
                            <span>·</span>
                            <span>{property.baths} ba</span>
                            {property.sqft && (
                              <>
                                <span>·</span>
                                <span>{property.sqft.toLocaleString()} sqft</span>
                              </>
                            )}
                          </div>
                          {property.addressCity && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="w-3 h-3" />
                              <span>{property.addressCity}, {property.addressState} {property.addressZip}</span>
                            </div>
                          )}
                        </div>

                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                data-testid="autocomplete-search-all"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-primary hover:bg-accent/50 transition-colors"
                onClick={handleSearchSubmit}
              >
                <Search className="w-4 h-4" />
                Search all results for "{query}"
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
