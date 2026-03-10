import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, InfoWindow, StreetViewPanorama } from '@react-google-maps/api';
import { Property } from '@shared/schema';
import { EyeOff } from 'lucide-react';
import { useGoogleMaps } from '@/hooks/use-google-maps';

interface MapViewProps {
  properties: Property[];
  center?: [number, number]; // [lng, lat]
  zoom?: number;
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

export function MapView({ properties, center = [-122.4194, 37.7749], zoom = 13 }: MapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const [streetViewPosition, setStreetViewPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const googleCenter = { lat: center[1], lng: center[0] };

  // Use real lat/lng from property if available, otherwise place near center with small offset
  const getMarkerPosition = (property: Property, index: number): google.maps.LatLngLiteral => {
    const lat = property.lat ? parseFloat(property.lat as string) : null;
    const lng = property.lng ? parseFloat(property.lng as string) : null;
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
    // Fallback: scatter around center so markers are at least visible
    return {
      lat: center[1] + (Math.sin(index * 2.3) * 0.018),
      lng: center[0] + (Math.cos(index * 2.3) * 0.018),
    };
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];

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
      });
      pin.addEventListener('mouseleave', () => {
        if (selectedProperty?.id !== property.id) {
          pin.style.transform = 'scale(1)';
          pin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          pin.style.zIndex = '';
        }
      });

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

    // Auto-fit map to show all pins
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
    };
  }, [properties, isLoaded]);

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
              position={streetViewPosition}
              visible={true}
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
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={googleCenter}
          zoom={zoom}
          onLoad={onMapLoad}
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
      )}
    </div>
  );
}
