const OVERPASS = "https://overpass-api.de/api/interpreter";

export interface SchoolInfo {
  name: string;
  level: "elementary" | "middle" | "high" | "private" | "other";
  grades: string | null;
  district: string | null;
  address: string | null;
  distanceMeters: number;
  distanceMiles: number;
  lat: number;
  lng: number;
  website: string | null;
  phone: string | null;
  greatSchoolsUrl: string | null;
}

export interface SchoolsData {
  schools: SchoolInfo[];
  district: string | null;
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

function classifySchoolLevel(name: string, grades?: string, isced?: string): SchoolInfo["level"] {
  const n = name.toLowerCase();

  if (n.includes("montessori") || n.includes("catholic") || n.includes("christian") ||
      n.includes("lutheran") || n.includes("academy") || n.includes("prep school") ||
      n.includes("our lady") || n.includes("saint ") || n.includes("st. ") ||
      n.includes("hebrew") || n.includes("islamic") || n.includes("adventist") ||
      n.includes("parish") || n.includes("private")) {
    if (n.includes("high") || n.includes("senior")) return "high";
    if (n.includes("middle") || n.includes("junior")) return "middle";
    if (n.includes("elementary") || n.includes("primary")) return "elementary";
    return "private";
  }

  if (n.includes("university") || n.includes("college") || n.includes("institute") ||
      n.includes("technical") || n.includes("vocational")) {
    return "other";
  }

  if (isced) {
    if (isced.includes("1")) return "elementary";
    if (isced.includes("2")) return "middle";
    if (isced.includes("3")) return "high";
  }

  if (grades) {
    const g = grades.toLowerCase();
    if (g.includes("k") || g.includes("1-5") || g.includes("1-6") || g.includes("prek")) return "elementary";
    if (g.includes("6-8") || g.includes("7-8") || g.includes("6-9")) return "middle";
    if (g.includes("9-12") || g.includes("10-12")) return "high";
  }

  if (n.includes("elementary") || n.includes("primary")) return "elementary";
  if (n.includes("middle") || n.includes("intermediate") || n.includes("junior high")) return "middle";
  if (n.includes("high school") || n.includes("senior high") || n.includes("preparatory")) return "high";

  return "other";
}

function buildGreatSchoolsUrl(name: string, city: string, state: string): string {
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  const citySlug = city.toLowerCase().replace(/\s+/g, "-");
  const stateSlug = state.toLowerCase();
  return `https://www.greatschools.org/${stateSlug}/${citySlug}/${slug}/`;
}

function formatAddress(tags: Record<string, string>): string | null {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const city = tags["addr:city"];
  if (city) parts.push(city);
  return parts.join(" ");
}

const schoolsCache = new Map<string, { data: SchoolsData; expiresAt: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

export async function getNearbySchools(
  lat: number,
  lng: number,
  city: string,
  state: string
): Promise<SchoolsData> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = schoolsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const radius = 4000;
  const query = `
    [out:json][timeout:15];
    (
      nwr["amenity"="school"](around:${radius},${lat},${lng});
    );
    out center tags;
  `;

  const result: SchoolsData = { schools: [], district: null };

  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return result;
    const data = await res.json();

    const districtCounts = new Map<string, number>();

    for (const el of data.elements || []) {
      const tags = el.tags || {};
      const name = tags.name;
      if (!name) continue;

      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;

      const level = classifySchoolLevel(name, tags.grades, tags["isced:level"]);
      if (level === "other") continue;

      const distanceMeters = Math.round(haversineMeters(lat, lng, elLat, elLng));
      const distanceMiles = Math.round((distanceMeters / 1609.34) * 10) / 10;
      const district = tags.operator || null;

      if (district) {
        districtCounts.set(district, (districtCounts.get(district) || 0) + 1);
      }

      const school: SchoolInfo = {
        name,
        level,
        grades: tags.grades || null,
        district,
        address: formatAddress(tags),
        distanceMeters,
        distanceMiles,
        lat: elLat,
        lng: elLng,
        website: tags.website || null,
        phone: tags.phone || tags["contact:phone"] || null,
        greatSchoolsUrl: level !== "private" ? buildGreatSchoolsUrl(name, city, state) : null,
      };

      result.schools.push(school);
    }

    result.schools.sort((a, b) => a.distanceMeters - b.distanceMeters);

    if (districtCounts.size > 0) {
      let maxCount = 0;
      for (const [d, count] of districtCounts) {
        if (count > maxCount) {
          maxCount = count;
          result.district = d;
        }
      }
    }

    schoolsCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
  } catch (err) {
    console.error("[Schools] Error fetching nearby schools:", err);
  }

  return result;
}
