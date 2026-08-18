import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, InfoWindow, StreetViewPanorama } from '@react-google-maps/api';
import { Property } from '@/shared/schema';
import { EyeOff, Layers, Map as MapIcon, Satellite, Grid3X3 } from 'lucide-react';
import { useGoogleMaps } from '@/hooks/use-google-maps';

interface MapViewProps {
  properties: Property[];
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  highlightedPropertyId?: number | null;
  onMarkerHover?: (property: Property | null) => void;
}

function formatPriceShort(price: number): string {
  if (price >= 1_000_000) {
    const m = price / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (price >= 1_000) {
    const k = Math.round(price / 1_000);
    return `$${k}K`;
  }
  return `$${price}`;
}

const REGRID_TILE_URL = 'https://tiles.arcgis.com/tiles/KzeiCaQsMoeCfoCq/arcgis/rest/services/Regrid_Nationwide_Parcel_Boundaries_v1/MapServer/tile/{z}/{y}/{x}';

export function MapView({ properties, center = [-122.4194, 37.7749], zoom = 13, highlightedPropertyId, onMarkerHover }: MapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const [streetViewPosition, setStreetViewPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [showParcelLines, setShowParcelLines] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [showControls, setShowControls] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const markerPinsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const parcelOverlayRef = useRef<google.maps.ImageMapType | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const googleCenter = { lat: center[1], lng: center[0] };

  const getMarkerPosition = (property: Property, index: number): google.maps.LatLngLiteral => {
    const lat = property.lat ? parseFloat(property.lat as string) : null;
    const lng = property.lng ? parseFloat(property.lng as string) : null;
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
    return {
      lat: center[1] + (Math.sin(index * 2.3) * 0.018),
      lng: center[0] + (Math.cos(index * 2.3) * 0.018),
    };
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapInstance(map);
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
    setMapInstance(null);
  }, []);

  useEffect(() => {
    if (!mapInstance) return;

    if (showParcelLines) {
      if (!parcelOverlayRef.current) {
        parcelOverlayRef.current = new google.maps.ImageMapType({
          getTileUrl: (coord, zoom) => {
            if (zoom < 14) return null;
            return REGRID_TILE_URL
              .replace('{z}', String(zoom))
              .replace('{y}', String(coord.y))
              .replace('{x}', String(coord.x));
          },
          tileSize: new google.maps.Size(256, 256),
          opacity: 0.7,
          name: 'Parcel Lines',
        });
      }
      const overlays = mapInstance.overlayMapTypes;
      let found = false;
      for (let i = 0; i < overlays.getLength(); i++) {
        if (overlays.getAt(i) === parcelOverlayRef.current) { found = true; break; }
      }
      if (!found) overlays.push(parcelOverlayRef.current);
    } else if (parcelOverlayRef.current) {
      const overlays = mapInstance.overlayMapTypes;
      for (let i = overlays.getLength() - 1; i >= 0; i--) {
        if (overlays.getAt(i) === parcelOverlayRef.current) { overlays.removeAt(i); break; }
      }
    }
  }, [showParcelLines, mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.setMapTypeId(mapType === 'satellite' ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP);
  }, [mapType, mapInstance]);

  useEffect(() => {
    if (!showControls) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) {
        setShowControls(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showControls]);

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];
    markerPinsRef.current.clear();

    const positions: google.maps.LatLngLiteral[] = [];

    properties.forEach((property, index) => {
      const position = getMarkerPosition(property, index);
      positions.push(position);

      const isOff = property.isOffMarket;
      const bgColor = isOff ? '#f59e0b' : 'hsl(var(--primary))';
      const textColor = isOff ? '#111' : 'hsl(var(--primary-foreground))';
      const priceLabel = formatPriceShort(property.price);

      const pin = document.createElement('div');
      pin.setAttribute('data-testid', `map-marker-${property.id}`);
      pin.style.cssText = `
        display: flex; align-items: center; justify-content: center;
        padding: 4px 8px; border-radius: 6px;
        background: ${bgColor}; color: ${textColor};
        font-size: 12px; font-weight: 700; white-space: nowrap;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
        position: relative;
      `;

      const arrow = document.createElement('div');
      arrow.style.cssText = `
        position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
        width: 0; height: 0;
        border-left: 6px solid transparent; border-right: 6px solid transparent;
        border-top: 6px solid ${bgColor};
      `;
      pin.textContent = priceLabel;
      pin.appendChild(arrow);

      pin.addEventListener('mouseenter', () => {
        pin.style.transform = 'scale(1.15)';
        pin.style.boxShadow = '0 4px 14px rgba(0,0,0,0.4)';
        pin.style.zIndex = '10';
        onMarkerHover?.(property);
      });
      pin.addEventListener('mouseleave', () => {
        if (selectedProperty?.id !== property.id) {
          pin.style.transform = 'scale(1)';
          pin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          pin.style.zIndex = '';
        }
        onMarkerHover?.(null);
      });

      markerPinsRef.current.set(property.id, pin);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position,
        content: pin,
        title: property.title,
      });

      marker.addListener('click', () => {
        setSelectedProperty(property);
        setSelectedPosition(position);
      });

      markersRef.current.push(marker);
    });

    if (positions.length > 0 && mapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      positions.forEach(pos => bounds.extend(pos));
      if (positions.length === 1) {
        mapRef.current.setCenter(positions[0]);
        mapRef.current.setZoom(15);
      } else {
        mapRef.current.fitBounds(bounds, { top: 60, right: 40, bottom: 60, left: 40 });
      }
    } else if (positions.length === 0) {
      mapRef.current.panTo(googleCenter);
      mapRef.current.setZoom(zoom);
    }

    return () => {
      markersRef.current.forEach(m => { m.map = null; });
      markersRef.current = [];
      markerPinsRef.current.clear();
    };
  }, [properties, isLoaded]);

  useEffect(() => {
    markerPinsRef.current.forEach((pin, id) => {
      if (id === highlightedPropertyId) {
        pin.style.transform = 'scale(1.25)';
        pin.style.boxShadow = '0 4px 14px rgba(0,0,0,0.5)';
        pin.style.zIndex = '20';
      } else {
        pin.style.transform = 'scale(1)';
        pin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        pin.style.zIndex = '';
      }
    });
  }, [highlightedPropertyId]);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm p-4 text-center">
        Failed to load map. Check your Google Maps API key and ensure Maps JavaScript API is enabled.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {streetViewOpen && streetViewPosition ? (
        <div className="w-full h-full relative">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={streetViewPosition}
            zoom={zoom}
          >
            <StreetViewPanorama
              {...({ position: streetViewPosition, visible: true } as any)}
              options={{
                enableCloseButton: false,
                addressControl: true,
                linksControl: true,
                panControl: true,
                zoomControl: true,
              }}
            />
          </GoogleMap>
          <button
            onClick={() => setStreetViewOpen(false)}
            className="absolute top-4 left-4 z-[10] bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-border flex items-center gap-2 text-sm font-bold hover:bg-white transition-colors"
          >
            <EyeOff className="w-4 h-4" />
            Exit Street View
          </button>
        </div>
      ) : (
        <>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={googleCenter}
            zoom={zoom}
            onLoad={onMapLoad}
            onUnmount={onMapUnmount}
            options={{
              mapId: 'real_estate_map',
              streetViewControl: true,
              mapTypeControl: false,
              fullscreenControl: true,
              zoomControl: true,
            }}
          >
            {selectedProperty && selectedPosition && (
              <InfoWindow
                position={selectedPosition}
                onCloseClick={() => { setSelectedProperty(null); setSelectedPosition(null); }}
              >
                <div style={{ maxWidth: 200, padding: 4 }}>
                  {selectedProperty.imageUrl && (
                    <img
                      src={selectedProperty.imageUrl}
                      alt={selectedProperty.title}
                      style={{ width: '100%', height: 88, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
                    />
                  )}
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 4 }}>
                    {selectedProperty.title}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#dc2626', marginBottom: 8 }}>
                    ${selectedProperty.price.toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a
                      href={`/property/${selectedProperty.id}`}
                      style={{
                        flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700,
                        background: '#111', color: '#fff', padding: '6px 0',
                        borderRadius: 6, textDecoration: 'none',
                      }}
                    >
                      View Details
                    </a>
                    <button
                      onClick={() => {
                        setStreetViewPosition(selectedPosition);
                        setStreetViewOpen(true);
                      }}
                      style={{
                        fontSize: 12, fontWeight: 700, background: '#2563eb', color: '#fff',
                        padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      }}
                    >
                      Street View
                    </button>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          <div className="absolute top-3 right-3 z-[5]" ref={controlsRef}>
            <div className="relative">
              <button
                onClick={() => setShowControls(!showControls)}
                className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-gray-200 hover:bg-white transition-colors"
                data-testid="button-map-layers"
                title="Map layers"
              >
                <Layers className="w-5 h-5 text-gray-700" />
              </button>

              {showControls && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-1 pb-2">Map View</div>
                  <button
                    onClick={() => setMapType('roadmap')}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      mapType === 'roadmap' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    data-testid="button-map-roadmap"
                  >
                    <MapIcon className="w-4 h-4" />
                    Standard
                  </button>
                  <button
                    onClick={() => setMapType('satellite')}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      mapType === 'satellite' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    data-testid="button-map-satellite"
                  >
                    <Satellite className="w-4 h-4" />
                    Satellite
                  </button>

                  <div className="border-t border-gray-100 my-1.5" />
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-1 pb-2">Overlays</div>
                  <button
                    onClick={() => setShowParcelLines(!showParcelLines)}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      showParcelLines ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    data-testid="button-toggle-parcels"
                  >
                    <Grid3X3 className="w-4 h-4" />
                    Lot Lines
                    <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      showParcelLines ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {showParcelLines ? 'ON' : 'OFF'}
                    </span>
                  </button>
                  <p className="text-[10px] text-gray-400 px-3 pt-1 pb-1">
                    Zoom in to see parcel boundaries
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
