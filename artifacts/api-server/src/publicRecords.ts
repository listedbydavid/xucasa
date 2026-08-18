const CENSUS_GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/address";
const CENSUS_ACS = "https://api.census.gov/data/2023/acs/acs5";
const FEMA_NFHL = "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHLWMS/MapServer/28/query";
const OVERPASS = "https://overpass-api.de/api/interpreter";

export interface GeocodedAddress {
  lat: number;
  lng: number;
  stateFips: string;
  countyFips: string;
  tractFips: string;
}

export interface NeighborhoodStats {
  medianHouseholdIncome: number | null;
  medianHomeValue: number | null;
  totalPopulation: number | null;
  ownerOccupiedPct: number | null;
  tractId: string;
}

export interface FloodInfo {
  floodZone: string;
  sfha: boolean; // Special Flood Hazard Area
  description: string;
}

export interface NearbyPlace {
  name: string;
  type: string;
  distanceMeters: number;
}

export interface PublicRecordsData {
  geocoded: GeocodedAddress | null;
  neighborhood: NeighborhoodStats | null;
  flood: FloodInfo | null;
  nearby: {
    schools: NearbyPlace[];
    parks: NearbyPlace[];
    hospitals: NearbyPlace[];
    transit: NearbyPlace[];
    groceries: NearbyPlace[];
  };
}

export async function geocodeAddress(
  streetNumber: string,
  streetName: string,
  city: string,
  state: string,
  zip: string
): Promise<GeocodedAddress | null> {
  try {
    const url = new URL(CENSUS_GEOCODER);
    url.searchParams.set("street", `${streetNumber} ${streetName}`);
    url.searchParams.set("city", city);
    url.searchParams.set("state", state);
    if (zip) url.searchParams.set("zip", zip);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("vintage", "Current_Current");
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as any;

    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;

    const tract = match.geographies?.["Census Tracts"]?.[0];
    if (!tract) return null;

    return {
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      stateFips: tract.STATE,
      countyFips: tract.COUNTY,
      tractFips: tract.TRACT,
    };
  } catch {
    return null;
  }
}

export async function getNeighborhoodStats(
  stateFips: string,
  countyFips: string,
  tractFips: string
): Promise<NeighborhoodStats | null> {
  try {
    // Variables:
    // B19013_001E = Median household income
    // B25077_001E = Median home value (owner-occupied)
    // B01003_001E = Total population
    // B25003_001E = Total occupied housing units
    // B25003_002E = Owner-occupied housing units
    const vars = "B19013_001E,B25077_001E,B01003_001E,B25003_001E,B25003_002E";
    const url = `${CENSUS_ACS}?get=${vars}&for=tract:${tractFips}&in=state:${stateFips}%20county:${countyFips}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as string[][];

    if (!data || data.length < 2) return null;
    const [headers, values] = [data[0], data[1]];

    const get = (key: string) => {
      const i = headers.indexOf(key);
      if (i === -1) return null;
      const val = parseInt(values[i]);
      return isNaN(val) || val < 0 ? null : val;
    };

    const totalUnits = get("B25003_001E");
    const ownerUnits = get("B25003_002E");
    const ownerOccupiedPct = totalUnits && ownerUnits
      ? Math.round((ownerUnits / totalUnits) * 100)
      : null;

    return {
      medianHouseholdIncome: get("B19013_001E"),
      medianHomeValue: get("B25077_001E"),
      totalPopulation: get("B01003_001E"),
      ownerOccupiedPct,
      tractId: `${stateFips}-${countyFips}-${tractFips}`,
    };
  } catch {
    return null;
  }
}

const FLOOD_ZONE_DESCRIPTIONS: Record<string, string> = {
  "A": "High risk – 100-year floodplain, no BFE determined",
  "AE": "High risk – 100-year floodplain, base flood elevation determined",
  "AH": "High risk – shallow flooding, flood depths 1–3 ft",
  "AO": "High risk – sheet flow flooding",
  "AR": "High risk – areas with temporarily increased risk",
  "A99": "High risk – protected by federal flood control system",
  "V": "Very high risk – coastal with wave action",
  "VE": "Very high risk – coastal with base flood elevation",
  "X": "Low to moderate risk – outside 100-year floodplain",
  "B": "Moderate risk",
  "C": "Low risk",
  "D": "Undetermined risk",
};

export async function getFloodZone(lat: number, lng: number): Promise<FloodInfo | null> {
  try {
    const url = new URL(FEMA_NFHL);
    url.searchParams.set("geometry", `${lng},${lat}`);
    url.searchParams.set("geometryType", "esriGeometryPoint");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("outFields", "FLD_ZONE,SFHA_TF,ZONE_SUBTY");
    url.searchParams.set("f", "json");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as any;

    const feature = data?.features?.[0];
    if (!feature) {
      return { floodZone: "X", sfha: false, description: "Low to moderate risk – outside 100-year floodplain" };
    }

    const zone: string = feature.attributes?.FLD_ZONE || "X";
    const sfha: boolean = feature.attributes?.SFHA_TF === "T";
    const description = FLOOD_ZONE_DESCRIPTIONS[zone] || `Zone ${zone}`;

    return { floodZone: zone, sfha, description };
  } catch {
    return null;
  }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getNearbyPlaces(
  lat: number,
  lng: number
): Promise<PublicRecordsData["nearby"]> {
  const radius = 1500; // meters
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"="school"](around:${radius},${lat},${lng});
      node["amenity"="hospital"](around:${radius},${lat},${lng});
      node["amenity"="doctors"](around:${radius},${lat},${lng});
      node["amenity"="bus_station"](around:${radius},${lat},${lng});
      node["highway"="bus_stop"](around:${radius},${lat},${lng});
      node["railway"="station"](around:${radius},${lat},${lng});
      node["railway"="tram_stop"](around:${radius},${lat},${lng});
      node["shop"="supermarket"](around:${radius},${lat},${lng});
      node["shop"="grocery"](around:${radius},${lat},${lng});
      way["leisure"="park"](around:${radius},${lat},${lng});
      node["leisure"="park"](around:${radius},${lat},${lng});
    );
    out center tags;
  `;

  const result: PublicRecordsData["nearby"] = {
    schools: [], parks: [], hospitals: [], transit: [], groceries: [],
  };

  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return result;
    const data = await res.json() as any;

    for (const el of data.elements || []) {
      const name = el.tags?.name;
      if (!name) continue;

      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;

      const distanceMeters = Math.round(haversineMeters(lat, lng, elLat, elLng));
      const place: NearbyPlace = { name, type: el.tags?.amenity || el.tags?.leisure || el.tags?.shop || el.tags?.highway || el.tags?.railway || "place", distanceMeters };

      const amenity = el.tags?.amenity;
      const leisure = el.tags?.leisure;
      const shop = el.tags?.shop;
      const highway = el.tags?.highway;
      const railway = el.tags?.railway;

      if (amenity === "school") result.schools.push(place);
      else if (amenity === "hospital" || amenity === "doctors") result.hospitals.push(place);
      else if (amenity === "bus_station" || highway === "bus_stop" || railway === "station" || railway === "tram_stop") result.transit.push(place);
      else if (shop === "supermarket" || shop === "grocery") result.groceries.push(place);
      else if (leisure === "park") result.parks.push(place);
    }

    // Sort each category by distance and cap at 5
    for (const key of Object.keys(result) as Array<keyof typeof result>) {
      result[key] = (result[key] as NearbyPlace[]).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
    }
  } catch {
    // Return partial results
  }

  return result;
}

export async function getPublicRecords(
  streetNumber: string,
  streetName: string,
  city: string,
  state: string,
  zip: string
): Promise<PublicRecordsData> {
  const geocoded = await geocodeAddress(streetNumber, streetName, city, state, zip);

  const [neighborhood, flood, nearby] = await Promise.all([
    geocoded
      ? getNeighborhoodStats(geocoded.stateFips, geocoded.countyFips, geocoded.tractFips)
      : Promise.resolve(null),
    geocoded
      ? getFloodZone(geocoded.lat, geocoded.lng)
      : Promise.resolve(null),
    geocoded
      ? getNearbyPlaces(geocoded.lat, geocoded.lng)
      : Promise.resolve({ schools: [], parks: [], hospitals: [], transit: [], groceries: [] }),
  ]);

  return { geocoded, neighborhood, flood, nearby };
}
