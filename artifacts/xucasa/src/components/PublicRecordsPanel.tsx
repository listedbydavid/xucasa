import { useQuery } from "@tanstack/react-query";
import {
  School, Trees, Hospital, Bus, ShoppingCart, DollarSign,
  Home, Users, Droplets, AlertTriangle, CheckCircle, Loader2,
  ChevronRight, MapPin
} from "lucide-react";

interface NearbyPlace {
  name: string;
  type: string;
  distanceMeters: number;
}

interface PublicRecordsData {
  geocoded: { lat: number; lng: number } | null;
  neighborhood: {
    medianHouseholdIncome: number | null;
    medianHomeValue: number | null;
    totalPopulation: number | null;
    ownerOccupiedPct: number | null;
    tractId: string;
  } | null;
  flood: {
    floodZone: string;
    sfha: boolean;
    description: string;
  } | null;
  nearby: {
    schools: NearbyPlace[];
    parks: NearbyPlace[];
    hospitals: NearbyPlace[];
    transit: NearbyPlace[];
    groceries: NearbyPlace[];
  };
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function formatCurrency(val: number): string {
  return val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val}`;
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string | null;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-2xl border border-border">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="font-bold text-foreground text-base mt-0.5">
          {value ?? <span className="text-muted-foreground text-sm font-medium">Not available</span>}
        </div>
      </div>
    </div>
  );
}

function NearbyList({ title, icon: Icon, places, color }: {
  title: string;
  icon: React.ElementType;
  places: NearbyPlace[];
  color: string;
}) {
  if (places.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="font-bold text-sm text-foreground">{title}</span>
      </div>
      <ul className="space-y-1">
        {places.map((place, i) => (
          <li key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
            <span className="text-foreground font-medium truncate mr-2">{place.name}</span>
            <span className="text-muted-foreground text-xs font-semibold flex-shrink-0 bg-muted px-2 py-0.5 rounded-full">
              {formatDistance(place.distanceMeters)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicRecordsPanel({ propertyId }: { propertyId: number }) {
  const { data, isLoading, isError } = useQuery<PublicRecordsData>({
    queryKey: ["/api/properties", propertyId, "public-records"],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}/public-records`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // cache for 1 hour — this data changes rarely
  });

  const hasNearby = data && (
    data.nearby.schools.length > 0 ||
    data.nearby.parks.length > 0 ||
    data.nearby.hospitals.length > 0 ||
    data.nearby.transit.length > 0 ||
    data.nearby.groceries.length > 0
  );

  return (
    <div className="mt-10 border-t border-border pt-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Public Records & Neighborhood</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live data from US Census Bureau, FEMA, and OpenStreetMap
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium">Fetching public records…</span>
        </div>
      )}

      {isError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive font-medium text-sm">
          Could not load public records at this time.
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-8">
          {/* Neighborhood Stats from US Census Bureau */}
          {data.neighborhood ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Neighborhood · US Census Bureau (ACS 5-Year)
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Median Income"
                  value={data.neighborhood.medianHouseholdIncome
                    ? `$${data.neighborhood.medianHouseholdIncome.toLocaleString()}`
                    : null}
                  icon={DollarSign}
                  color="bg-green-100 text-green-700"
                />
                <StatCard
                  label="Median Home Value"
                  value={data.neighborhood.medianHomeValue
                    ? `$${data.neighborhood.medianHomeValue.toLocaleString()}`
                    : null}
                  icon={Home}
                  color="bg-blue-100 text-blue-700"
                />
                <StatCard
                  label="Population"
                  value={data.neighborhood.totalPopulation
                    ? data.neighborhood.totalPopulation.toLocaleString()
                    : null}
                  icon={Users}
                  color="bg-purple-100 text-purple-700"
                />
                <StatCard
                  label="Owner-Occupied"
                  value={data.neighborhood.ownerOccupiedPct !== null
                    ? `${data.neighborhood.ownerOccupiedPct}%`
                    : null}
                  icon={Home}
                  color="bg-orange-100 text-orange-700"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Census Tract {data.neighborhood.tractId} · Source: census.gov
              </p>
            </div>
          ) : (
            <div className="p-4 bg-muted/40 rounded-2xl border border-border text-muted-foreground text-sm font-medium">
              Census neighborhood data not available for this address.
            </div>
          )}

          {/* FEMA Flood Zone */}
          {data.flood && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Flood Risk · FEMA National Flood Hazard Layer
                </span>
              </div>
              <div className={`flex items-start gap-4 p-4 rounded-2xl border ${
                data.flood.sfha
                  ? "bg-red-50 border-red-200"
                  : "bg-green-50 border-green-200"
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  data.flood.sfha ? "bg-red-100" : "bg-green-100"
                }`}>
                  {data.flood.sfha
                    ? <AlertTriangle className="w-5 h-5 text-red-600" />
                    : <CheckCircle className="w-5 h-5 text-green-600" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-bold text-lg ${data.flood.sfha ? "text-red-800" : "text-green-800"}`}>
                      Flood Zone {data.flood.floodZone}
                    </span>
                    {data.flood.sfha && (
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        SFHA
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${data.flood.sfha ? "text-red-700" : "text-green-700"}`}>
                    {data.flood.description}
                  </p>
                  {data.flood.sfha && (
                    <p className="text-xs text-red-600 mt-1">
                      Flood insurance is typically required by lenders in this zone.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Source: msc.fema.gov</p>
                </div>
              </div>
            </div>
          )}

          {/* Nearby Amenities from OpenStreetMap */}
          {hasNearby && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Nearby · OpenStreetMap (within 1 mile)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <NearbyList
                  title="Schools"
                  icon={School}
                  places={data.nearby.schools}
                  color="bg-blue-100 text-blue-700"
                />
                <NearbyList
                  title="Parks & Green Space"
                  icon={Trees}
                  places={data.nearby.parks}
                  color="bg-green-100 text-green-700"
                />
                <NearbyList
                  title="Hospitals & Medical"
                  icon={Hospital}
                  places={data.nearby.hospitals}
                  color="bg-red-100 text-red-700"
                />
                <NearbyList
                  title="Transit Stops"
                  icon={Bus}
                  places={data.nearby.transit}
                  color="bg-purple-100 text-purple-700"
                />
                <NearbyList
                  title="Grocery Stores"
                  icon={ShoppingCart}
                  places={data.nearby.groceries}
                  color="bg-orange-100 text-orange-700"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">Source: openstreetmap.org</p>
            </div>
          )}

          {!data.neighborhood && !data.flood && !hasNearby && (
            <div className="p-6 text-center bg-muted/40 rounded-2xl border border-border">
              <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-muted-foreground font-medium">
                No public record data found for this address.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Full address details may be needed for lookup.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
