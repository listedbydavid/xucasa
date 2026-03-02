import { useQuery } from "@tanstack/react-query";
import { Building2, Construction, Landmark, Mountain, MapPin, ExternalLink, AlertTriangle, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { useState } from "react";

interface LandUseInfo {
  primaryType: string;
  label: string;
  breakdown: { type: string; label: string; count: number }[];
}

interface BuildingContext {
  typicalLevels: number | null;
  maxLevels: number | null;
  sampleBuildings: { name?: string; type?: string; levels: number }[];
  dominantBuildingType: string | null;
}

interface ElevationInfo {
  elevationMeters: number;
  elevationFeet: number;
}

interface ConstructionSite {
  name?: string;
  levels?: number;
  constructionType?: string;
  heightFt?: number;
  lat: number;
  lng: number;
}

interface HistoricSite {
  name?: string;
  designation?: string;
  lat: number;
  lng: number;
}

interface ZoningData {
  landUse: LandUseInfo | null;
  buildingContext: BuildingContext;
  elevation: ElevationInfo | null;
  activeConstruction: ConstructionSite[];
  historicDesignations: HistoricSite[];
  zappLink: string | null;
}

const LAND_USE_COLORS: Record<string, string> = {
  residential: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  commercial: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  industrial: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  mixed: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  open: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  institutional: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  default: "bg-muted text-muted-foreground",
};

function getLandUseColor(type: string): string {
  if (type.includes("residential") || type === "apartments") return LAND_USE_COLORS.residential;
  if (type.includes("commercial") || type === "retail" || type === "office") return LAND_USE_COLORS.commercial;
  if (type.includes("industrial")) return LAND_USE_COLORS.industrial;
  if (type.includes("mixed")) return LAND_USE_COLORS.mixed;
  if (["grass", "meadow", "forest", "park", "recreation_ground", "farmland"].includes(type)) return LAND_USE_COLORS.open;
  if (["education", "institutional", "cemetery"].includes(type)) return LAND_USE_COLORS.institutional;
  return LAND_USE_COLORS.default;
}

function StoriesIcon({ count }: { count: number }) {
  const filled = Math.min(count, 10);
  return (
    <div className="flex flex-col-reverse gap-px" title={`${count} stories`}>
      {Array.from({ length: Math.min(filled, 6) }).map((_, i) => (
        <div key={i} className="w-3 h-1.5 rounded-sm bg-primary/70" />
      ))}
      {count > 6 && <div className="text-[9px] text-muted-foreground text-center">+{count - 6}</div>}
    </div>
  );
}

export function ZoningPanel({ propertyId }: { propertyId: number }) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery<ZoningData>({
    queryKey: ["/api/properties", propertyId, "zoning"],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}/zoning`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load zoning data");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: expanded,
  });

  const hasData = data && (data.landUse || data.elevation || data.activeConstruction?.length || data.historicDesignations?.length);

  return (
    <div className="rounded-2xl border border-border overflow-hidden" data-testid="zoning-panel">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-6 py-5 bg-background hover:bg-muted/40 transition-colors"
        data-testid="zoning-panel-toggle"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-base">Zoning & Development</p>
            <p className="text-sm text-muted-foreground">Land use, building context, active construction</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-6 py-6 space-y-6 bg-background">
          {isLoading && (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded-xl" />
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Could not load zoning data. Try again later.</span>
            </div>
          )}

          {data && !hasData && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No zoning or development data found for this address.
            </p>
          )}

          {data?.landUse && (
            <section data-testid="zoning-land-use">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Land Use Classification
              </h4>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${getLandUseColor(data.landUse.primaryType)}`}>
                  {data.landUse.label}
                </span>
              </div>
              {data.landUse.breakdown.length > 1 && (
                <div className="space-y-1.5">
                  {data.landUse.breakdown.map(b => (
                    <div key={b.type} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{b.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLandUseColor(b.type)}`}>
                        {b.count} zone{b.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">Source: OpenStreetMap contributors</p>
            </section>
          )}

          {(data?.buildingContext?.typicalLevels || data?.buildingContext?.sampleBuildings?.length > 0) && (
            <section data-testid="zoning-building-context">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Nearby Building Heights
              </h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {data.buildingContext.typicalLevels && (
                  <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                    <StoriesIcon count={data.buildingContext.typicalLevels} />
                    <div>
                      <p className="text-lg font-bold">{data.buildingContext.typicalLevels}</p>
                      <p className="text-xs text-muted-foreground">Typical stories</p>
                    </div>
                  </div>
                )}
                {data.buildingContext.maxLevels && (
                  <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                    <StoriesIcon count={data.buildingContext.maxLevels} />
                    <div>
                      <p className="text-lg font-bold">{data.buildingContext.maxLevels}</p>
                      <p className="text-xs text-muted-foreground">Tallest nearby</p>
                    </div>
                  </div>
                )}
              </div>
              {data.buildingContext.dominantBuildingType && (
                <p className="text-sm text-muted-foreground">
                  Dominant type: <span className="font-medium capitalize text-foreground">{data.buildingContext.dominantBuildingType}</span>
                </p>
              )}
              {data.buildingContext.sampleBuildings.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {data.buildingContext.sampleBuildings.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground truncate max-w-[60%]">
                        {b.name || (b.type ? `${b.type.charAt(0).toUpperCase() + b.type.slice(1)} building` : "Building")}
                      </span>
                      <span className="font-medium text-foreground">{b.levels} {b.levels === 1 ? "story" : "stories"}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {data?.activeConstruction && data.activeConstruction.length > 0 && (
            <section data-testid="zoning-construction">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Construction className="w-4 h-4" /> Active Construction Nearby
              </h4>
              <div className="space-y-2">
                {data.activeConstruction.map((site, i) => (
                  <div key={i} className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                    <Construction className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-amber-900 dark:text-amber-200 truncate">
                        {site.name || (site.constructionType ? `${site.constructionType.charAt(0).toUpperCase() + site.constructionType.slice(1)} development` : "Development site")}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {site.levels && (
                          <span className="text-xs text-amber-700 dark:text-amber-300">{site.levels} stories planned</span>
                        )}
                        {site.heightFt && (
                          <span className="text-xs text-amber-700 dark:text-amber-300">{site.heightFt} ft tall</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data?.historicDesignations && data.historicDesignations.length > 0 && (
            <section data-testid="zoning-historic">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Landmark className="w-4 h-4" /> Historic Overlay
              </h4>
              <div className="space-y-2">
                {data.historicDesignations.slice(0, 5).map((site, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Landmark className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground truncate">
                      {site.name || `Historic ${site.designation || "site"}`}
                      {site.designation && site.designation !== "building" && site.designation !== "yes" && (
                        <span className="text-xs ml-1 capitalize">({site.designation})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data?.elevation && (
            <section data-testid="zoning-elevation">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Mountain className="w-4 h-4" /> Elevation
              </h4>
              <div className="flex items-center gap-4">
                <div className="bg-muted/40 rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-bold">{data.elevation.elevationFeet.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">feet above sea level</p>
                </div>
                <div className="bg-muted/40 rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-bold">{data.elevation.elevationMeters.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">meters</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Source: USGS National Elevation Dataset</p>
            </section>
          )}

          {data?.zappLink && (
            <section data-testid="zoning-zapp">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">San Diego ZAPP Portal</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Access official City of San Diego zoning codes, active building permits, allowed land uses, overlay zones, and parcel-specific development standards directly from the city's ZAPP tool.
                    </p>
                    <a
                      href={data.zappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-primary hover:underline"
                      data-testid="zapp-link"
                    >
                      Open ZAPP for this address <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </section>
          )}

          {!data?.zappLink && data && (
            <p className="text-xs text-muted-foreground text-center border-t border-border pt-4">
              For parcel-specific zoning codes and active permits, visit your city's planning portal.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
