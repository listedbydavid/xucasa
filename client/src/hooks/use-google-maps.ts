import { useJsApiLoader } from "@react-google-maps/api";

const LIBRARIES: ("places" | "marker")[] = ["places", "marker"];

const LOADER_OPTIONS = {
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  libraries: LIBRARIES,
  mapIds: ["real_estate_map"],
};

export function useGoogleMaps() {
  const { isLoaded, loadError } = useJsApiLoader(LOADER_OPTIONS);
  return { isLoaded, loadError };
}
