import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, MapPin, Home, ChevronRight, Loader2 } from "lucide-react";
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
    ? `/api/properties/autocomplete?q=${encodeURIComponent(debouncedQuery)}&limit=8`
    : null;

  const { data: suggestions = [], isLoading: isSuggestionsLoading } = useQuery<AutocompleteSuggestion[]>({
    queryKey: [autocompleteUrl],
    enabled: !!autocompleteUrl,
    staleTime: 30000,
  });

  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleSelect = useCallback((property: AutocompleteSuggestion) => {
    setQuery(property.title);
    setIsOpen(false);
    if (onSelect) {
      onSelect(property);
    } else {
      setLocation(`/property/${property.id}`);
    }
  }, [onSelect, setLocation]);

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
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearchSubmit();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelect(suggestions[selectedIndex]);
      } else {
        handleSearchSubmit();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }, [isOpen, suggestions, selectedIndex, handleSelect, handleSearchSubmit]);

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
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden max-h-[420px] overflow-y-auto"
        >
          {isSuggestionsLoading ? (
            <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching properties...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              <MapPin className="w-5 h-5 mx-auto mb-2 opacity-50" />
              No matching properties found
            </div>
          ) : (
            <>
              {suggestions.map((property, index) => {
                const st = statusLabel(property.status, property.isOffMarket);
                return (
                  <button
                    key={property.id}
                    role="option"
                    aria-selected={index === selectedIndex}
                    data-testid={`autocomplete-item-${property.id}`}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer border-b border-border/50 last:border-0
                      ${index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"}`}
                    onClick={() => handleSelect(property)}
                    onMouseEnter={() => setSelectedIndex(index)}
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
