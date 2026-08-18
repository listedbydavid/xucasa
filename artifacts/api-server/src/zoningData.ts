const OVERPASS = "https://overpass-api.de/api/interpreter";
const USGS_EPQS = "https://epqs.nationalmap.gov/v1/json";

export interface ZoningData {
  landUse: LandUseInfo | null;
  buildingContext: BuildingContext;
  elevation: ElevationInfo | null;
  activeConstruction: ConstructionSite[];
  historicDesignations: HistoricSite[];
  zappLink: string | null;
}

export interface LandUseInfo {
  primaryType: string;
  label: string;
  breakdown: { type: string; label: string; count: number }[];
}

export interface BuildingContext {
  typicalLevels: number | null;
  maxLevels: number | null;
  sampleBuildings: { name?: string; type?: string; levels: number }[];
  dominantBuildingType: string | null;
}

export interface ElevationInfo {
  elevationMeters: number;
  elevationFeet: number;
}

export interface ConstructionSite {
  name?: string;
  levels?: number;
  constructionType?: string;
  heightFt?: number;
  lat: number;
  lng: number;
}

export interface HistoricSite {
  name?: string;
  designation?: string;
  lat: number;
  lng: number;
}

const LAND_USE_LABELS: Record<string, string> = {
  residential: "Residential",
  apartments: "Residential – Apartments",
  commercial: "Commercial",
  retail: "Retail / Commercial",
  industrial: "Industrial",
  office: "Office",
  mixed: "Mixed Use",
  grass: "Open Space / Grass",
  meadow: "Open Space / Meadow",
  forest: "Open Space / Forest",
  park: "Park / Recreation",
  recreation_ground: "Recreation Ground",
  farmland: "Agricultural",
  orchard: "Agricultural / Orchard",
  allotments: "Community Gardens",
  cemetery: "Cemetery",
  education: "Education / Institutional",
  institutional: "Institutional",
  garages: "Parking / Garages",
  construction: "Under Construction",
  brownfield: "Brownfield / Redevelopment Site",
  greenfield: "Greenfield",
};

function getLandUseLabel(type: string): string {
  return LAND_USE_LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getPrimaryLandUseLabel(type: string): string {
  const map: Record<string, string> = {
    residential: "Residential",
    apartments: "Residential",
    commercial: "Commercial",
    retail: "Commercial",
    industrial: "Industrial",
    office: "Commercial / Office",
    grass: "Open Space",
    meadow: "Open Space",
    forest: "Open Space",
    park: "Open Space",
    recreation_ground: "Open Space",
    farmland: "Agricultural",
    education: "Institutional",
    institutional: "Institutional",
    construction: "Under Construction",
    brownfield: "Redevelopment",
    mixed: "Mixed Use",
  };
  return map[type] || getLandUseLabel(type);
}

export async function getLandUseAndBuildings(lat: number, lng: number): Promise<{
  landUse: ZoningData["landUse"];
  buildingContext: BuildingContext;
  activeConstruction: ConstructionSite[];
  historicDesignations: HistoricSite[];
}> {
  const query = `
    [out:json][timeout:20];
    (
      way["landuse"](around:400,${lat},${lng});
      relation["landuse"](around:400,${lat},${lng});
      way["building"]["building:levels"](around:600,${lat},${lng});
      relation["building"]["building:levels"](around:600,${lat},${lng});
      way["building"="construction"](around:1200,${lat},${lng});
      way["historic"](around:600,${lat},${lng});
      node["historic"](around:600,${lat},${lng});
    );
    out tags center;
  `;

  const empty = {
    landUse: null,
    buildingContext: { typicalLevels: null, maxLevels: null, sampleBuildings: [], dominantBuildingType: null },
    activeConstruction: [],
    historicDesignations: [],
  };

  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) return empty;
    const data = await res.json() as any;

    const landUseCounts: Record<string, number> = {};
    const buildingLevels: number[] = [];
    const sampleBuildings: BuildingContext["sampleBuildings"] = [];
    const buildingTypeCounts: Record<string, number> = {};
    const activeConstruction: ConstructionSite[] = [];
    const historicDesignations: HistoricSite[] = [];

    for (const el of data.elements || []) {
      const tags = el.tags || {};
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;

      // Land use
      const lu = tags.landuse;
      if (lu) {
        landUseCounts[lu] = (landUseCounts[lu] || 0) + 1;
      }

      // Buildings with levels
      if (tags["building:levels"]) {
        const levels = parseInt(tags["building:levels"]);
        if (!isNaN(levels) && levels > 0 && levels < 150) {
          buildingLevels.push(levels);
          const bType = tags.building_type || tags["sangis:TYPE"] || tags.building || undefined;
          const bTypeNorm = bType === "yes" ? undefined : bType;
          if (bTypeNorm) {
            buildingTypeCounts[bTypeNorm] = (buildingTypeCounts[bTypeNorm] || 0) + 1;
          }
          if (sampleBuildings.length < 10) {
            sampleBuildings.push({
              name: tags.name,
              type: bTypeNorm,
              levels,
            });
          }
        }
      }

      // Active construction
      if (tags.building === "construction" && elLat && elLng) {
        const levels = tags["building:levels"] ? parseInt(tags["building:levels"]) : undefined;
        activeConstruction.push({
          name: tags.name,
          levels: !isNaN(levels as number) && (levels as number) > 0 ? levels : undefined,
          constructionType: tags.construction,
          heightFt: tags.height_ft ? parseInt(tags.height_ft) : undefined,
          lat: elLat,
          lng: elLng,
        });
      }

      // Historic
      if (tags.historic && elLat && elLng) {
        historicDesignations.push({
          name: tags.name,
          designation: tags.historic,
          lat: elLat,
          lng: elLng,
        });
      }
    }

    // Build land use breakdown
    const breakdown = Object.entries(landUseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, label: getLandUseLabel(type), count }));

    const primaryType = breakdown[0]?.type || null;

    const landUse: ZoningData["landUse"] = primaryType
      ? {
          primaryType,
          label: getPrimaryLandUseLabel(primaryType),
          breakdown,
        }
      : null;

    // Building context
    const sortedLevels = [...buildingLevels].sort((a, b) => a - b);
    const typicalLevels = sortedLevels.length > 0
      ? sortedLevels[Math.floor(sortedLevels.length / 2)] // median
      : null;
    const maxLevels = sortedLevels.length > 0 ? sortedLevels[sortedLevels.length - 1] : null;

    const dominantBuildingType = Object.entries(buildingTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const buildingContext: BuildingContext = {
      typicalLevels,
      maxLevels,
      sampleBuildings: sampleBuildings.sort((a, b) => b.levels - a.levels).slice(0, 5),
      dominantBuildingType,
    };

    return { landUse, buildingContext, activeConstruction, historicDesignations };
  } catch {
    return empty;
  }
}

export async function getElevation(lat: number, lng: number): Promise<ElevationInfo | null> {
  try {
    const url = new URL(USGS_EPQS);
    url.searchParams.set("x", String(lng));
    url.searchParams.set("y", String(lat));
    url.searchParams.set("wkid", "4326");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as any;

    const elevM = parseFloat(data?.value);
    if (isNaN(elevM)) return null;

    return {
      elevationMeters: Math.round(elevM * 10) / 10,
      elevationFeet: Math.round(elevM * 3.28084),
    };
  } catch {
    return null;
  }
}

function buildZappLink(address: string, city: string, state: string, zip: string): string | null {
  if (state !== "CA" || city.toLowerCase() !== "san diego") return null;
  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");
  return `https://www.sandiego.gov/planning/zapp?search=${encodeURIComponent(fullAddress)}`;
}

export async function getZoningData(
  streetNumber: string,
  streetName: string,
  city: string,
  state: string,
  zip: string,
  lat: number,
  lng: number,
): Promise<ZoningData> {
  const [osmData, elevation] = await Promise.all([
    getLandUseAndBuildings(lat, lng),
    getElevation(lat, lng),
  ]);

  const address = [streetNumber, streetName].filter(Boolean).join(" ");
  const zappLink = buildZappLink(address, city, state, zip);

  return {
    landUse: osmData.landUse,
    buildingContext: osmData.buildingContext,
    elevation,
    activeConstruction: osmData.activeConstruction,
    historicDesignations: osmData.historicDesignations,
    zappLink,
  };
}
