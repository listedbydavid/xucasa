import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Property } from '@shared/schema';

// Fix for default marker icon in Leaflet + React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  properties: Property[];
  center?: [number, number];
  zoom?: number;
}

export function MapView({ properties, center = [37.7749, -122.4194], zoom = 12 }: MapViewProps) {
  return (
    <MapContainer 
      center={center} 
      zoom={zoom} 
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://www.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map((property) => (
        <Marker 
          key={property.id} 
          position={[37.7749 + (Math.random() - 0.5) * 0.1, -122.4194 + (Math.random() - 0.5) * 0.1] as [number, number]}
        >
          <Popup>
            <div className="p-2">
              <img src={property.imageUrl || ''} alt={property.title} className="w-full h-24 object-cover rounded-md mb-2" />
              <h3 className="font-bold text-sm">{property.title}</h3>
              <p className="text-primary font-bold">${property.price.toLocaleString()}</p>
              <a href={`/property/${property.id}`} className="text-xs text-blue-500 hover:underline">View Details</a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
