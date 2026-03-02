import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Property } from '@shared/schema';

// NOTE: In a real app, you should use an environment variable for the token.
// For this demo, we can use a public token or ask the user for one.
// mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN';

interface MapViewProps {
  properties: Property[];
  center?: [number, number];
  zoom?: number;
}

export function MapView({ properties, center = [-122.4194, 37.7749], zoom = 12 }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (map.current) return; // Initialize only once
    if (!mapContainer.current) return;

    // Default public token for demonstration if none provided
    // mapboxgl.accessToken = '...'; 

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: zoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl());
  }, []);

  useEffect(() => {
    if (!map.current) return;
    map.current.flyTo({ center, zoom, duration: 2000 });
  }, [center, zoom]);

  useEffect(() => {
    if (!map.current) return;

    // Clear old markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add new markers
    properties.forEach(property => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundColor = '#ef4444';
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([center[0] + (Math.random() - 0.5) * 0.05, center[1] + (Math.random() - 0.5) * 0.05])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <img src="${property.imageUrl || ''}" alt="${property.title}" class="w-full h-24 object-cover rounded-md mb-2" />
              <h3 class="font-bold text-sm">${property.title}</h3>
              <p class="text-primary font-bold">$${property.price.toLocaleString()}</p>
              <a href="/property/${property.id}" class="text-xs text-blue-500 hover:underline">View Details</a>
            </div>`
          )
        )
        .addTo(map.current!);
      
      markers.current.push(marker);
    });
  }, [properties]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
