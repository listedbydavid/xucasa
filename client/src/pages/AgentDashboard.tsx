import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProperties, useCreateProperty, useUpdateProperty, useDeleteProperty } from "@/hooks/use-properties";
import { Plus, Edit3, Trash2, Home, X, Search, Loader2 } from "lucide-react";
import type { PropertyResponse, CreatePropertyRequest } from "@shared/schema";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const GOOGLE_MAPS_LIBRARIES: ('places' | 'geometry')[] = ['places'];

export default function AgentDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { data: properties = [], isLoading } = useProperties();
  const { mutate: createProperty, isPending: isCreating } = useCreateProperty();
  const { mutate: updateProperty, isPending: isUpdating } = useUpdateProperty();
  const { mutate: deleteProperty } = useDeleteProperty();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyResponse | null>(null);

  // Filter properties logic - assumes backend returns all or just ours.
  // In a real app with proper roles, we'd only see our own. Let's filter by agentId if possible.
  const myProperties = properties.filter(p => p.agentId === user?.id) || properties; 

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold mb-4">Agent Portal Access Required</h1>
        <a href="/api/login" className="bg-primary text-white px-6 py-2 rounded-full font-bold">Log In</a>
      </div>
    );
  }

  const openNew = () => {
    setEditingProperty(null);
    setIsModalOpen(true);
  };

  const openEdit = (p: PropertyResponse) => {
    setEditingProperty(p);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if(confirm("Are you sure you want to delete this listing?")) {
      deleteProperty(id);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Agent Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage your active listings and off-market homes.</p>
          </div>
          <button 
            onClick={openNew}
            className="flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-xl font-bold hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Add Listing
          </button>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-muted rounded-xl"></div>
            <div className="h-16 bg-muted rounded-xl"></div>
          </div>
        ) : myProperties.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-3xl">
            <Home className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="font-display font-bold text-xl mb-2">No active listings</h3>
            <p className="text-muted-foreground mb-6">Create your first listing to start reaching buyers.</p>
            <button onClick={openNew} className="text-primary font-bold hover:underline">
              Create Listing
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-4 font-bold text-muted-foreground text-sm uppercase tracking-wider">Property</th>
                  <th className="p-4 font-bold text-muted-foreground text-sm uppercase tracking-wider">Price</th>
                  <th className="p-4 font-bold text-muted-foreground text-sm uppercase tracking-wider">Status</th>
                  <th className="p-4 font-bold text-muted-foreground text-sm uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myProperties.map(property => (
                  <tr key={property.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {property.imageUrl && <img src={property.imageUrl} className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <div className="font-bold text-foreground">{property.title}</div>
                        <div className="text-sm text-muted-foreground">{property.location}</div>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-foreground">
                      ${property.price.toLocaleString()}
                    </td>
                    <td className="p-4">
                      {property.isOffMarket ? (
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">Make Me Move</span>
                      ) : (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">Active</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => openEdit(property)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(property.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors ml-2">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <PropertyFormModal 
          property={editingProperty}
          onClose={() => setIsModalOpen(false)}
          onSubmit={(data) => {
            if (editingProperty) {
              updateProperty({ id: editingProperty.id, ...data }, { onSuccess: () => setIsModalOpen(false) });
            } else {
              createProperty(data, { onSuccess: () => setIsModalOpen(false) });
            }
          }}
          isPending={isCreating || isUpdating}
        />
      )}
    </div>
  );
}

// Modal Component defined in same file for cohesion
function PropertyFormModal({ 
  property, 
  onClose, 
  onSubmit, 
  isPending 
}: { 
  property: PropertyResponse | null, 
  onClose: () => void, 
  onSubmit: (data: any) => void,
  isPending: boolean 
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [formData, setFormData] = useState({
    title: property?.title || "",
    description: property?.description || "",
    price: property?.price?.toString() || "",
    addressStreetNumber: property?.addressStreetNumber || "",
    addressStreetName: property?.addressStreetName || "",
    addressUnitNumber: property?.addressUnitNumber || "",
    addressCity: property?.addressCity || "",
    addressState: property?.addressState || "",
    addressZip: property?.addressZip || "",
    location: property?.location || "",
    beds: property?.beds?.toString() || "",
    baths: property?.baths?.toString() || "",
    sqft: property?.sqft?.toString() || "",
    lotSize: property?.lotSize?.toString() || "",
    hoaFee: property?.hoaFee?.toString() || "",
    imageUrl: property?.imageUrl || "",
    isOffMarket: property?.isOffMarket || false,
  });

  const onAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place.address_components) return;

    let streetNumber = "";
    let streetName = "";
    let city = "";
    let state = "";
    let zip = "";

    for (const comp of place.address_components) {
      const types = comp.types;
      if (types.includes("street_number")) streetNumber = comp.long_name;
      if (types.includes("route")) streetName = comp.long_name;
      if (types.includes("locality")) city = comp.long_name;
      if (types.includes("administrative_area_level_1")) state = comp.short_name;
      if (types.includes("postal_code")) zip = comp.long_name;
    }

    setFormData(prev => ({
      ...prev,
      addressStreetNumber: streetNumber,
      addressStreetName: streetName,
      addressCity: city,
      addressState: state,
      addressZip: zip,
      location: `${city}, ${state}`,
      title: prev.title || (place.name || ""),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullLocation = formData.addressCity
      ? `${formData.addressCity}, ${formData.addressState}`
      : formData.location;
    onSubmit({
      title: formData.title,
      description: formData.description,
      price: Number(formData.price),
      addressStreetNumber: formData.addressStreetNumber || undefined,
      addressStreetName: formData.addressStreetName || undefined,
      addressUnitNumber: formData.addressUnitNumber || undefined,
      addressCity: formData.addressCity || undefined,
      addressState: formData.addressState || undefined,
      addressZip: formData.addressZip || undefined,
      location: fullLocation || formData.location,
      beds: Number(formData.beds),
      baths: formData.baths, // kept as string — decimal column expects string
      sqft: Number(formData.sqft),
      lotSize: formData.lotSize ? Number(formData.lotSize) : undefined,
      hoaFee: formData.hoaFee ? Number(formData.hoaFee) : undefined,
      imageUrl: formData.imageUrl || undefined,
      isOffMarket: formData.isOffMarket,
      status: "active",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-card rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10 animate-in">
        <div className="sticky top-0 bg-card/90 backdrop-blur-md p-6 border-b border-border flex justify-between items-center">
          <h2 className="text-2xl font-display font-bold">{property ? 'Edit Listing' : 'Create Listing'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5"/></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-bold text-muted-foreground mb-2">Search Address (Google Autocomplete)</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10 pointer-events-none" />
                {isLoaded ? (
                  <Autocomplete
                    onLoad={onAutocompleteLoad}
                    onPlaceChanged={onPlaceChanged}
                    options={{ componentRestrictions: { country: "us" }, types: ["address"] }}
                  >
                    <input
                      className="w-full bg-background border-2 border-border rounded-xl pl-12 pr-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      placeholder="Start typing an address..."
                      type="text"
                    />
                  </Autocomplete>
                ) : (
                  <input
                    className="w-full bg-background border-2 border-border rounded-xl pl-12 pr-4 py-3 outline-none"
                    placeholder="Loading address search..."
                    disabled
                  />
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-muted-foreground mb-2">Street #</label>
                <input required value={formData.addressStreetNumber} onChange={e => setFormData({...formData, addressStreetNumber: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="123" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-muted-foreground mb-2">Street Name</label>
                <input required value={formData.addressStreetName} onChange={e => setFormData({...formData, addressStreetName: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="Main St" />
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-2">Unit/Apt</label>
                <input value={formData.addressUnitNumber} onChange={e => setFormData({...formData, addressUnitNumber: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="4B" />
              </div>
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-2">City</label>
                <input required value={formData.addressCity} onChange={e => setFormData({...formData, addressCity: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="Seattle" />
              </div>
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-2">State</label>
                <input required value={formData.addressState} onChange={e => setFormData({...formData, addressState: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="WA" />
              </div>
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-2">Zip</label>
                <input required value={formData.addressZip} onChange={e => setFormData({...formData, addressZip: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="98101" />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-border">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Listing Title</label>
              <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" placeholder="Stunning Modern Home" />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Price ($)</label>
              <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" placeholder="750000" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-muted-foreground mb-2">Description</label>
            <textarea required rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none" placeholder="Describe the property..." />
          </div>

          <div className="grid grid-cols-3 gap-4 md:col-span-2">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Beds</label>
              <input required type="number" min="0" value={formData.beds} onChange={e => setFormData({...formData, beds: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Baths</label>
              <input required type="number" step="0.5" min="0" value={formData.baths} onChange={e => setFormData({...formData, baths: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Sq Ft</label>
              <input required type="number" min="0" value={formData.sqft} onChange={e => setFormData({...formData, sqft: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Lot Size (sq ft)</label>
              <input type="number" min="0" value={formData.lotSize} onChange={e => setFormData({...formData, lotSize: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="e.g. 5000" />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">HOA Fee ($/mo)</label>
              <input type="number" min="0" value={formData.hoaFee} onChange={e => setFormData({...formData, hoaFee: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="0 if none" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-muted-foreground mb-2">Image URL</label>
            <input value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" placeholder="https://unsplash.com/..." />
          </div>

          <div className="md:col-span-2 flex items-center gap-3 bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
            <input 
              type="checkbox" 
              id="isOffMarket" 
              checked={formData.isOffMarket}
              onChange={e => setFormData({...formData, isOffMarket: e.target.checked})}
              className="w-5 h-5 accent-yellow-500 rounded cursor-pointer"
            />
            <label htmlFor="isOffMarket" className="font-bold text-yellow-800 cursor-pointer">
              Mark as "Make Me Move" (Off-Market)
            </label>
          </div>
          
          <div className="flex justify-end gap-4 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={isPending} className="px-8 py-3 font-bold bg-primary text-white rounded-xl hover:bg-primary/90 hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2">
              {isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
              {property ? 'Save Changes' : 'Post Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
